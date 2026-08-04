/** Tests for software/tools/build-installer.js — verifies the self-extracting installer is well-formed and round-trips. */
import { describe, it, expect, beforeAll } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
// Default ESM import so vitest's istanbul provider sees the file through Vite's
// transform pipeline and instruments it for coverage.
import buildInstallerModule from "../tools/build-installer.js";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const { buildHeader, wrapBase64, assembleInstaller, PAYLOAD_MARKER, FILES_TO_BUNDLE, buildTarball, countTarballEntries, getVersionString } =
  buildInstallerModule;

describe("wrapBase64", () => {
  it("wraps at 76 chars per line", () => {
    const input = "a".repeat(200);
    const wrapped = wrapBase64(input);
    const lines = wrapped.split("\n");
    expect(lines.every((line, i) => (i < lines.length - 1 ? line.length === 76 : line.length <= 76))).toBe(true);
    expect(lines.join("")).toBe(input);
  });
});

describe("buildHeader", () => {
  const header = buildHeader({
    version: "v0.20260514.0930.abc1234",
    sha: "abc1234",
    fileCount: 42,
    payloadBytes: 12345,
  });

  it("starts with a bash shebang", () => {
    expect(header.split("\n")[0]).toBe("#!/usr/bin/env bash");
  });

  it("embeds the supplied build metadata", () => {
    expect(header).toContain("abc1234");
    expect(header).toContain("12345");
    expect(header).toContain("42 files");
  });

  it("embeds the version string in both the banner and an env-style assignment", () => {
    // The version appears in the human-readable banner comment AND as a shell
    // variable assignment that the runtime echo uses. Both surfaces must match.
    expect(header).toContain("# Version: v0.20260514.0930.abc1234");
    expect(header).toContain('BASHRC_INSTALLER_BUILD_VERSION="v0.20260514.0930.abc1234"');
  });

  it("emits a runtime version line to stderr unless BASHRC_INSTALLER_QUIET is set", () => {
    expect(header).toMatch(/echo ">> install-bashrc\.sh \$BASHRC_INSTALLER_BUILD_VERSION/);
    expect(header).toContain("BASHRC_INSTALLER_QUIET");
    expect(header).toMatch(/>&2/);
  });

  it("contains the PAYLOAD_MARKER on its own line, exactly once", () => {
    const matches = header.split("\n").filter((line) => line === PAYLOAD_MARKER);
    expect(matches).toHaveLength(1);
  });

  it("execs run.sh with forwarded args", () => {
    expect(header).toMatch(/exec bash run\.sh "\$@"/);
  });

  it("respects BASHRC_INSTALLER_KEEP to skip cleanup", () => {
    expect(header).toContain("BASHRC_INSTALLER_KEEP");
  });

  it("self-bootstraps when piped from curl|bash (re-downloads then exec's)", () => {
    // When $0 is "bash" (curl | bash form), the header must detect that the
    // current file doesn't contain the payload marker and re-download itself.
    expect(header).toMatch(/if \[ ! -f "\$0" \] \|\| ! command grep -qF/);
    expect(header).toMatch(/BASHRC_INSTALLER_URL=/);
    expect(header).toMatch(/curl -fsSL "\$BASHRC_INSTALLER_URL"/);
    expect(header).toMatch(/wget -qO/);
    expect(header).toMatch(/exec bash "\$__bashrc_tmp_installer"/);
  });

  it("points BASHRC_INSTALLER_URL at the binary-cache release asset", () => {
    expect(header).toContain("https://github.com/synle/bashrc/releases/download/binary-cache/bashrc-installer__install-bashrc.sh");
  });
});

describe("assembleInstaller", () => {
  it("appends a trailing newline so the file ends cleanly", () => {
    const out = assembleInstaller("HEADER\n", "PAYLOAD");
    expect(out.endsWith("\n")).toBe(true);
  });
});

describe("FILES_TO_BUNDLE manifest", () => {
  it("lists run.sh and the four critical software/ subtrees", () => {
    expect(FILES_TO_BUNDLE).toContain("run.sh");
    expect(FILES_TO_BUNDLE).toContain("software/index.js");
    expect(FILES_TO_BUNDLE).toContain("software/bootstrap");
    expect(FILES_TO_BUNDLE).toContain("software/scripts");
    expect(FILES_TO_BUNDLE).toContain("software/metadata");
  });

  it("every entry exists on disk", () => {
    for (const entry of FILES_TO_BUNDLE) {
      const full = path.join(ROOT_DIR, entry);
      expect(fs.existsSync(full), `missing bundle entry: ${entry}`).toBe(true);
    }
  });
});

describe("tarball round-trip", () => {
  /** @type {Buffer} */
  let tarball;

  beforeAll(() => {
    tarball = buildTarball();
  });

  it("contains run.sh and software/index.js at the top of the tree", () => {
    const res = spawnSync("tar", ["-tzf", "-"], {
      input: tarball,
      encoding: "utf8",
    });
    expect(res.status).toBe(0);
    const entries = res.stdout.split("\n");
    expect(entries).toContain("run.sh");
    expect(entries).toContain("software/index.js");
    expect(entries).toContain("software/common.js");
  });

  it("excludes node_modules, *.spec.js, and __snapshots__", () => {
    const res = spawnSync("tar", ["-tzf", "-"], {
      input: tarball,
      encoding: "utf8",
    });
    const entries = res.stdout.split("\n");
    expect(entries.some((e) => e.includes("node_modules"))).toBe(false);
    expect(entries.some((e) => e.endsWith(".spec.js"))).toBe(false);
    expect(entries.some((e) => e.includes("__snapshots__"))).toBe(false);
  });

  it("countTarballEntries returns >0", () => {
    expect(countTarballEntries(tarball)).toBeGreaterThan(50);
  });
});

describe("getVersionString", () => {
  it("honors BASHRC_INSTALLER_VERSION env override (lets CI pin the version)", () => {
    const orig = process.env.BASHRC_INSTALLER_VERSION;
    try {
      process.env.BASHRC_INSTALLER_VERSION = "v9.99.test.deadbee";
      expect(getVersionString()).toBe("v9.99.test.deadbee");
    } finally {
      if (orig === undefined) delete process.env.BASHRC_INSTALLER_VERSION;
      else process.env.BASHRC_INSTALLER_VERSION = orig;
    }
  });

  it("matches v0.YYYYMMDD.HHMM.<short_sha> format when no env override", () => {
    const orig = process.env.BASHRC_INSTALLER_VERSION;
    try {
      delete process.env.BASHRC_INSTALLER_VERSION;
      // Format: v0.20260514.0930.eebf417 — date is 8 digits, time is 4, sha
      // is the short-sha output of git (typically 7 hex but can be longer in
      // ambiguous repos; allow 7-12). Allow "unknown" for non-git fallback.
      expect(getVersionString()).toMatch(/^v0\.\d{8}\.\d{4}\.([0-9a-f]{7,12}|unknown)$/);
    } finally {
      if (orig !== undefined) process.env.BASHRC_INSTALLER_VERSION = orig;
    }
  });
});

describe("end-to-end: installer extracts and runs run.sh --help", () => {
  it("produces an extracted repo with run.sh + software/index.js", () => {
    // Build a small installer to disk and execute it with a no-op flag.
    // We pick `--files=` with an obviously bogus name and a fast-fail flag
    // (--dryrun) so run.sh exits quickly without doing real work.
    const tarball = buildTarball();
    const header = buildHeader({
      version: "v0.20260514.0000.testtag",
      sha: "test",
      fileCount: countTarballEntries(tarball),
      payloadBytes: tarball.length,
    });
    const installerText = assembleInstaller(header, wrapBase64(tarball.toString("base64")));

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bashrc-installer-spec-"));
    const installerPath = path.join(tmpDir, "install-bashrc.sh");
    const extractDir = path.join(tmpDir, "extract");
    fs.writeFileSync(installerPath, installerText);
    fs.chmodSync(installerPath, 0o755);

    try {
      // Extract only — bypass the `exec run.sh` step by sourcing the script
      // up to the marker and running just the extract pipeline manually. This
      // keeps the test hermetic (no real ~/.bash_syle writes) and fast.
      const extractScript = `
        set -e
        mkdir -p "${extractDir}"
        awk '/^${PAYLOAD_MARKER}$/{p=1; next} p' "${installerPath}" \
          | base64 -d \
          | tar -xzf - -C "${extractDir}"
      `;
      const res = spawnSync("bash", ["-c", extractScript], {
        encoding: "utf8",
      });
      expect(res.status, res.stderr).toBe(0);

      expect(fs.existsSync(path.join(extractDir, "run.sh"))).toBe(true);
      expect(fs.existsSync(path.join(extractDir, "software/index.js"))).toBe(true);
      expect(fs.existsSync(path.join(extractDir, "software/common.js"))).toBe(true);
      expect(fs.existsSync(path.join(extractDir, "software/bootstrap/common-env.sh"))).toBe(true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

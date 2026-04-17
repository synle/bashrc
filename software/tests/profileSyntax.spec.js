/** Syntax and size check for shell scripts. */
import { describe, it, expect } from "vitest";
import { execSync } from "child_process";
import { globSync, readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
/** Primary OS profiles to test (matches CI publish gate: ubuntu + mac). */
const PRIMARY_OS_PATTERNS = ["ubuntu", "mac"];
const profileFiles = globSync(path.join(ROOT_DIR, ".build/profile_bashrc_*.sh")).filter((f) => {
  const base = path.basename(f);
  return PRIMARY_OS_PATTERNS.some((os) => base.includes(`_${os}`));
});
const bootstrapFiles = globSync(path.join(ROOT_DIR, "software/bootstrap/*.{sh,bash}"));
const rootScriptFiles = globSync(path.join(ROOT_DIR, "*.sh"));
const fullSetupFiles = globSync(path.join(ROOT_DIR, "software/scripts/**/_full-setup{,.common.linux}.{sh,bash}"));

/** Minimum char count per profile file (95% of current size as of 2026-03-23). */
const MIN_CHARS_PROFILE_MAP = {
  profile_bashrc_mac: 263720, // current: 277601
  profile_bashrc_ubuntu: 486150, // current: 511737
};
const MIN_CHARS_BOOTSTRAP = 2200;
/** Bootstrap files with lower size thresholds (small by design). */
const BOOTSTRAP_SIZE_OVERRIDES = { "setup.sh": 400, "common-env.sh": 400, "common-functions.bash": 2000 };
const MIN_CHARS_ROOT_SCRIPTS = 1100;

/** @param {string} filePath */
function assertNoSyntaxErrors(filePath) {
  const fileName = path.basename(filePath);
  try {
    execSync(`bash -n "${filePath}"`, { encoding: "utf-8", stdio: "pipe" });
  } catch (err) {
    expect.fail(`Syntax error in ${fileName}:\n${err.stderr}`);
  }
}

/** @param {string} filePath @param {number} minChars */
function assertMinSize(filePath, minChars) {
  const size = readFileSync(filePath, "utf-8").length;
  expect(size, `${path.basename(filePath)} is ${size} chars, expected >= ${minChars}`).toBeGreaterThanOrEqual(minChars);
}

describe("profile bashrc syntax check", () => {
  it("should find profile files to test", () => {
    expect(profileFiles.length).toBeGreaterThan(0);
  });

  profileFiles.forEach((filePath) => {
    it(`${path.basename(filePath)} - no syntax errors`, () => {
      assertNoSyntaxErrors(filePath);
    });

    it(`${path.basename(filePath)} - meets minimum size`, () => {
      const key = path.basename(filePath, ".sh");
      // debug snapshots (e.g. profile_bashrc_redhat_2-before-cleanup) — match base OS key
      const baseKey = key.replace(/_(0-before-run|1-after-bootstrap|2-before-cleanup|3-after-cleanup|4-after-flush)$/, "");
      // skip size check for pre-run and bootstrap snapshots (may be empty or template-only)
      if (baseKey !== key && (key.endsWith("_0-before-run") || key.endsWith("_1-after-bootstrap"))) return;
      const minChars = MIN_CHARS_PROFILE_MAP[baseKey] || 70000;
      assertMinSize(filePath, minChars);
    });
  });
});

describe("bootstrap scripts syntax check", () => {
  it("should find bootstrap files to test", () => {
    expect(bootstrapFiles.length).toBeGreaterThan(0);
  });

  bootstrapFiles.forEach((filePath) => {
    it(`${path.basename(filePath)} - no syntax errors`, () => {
      assertNoSyntaxErrors(filePath);
    });

    it(`${path.basename(filePath)} - meets minimum size`, () => {
      const minChars = BOOTSTRAP_SIZE_OVERRIDES[path.basename(filePath)] || MIN_CHARS_BOOTSTRAP;
      assertMinSize(filePath, minChars);
    });
  });
});

describe("full-setup scripts syntax check", () => {
  it("should find full-setup script files to test", () => {
    expect(fullSetupFiles.length).toBeGreaterThan(0);
  });

  fullSetupFiles.forEach((filePath) => {
    const relPath = path.relative(ROOT_DIR, filePath);

    it(`${relPath} - no syntax errors`, () => {
      assertNoSyntaxErrors(filePath);
    });
  });
});

describe("profile block-level syntax check", () => {
  /**
   * Extracts all BEGIN/END blocks from a profile file.
   * @param {string} content - File content
   * @returns {Array<{key: string, body: string, lineNumber: number}>}
   */
  function extractBlocks(content) {
    const blocks = [];
    const lines = content.split("\n");
    let i = 0;
    while (i < lines.length) {
      const beginMatch = lines[i].match(/^# BEGIN (.+)$/);
      if (beginMatch) {
        const key = beginMatch[1].trim();
        const startLine = i + 1;
        const bodyLines = [];
        i++;
        while (i < lines.length) {
          const endMatch = lines[i].match(/^# END (.+)$/);
          if (endMatch && endMatch[1].trim() === key) {
            break;
          }
          bodyLines.push(lines[i]);
          i++;
        }
        if (bodyLines.length > 0) {
          blocks.push({ key, body: bodyLines.join("\n"), lineNumber: startLine + 1 });
        }
      }
      i++;
    }
    return blocks;
  }

  profileFiles.forEach((filePath) => {
    const fileName = path.basename(filePath);
    const content = readFileSync(filePath, "utf-8");
    const blocks = extractBlocks(content);

    it(`${fileName} - no invalid bash syntax placeholder blocks`, () => {
      const invalid = [];
      for (const { key, body, lineNumber } of blocks) {
        if (body.includes("# Invalid Content")) {
          invalid.push(`"# BEGIN ${key}" at line ${lineNumber - 1} contains invalid bash syntax placeholder`);
        }
      }
      if (invalid.length > 0) {
        expect.fail(`Invalid bash syntax blocks in ${fileName}:\n  ${invalid.join("\n  ")}`);
      }
    });

    it(`${fileName} - no duplicate BEGIN/END blocks`, () => {
      const seen = {};
      const duplicates = [];
      for (const { key, lineNumber } of blocks) {
        if (seen[key]) {
          duplicates.push(`"# BEGIN ${key}" appears at line ${seen[key] - 1} and line ${lineNumber - 1}`);
        }
        seen[key] = lineNumber;
      }
      if (duplicates.length > 0) {
        expect.fail(`Duplicate BEGIN/END blocks in ${fileName}:\n  ${duplicates.join("\n  ")}`);
      }
    });

    blocks.forEach(({ key, body, lineNumber }) => {
      it(`${fileName} > block "${key}" (line ${lineNumber}) - no syntax errors`, () => {
        // Check for null bytes (indicates file corruption / concurrent write)
        if (body.includes("\0")) {
          expect.fail(
            `Null bytes found in ${fileName} block "${key}" (line ${lineNumber}): block contains ${(body.match(/\0/g) || []).length} null byte(s) — likely file corruption`,
          );
          return;
        }

        // Write to temp file for bash -n (avoids heredoc issues with special chars)
        const tmpFile = `/tmp/_bashrc_syntax_check_${process.pid}.sh`;
        try {
          require("fs").writeFileSync(tmpFile, body, "utf-8");
          execSync(`bash -n "${tmpFile}"`, { encoding: "utf-8", stdio: "pipe" });
        } catch (err) {
          const stderr = (err.stderr || err.message || "unknown error").trim();
          expect.fail(`Syntax error in ${fileName} block "${key}" (line ${lineNumber}):\n${stderr}`);
        } finally {
          try {
            require("fs").unlinkSync(tmpFile);
          } catch {}
        }
      });
    });
  });
});

describe("profile bashrc source check", () => {
  /** @param {string} filePath @param {Record<string, string>} envOverrides */
  function assertNoSourceErrors(filePath, envOverrides = {}) {
    const stderr = execSync(`bash -c 'source "${filePath}"' 2>&1 1>/dev/null || true`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ...envOverrides, HOME: process.env.HOME, PATH: process.env.PATH },
    }).trim();
    if (stderr.length > 0) {
      expect.fail(`Source error in ${path.basename(filePath)}:\n${stderr}`);
    }
  }

  profileFiles.forEach((filePath) => {
    it(`${path.basename(filePath)} - no errors when sourced`, () => {
      assertNoSourceErrors(filePath, { CLAUDECODE: "" });
    });

    it(`${path.basename(filePath)} - no errors when sourced with CLAUDECODE=1`, () => {
      assertNoSourceErrors(filePath, { CLAUDECODE: "1" });
    });
  });
});

describe("profile-core.sh PATH construction", () => {
  const fs = require("fs");
  const tmpScript = `/tmp/_bashrc_path_test_${process.pid}.sh`;

  /** Runs the path_candidates block in a bash subshell with a controlled PATH and verifies the result. */
  function runPathTest(initialPath, extraSetup = "") {
    fs.writeFileSync(
      tmpScript,
      [
        "#!/usr/bin/env bash",
        extraSetup,
        'export HOME="/tmp/path_test_home"',
        `export PATH="${initialPath}"`,
        `source "${path.join(ROOT_DIR, "software/scripts/bash-path-candidate-profile.bash")}" 2>/dev/null`,
        `source "${path.join(ROOT_DIR, "software/bootstrap/profile-core.sh")}" 2>/dev/null`,
        'echo "$PATH"',
      ].join("\n"),
    );
    try {
      return execSync(`bash "${tmpScript}"`, { encoding: "utf-8", cwd: ROOT_DIR }).trim();
    } finally {
      try {
        fs.unlinkSync(tmpScript);
      } catch {}
    }
  }

  it("should preserve /usr/bin and /bin in PATH", () => {
    const result = runPathTest("/usr/bin:/bin:/usr/sbin:/sbin");
    const dirs = result.split(":");
    expect(dirs).toContain("/usr/bin");
    expect(dirs).toContain("/bin");
  });

  it("should not produce empty PATH segments", () => {
    const result = runPathTest("/usr/bin:/bin");
    expect(result).not.toMatch(/::/);
    expect(result).not.toMatch(/^:/);
    expect(result).not.toMatch(/:$/);
  });

  it("should dedupe PATH entries", () => {
    const result = runPathTest("/usr/bin:/bin:/usr/bin:/bin");
    const dirs = result.split(":");
    const usrBinCount = dirs.filter((d) => d === "/usr/bin").length;
    expect(usrBinCount).toBe(1);
  });

  it("should place user tool candidates before system dirs when both exist", () => {
    // create a fake user tool dir so it appears in PATH
    const setup = "mkdir -p /tmp/path_test_home/.local/bin";
    const result = runPathTest("/usr/bin:/bin", setup);
    const dirs = result.split(":");
    const localIdx = dirs.indexOf("/tmp/path_test_home/.local/bin");
    const usrBinIdx = dirs.indexOf("/usr/bin");
    if (localIdx !== -1) {
      expect(localIdx).toBeLessThan(usrBinIdx);
    }
  });
});

describe("root scripts syntax check", () => {
  it("should find root script files to test", () => {
    expect(rootScriptFiles.length).toBeGreaterThan(0);
  });

  rootScriptFiles.forEach((filePath) => {
    it(`${path.basename(filePath)} - no syntax errors`, () => {
      assertNoSyntaxErrors(filePath);
    });

    it(`${path.basename(filePath)} - meets minimum size (${MIN_CHARS_ROOT_SCRIPTS} chars)`, () => {
      assertMinSize(filePath, MIN_CHARS_ROOT_SCRIPTS);
    });
  });
});

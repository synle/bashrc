import { describe, it, expect } from "vitest";

import { execSync } from "child_process";

import { existsSync, readdirSync, readFileSync, realpathSync } from "fs";

import path from "path";

import { fileURLToPath } from "url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const COMMON_ENV = path.join(ROOT_DIR, "software/bootstrap/common-env.sh");

function listFiles(dir, predicate) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && predicate(e.name))
    .map((e) => path.join(dir, e.name))
    .sort();
}

function walkFiles(dir, predicate, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(p, predicate, out);
    else if (entry.isFile() && predicate(entry.name)) out.push(p);
  }
  return out.sort();
}

const PRIMARY_OS_PATTERNS = ["ubuntu", "mac"];

const profileFiles = listFiles(
  path.join(ROOT_DIR, ".build"),
  (n) => n.startsWith("profile_bashrc_") && n.endsWith(".sh") && PRIMARY_OS_PATTERNS.some((os) => n.includes(`_${os}`)),
);

const bootstrapFiles = listFiles(path.join(ROOT_DIR, "software/bootstrap"), (n) => /\.(sh|bash)$/.test(n));

const rootScriptFiles = listFiles(ROOT_DIR, (n) => n.endsWith(".sh"));

const fullSetupFiles = walkFiles(path.join(ROOT_DIR, "software/scripts"), (n) =>
  /^_full-setup(\.common\.linux|\.touchid|\.docker-uninstall)?\.(sh|bash)$/.test(n),
);

const profilePartialFiles = listFiles(path.join(ROOT_DIR, "software/scripts"), (n) => n.endsWith(".profile.bash"));

const MIN_CHARS_PROFILE_MAP = {
  profile_bashrc_mac: 263720, // current: 277601
  profile_bashrc_ubuntu: 284500, // current: 299571
};

const MIN_CHARS_BOOTSTRAP = 2200;

const BOOTSTRAP_SIZE_OVERRIDES = { "setup.sh": 400, "common-env.sh": 400, "common-functions.bash": 2000 };

const MIN_CHARS_ROOT_SCRIPTS = 1100;

const LEGACY_BASH = (() => {
  const candidate = "/bin/bash";
  if (!existsSync(candidate)) return null;
  try {
    const pathBash = execSync("command -v bash", { encoding: "utf-8" }).trim();
    if (pathBash && realpathSync(pathBash) === realpathSync(candidate)) return null;
  } catch {
    // No bash on PATH to compare against — still worth checking /bin/bash.
  }
  return candidate;
})();

const SYNTAX_CHECK_SHELLS = ["bash", LEGACY_BASH].filter(Boolean);

function assertNoSyntaxErrors(filePath) {
  const fileName = path.basename(filePath);
  for (const shell of SYNTAX_CHECK_SHELLS) {
    try {
      execSync(`${shell} -n "${filePath}"`, { encoding: "utf-8", stdio: "pipe" });
    } catch (err) {
      expect.fail(`Syntax error in ${fileName} (${shell}):\n${err.stderr}`);
    }
  }
}

function assertMinSize(filePath, minChars) {
  const size = readFileSync(filePath, "utf-8").length;
  expect(size, `${path.basename(filePath)} is ${size} chars, expected >= ${minChars}`).toBeGreaterThanOrEqual(minChars);
}

describe.skipIf(profileFiles.length === 0)("profile block-level syntax check", () => {
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
          for (const shell of SYNTAX_CHECK_SHELLS) {
            try {
              execSync(`${shell} -n "${tmpFile}"`, { encoding: "utf-8", stdio: "pipe" });
            } catch (err) {
              const stderr = (err.stderr || err.message || "unknown error").trim();
              expect.fail(`Syntax error in ${fileName} block "${key}" (line ${lineNumber}) under ${shell}:\n${stderr}`);
            }
          }
        } finally {
          try {
            require("fs").unlinkSync(tmpFile);
          } catch {}
        }
      });
    });
  });
});

describe.skipIf(profileFiles.length === 0)("profile bashrc source check", () => {
  /** @param {string} filePath @param {Record<string, string>} envOverrides */
  function assertNoSourceErrors(filePath, envOverrides = {}) {
    const stderr = execSync(`bash -c '. "${COMMON_ENV}" > /dev/null 2>&1; source "${filePath}"' 2>&1 1>/dev/null || true`, {
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

const allShellFiles = [
  ...walkFiles(path.join(ROOT_DIR, "software/scripts"), (n) => /\.(sh|bash)$/.test(n) && !n.endsWith(".ps1.bash")),
  ...walkFiles(path.join(ROOT_DIR, "software/bootstrap"), (n) => /\.(sh|bash)$/.test(n) && !n.endsWith(".ps1.bash")),
  ...rootScriptFiles,
];

function findHeredocsInCommandSubstitution(source) {
  const lines = source.split("\n");
  const offenders = [];
  let depth = 0;
  let heredocTag = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (heredocTag !== null) {
      if (line.trim() === heredocTag) heredocTag = null;
      continue;
    }
    const stripped = line.replace(/#.*$/, "");
    // `$(` opens a substitution; a bare `)` at the end of a line closes one. This
    // deliberately only tracks the multi-line form, which is the only shape that
    // can wrap a heredoc.
    const opens = (stripped.match(/\$\(\s*$/g) || []).length;
    const heredoc = stripped.match(/<<-?\s*'([A-Za-z_][A-Za-z0-9_]*)'/);
    if (heredoc && depth > 0) offenders.push({ line: i + 1, text: line.trim() });
    if (heredoc) heredocTag = heredoc[1];
    depth += opens;
    if (depth > 0 && /^\s*\)/.test(stripped)) depth = Math.max(0, depth - 1);
  }
  return offenders;
}

describe("profile bashrc syntax check", () => {
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

  it("should find profile files to test", () => {
    // `.build/profile_bashrc_*.sh` is no longer committed to the repo — each CI
    // build job emits its own and the test phase rehydrates `.build/` from
    // the per-OS `profile-build-*` artifacts before running this suite.
    //
    // Soft-skip with a warning when none are present (CI or local). In CI this
    // happens during the bootstrap first run after the migration, when the
    // upstream artifacts/release haven't been populated yet — failing the test
    // suite there would be a false negative since the build phase ran fine,
    // there's just nothing to validate yet. Locally it covers fresh clones
    // where the dev hasn't run `make setup_local_full`.
    if (profileFiles.length === 0) {
      console.warn(
        "[profileSyntax] No `.build/profile_bashrc_*.sh` found — skipping profile checks. " +
          "In CI this means the build phase did not produce a profile artifact (check the build jobs). " +
          "Locally, run `make setup_local_full` to generate one for your OS.",
      );
    }
  });
});

describe("Pi plugin setup syntax check", () => {
  it("setup-plugins.sh - no syntax errors", () => {
    assertNoSyntaxErrors(path.join(ROOT_DIR, "software/scripts/advanced/llm/pi/setup-plugins.sh"));
  });
});

describe("bootstrap scripts syntax check", () => {
  bootstrapFiles.forEach((filePath) => {
    it(`${path.basename(filePath)} - no syntax errors`, () => {
      assertNoSyntaxErrors(filePath);
    });

    it(`${path.basename(filePath)} - meets minimum size`, () => {
      const minChars = BOOTSTRAP_SIZE_OVERRIDES[path.basename(filePath)] || MIN_CHARS_BOOTSTRAP;
      assertMinSize(filePath, minChars);
    });
  });

  it("should find bootstrap files to test", () => {
    expect(bootstrapFiles.length).toBeGreaterThan(0);
  });
});

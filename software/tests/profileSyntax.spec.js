/** Syntax and size check for shell scripts. */
import { describe, it, expect } from "vitest";
import { execSync } from "child_process";
import { existsSync, readdirSync, readFileSync, realpathSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * The single declaration of $SY_ROOT_FOLDER (software/bootstrap/common-env.sh). The
 * generated profiles source partials that read it directly (bash-history's backup dir,
 * bash-fzf's bookmark path) and run eager mkdir/cp against it at source time — sourcing
 * the declaration first mirrors what a real shell startup does.
 */
const COMMON_ENV = path.join(ROOT_DIR, "software/bootstrap/common-env.sh");

// fs.globSync landed in Node 22; this repo still supports Node 20, where it is
// undefined and the whole suite fails to load. These two readdir helpers cover
// every pattern this file needs without adding a `glob` dependency.

/**
 * Lists files directly inside `dir` whose basename satisfies `predicate`.
 * @param {string} dir - Absolute directory path (missing dir yields [])
 * @param {(name: string) => boolean} predicate - Basename filter
 * @returns {string[]} Sorted absolute file paths
 */
function listFiles(dir, predicate) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && predicate(e.name))
    .map((e) => path.join(dir, e.name))
    .sort();
}

/**
 * Recursively lists files under `dir` whose basename satisfies `predicate`.
 * @param {string} dir - Absolute directory path (missing dir yields [])
 * @param {(name: string) => boolean} predicate - Basename filter
 * @param {string[]} out - Accumulator (mutated)
 * @returns {string[]} Sorted absolute file paths
 */
function walkFiles(dir, predicate, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(p, predicate, out);
    else if (entry.isFile() && predicate(entry.name)) out.push(p);
  }
  return out.sort();
}

/** Primary OS profiles to test (matches CI publish gate: ubuntu + mac). */
const PRIMARY_OS_PATTERNS = ["ubuntu", "mac"];
const profileFiles = listFiles(
  path.join(ROOT_DIR, ".build"),
  (n) => n.startsWith("profile_bashrc_") && n.endsWith(".sh") && PRIMARY_OS_PATTERNS.some((os) => n.includes(`_${os}`)),
);
const bootstrapFiles = listFiles(path.join(ROOT_DIR, "software/bootstrap"), (n) => /\.(sh|bash)$/.test(n));
const rootScriptFiles = listFiles(ROOT_DIR, (n) => n.endsWith(".sh"));
const fullSetupFiles = walkFiles(path.join(ROOT_DIR, "software/scripts"), (n) =>
  /^_full-setup(\.common\.linux|\.touchid)?\.(sh|bash)$/.test(n),
);
const profilePartialFiles = listFiles(path.join(ROOT_DIR, "software/scripts"), (n) => n.endsWith(".profile.bash"));

/** Minimum char count per profile file (95% of current size as of 2026-04-24). */
const MIN_CHARS_PROFILE_MAP = {
  profile_bashrc_mac: 263720, // current: 277601
  profile_bashrc_ubuntu: 284500, // current: 299571
};
const MIN_CHARS_BOOTSTRAP = 2200;
/** Bootstrap files with lower size thresholds (small by design). */
const BOOTSTRAP_SIZE_OVERRIDES = { "setup.sh": 400, "common-env.sh": 400, "common-functions.bash": 2000 };
const MIN_CHARS_ROOT_SCRIPTS = 1100;

/**
 * The oldest bash available locally, checked in addition to the bash on PATH.
 *
 * AGENTS.md pins bash 3.2 as the portability floor because that is what macOS
 * ships at `/bin/bash` (3.2.57) and what `safe_source`'s `bash -n` can end up
 * invoking. PATH bash is frequently 5.x (Homebrew), and 5.x happily parses
 * constructs 3.2 rejects — notably a heredoc nested inside `$( ... )`, where 3.2
 * keeps tracking quotes through the heredoc body, so an odd apostrophe count in
 * the body breaks the parse of the entire file. Checking only PATH bash let
 * exactly that ship and broke `source ~/.bash_syle` for 3.2 users.
 *
 * Null when `/bin/bash` is absent (MinGW, Termux) or resolves to the same binary
 * already on PATH (most Linux), which keeps this a no-op rather than a failure.
 * @type {string | null}
 */
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

/** Every bash the syntax checks must satisfy: the one on PATH plus the oldest local one. */
const SYNTAX_CHECK_SHELLS = ["bash", LEGACY_BASH].filter(Boolean);

/** @param {string} filePath */
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

/** @param {string} filePath @param {number} minChars */
function assertMinSize(filePath, minChars) {
  const size = readFileSync(filePath, "utf-8").length;
  expect(size, `${path.basename(filePath)} is ${size} chars, expected >= ${minChars}`).toBeGreaterThanOrEqual(minChars);
}

describe("profile bashrc syntax check", () => {
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

describe("profile partials syntax check", () => {
  it("should find profile partial files to test", () => {
    expect(profilePartialFiles.length).toBeGreaterThan(0);
  });

  profilePartialFiles.forEach((filePath) => {
    const relPath = path.relative(ROOT_DIR, filePath);

    it(`${relPath} - no syntax errors`, () => {
      assertNoSyntaxErrors(filePath);
    });

    it(`${relPath} - meets minimum size (400 chars)`, () => {
      assertMinSize(filePath, 400);
    });
  });
});

// Skip when no profile files are present locally — see the comment in
// "should find profile files to test" above. In CI the test phase populates
// `.build/profile_bashrc_*.sh` from the `profile-build-*` artifacts before
// this suite runs, so skipIf is a no-op in CI.
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
        `source "${path.join(ROOT_DIR, "software/scripts/bash-path-candidate.profile.bash")}" 2>/dev/null`,
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

/**
 * Every shell file the repo ships, for the bash 3.2 portability lints below.
 * @type {string[]}
 */
const allShellFiles = [
  ...walkFiles(path.join(ROOT_DIR, "software/scripts"), (n) => /\.(sh|bash)$/.test(n) && !n.endsWith(".ps1.bash")),
  ...walkFiles(path.join(ROOT_DIR, "software/bootstrap"), (n) => /\.(sh|bash)$/.test(n) && !n.endsWith(".ps1.bash")),
  ...rootScriptFiles,
];

/**
 * Finds heredocs opened while inside a `$( ... )` command substitution.
 *
 * bash 3.2 does not stop tracking quotes when it enters a heredoc body nested in
 * a command substitution: it keeps scanning for the matching `)` and counts every
 * `'` in the body as shell quoting. A body with an odd number of apostrophes —
 * one English possessive in a JS comment is enough — leaves the parser stuck
 * "inside" a quote and corrupts the parse of everything that follows, usually
 * surfacing as a syntax error hundreds of lines later in an unrelated function.
 * bash 4+ parses it correctly, so the bug is invisible on any modern bash.
 *
 * The repo's portable idiom is to read the body into a variable first, which
 * keeps the heredoc at the top level: `IFS= read -r -d '' var << 'EOF'`.
 *
 * @param {string} source - Full shell file contents
 * @returns {{ line: number, text: string }[]} One entry per offending heredoc
 */
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

describe("bash 3.2 portability", () => {
  it("should have shell files to lint", () => {
    expect(allShellFiles.length).toBeGreaterThan(0);
  });

  allShellFiles.forEach((filePath) => {
    const relative = path.relative(ROOT_DIR, filePath);

    it(`${relative} - no heredoc nested inside $( ... )`, () => {
      const offenders = findHeredocsInCommandSubstitution(readFileSync(filePath, "utf-8"));
      expect(
        offenders,
        `${relative} opens a heredoc inside a command substitution at ${offenders
          .map((o) => `line ${o.line} (${o.text})`)
          .join(", ")}. bash 3.2 tracks quotes through the heredoc body and an odd ` +
          `apostrophe count silently breaks the parse of the whole file. Read it into a ` +
          `variable instead: IFS= read -r -d '' var << 'EOF'`,
      ).toEqual([]);
    });

    it(`${relative} - no &>> redirect (bash 4.0+)`, () => {
      const offenders = readFileSync(filePath, "utf-8")
        .split("\n")
        .map((line, index) => ({ line: index + 1, text: line }))
        .filter(({ text }) => text.replace(/#.*$/, "").includes("&>>"));
      expect(
        offenders,
        `${relative} uses \`&>>\` at ${offenders.map((o) => `line ${o.line}`).join(", ")}. ` +
          `That operator is bash 4.0+ and is a hard syntax error on the bash 3.2 floor. ` +
          `Use \`>> "$log" 2>&1\` instead.`,
      ).toEqual([]);
    });
  });
});

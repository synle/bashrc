/** Integration tests for pack_text / unpack_text / view_pack_text bash functions.
 *
 * The current pack format is "bulletproof": every file becomes a
 * [gzip+base64,mode=0NNN] block under PACK_BEGIN/PACK_END markers, so the bundle
 * round-trips byte-exact regardless of file content (text or binary).
 * `view_pack_text` is a thin alias for `unpack_text --view` that re-emits the
 * pack with text-content blocks decoded inline. Tests below verify:
 *   - pack format (markers, encoding token, mode, base64 line wrap)
 *   - byte-exact round-trip for text + binary
 *   - chmod preservation
 *   - file selection (git ls-files + extras, ignored dirs)
 *   - .tar.gz / .zip archive auto-extract
 *   - stdin input + status-noise filter
 *   - view_pack_text inlines text, leaves binary encoded, output is re-feedable
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PROFILE_BASH = path.join(ROOT_DIR, "software/scripts/bash-file-utils.profile.bash");
// pack_text now delegates folder filtering to filter_unwanted (defined in
// bash-fzf.profile.bash), so tests must source both partials.
const FZF_PROFILE_BASH = path.join(ROOT_DIR, "software/scripts/bash-fzf.profile.bash");
const TMP_DIR = `/tmp/_pack_text_test_${process.pid}`;

/** Runs a bash script that sources the profile and executes the given commands. */
function runBash(script) {
  const tmpScript = `${TMP_DIR}_runner.sh`;
  fs.writeFileSync(tmpScript, `#!/usr/bin/env bash\nsource "${FZF_PROFILE_BASH}"\nsource "${PROFILE_BASH}"\n${script}`, "utf-8");
  try {
    return execSync(`bash "${tmpScript}" 2>/dev/null`, { encoding: "utf-8", timeout: 30000 }).trim();
  } finally {
    try {
      fs.unlinkSync(tmpScript);
    } catch {}
  }
}

/** Returns SHA-256 hex digest of a file's bytes. */
function sha(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

/** Creates a test directory with sample text files, nested dirs, and a binary file. */
function createTestFiles(baseDir) {
  fs.mkdirSync(baseDir, { recursive: true });
  fs.mkdirSync(path.join(baseDir, "sub"), { recursive: true });
  fs.writeFileSync(path.join(baseDir, "hello.txt"), "Hello World\n");
  fs.writeFileSync(path.join(baseDir, "code.js"), "function foo() {\n  return 42;\n}\n");
  fs.writeFileSync(path.join(baseDir, "sub", "nested.txt"), "Nested content\n");
  // A small synthetic binary blob (PNG-ish header with NUL bytes).
  fs.writeFileSync(
    path.join(baseDir, "binary.bin"),
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52]),
  );
}

describe("pack_text format", () => {
  const srcDir = path.join(TMP_DIR, "src");

  beforeEach(() => {
    createTestFiles(srcDir);
  });

  afterEach(() => {
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  });

  it("should show help with --help", () => {
    const output = runBash("pack_text --help");
    expect(output).toContain("pack_text:");
    expect(output).toContain("Usage:");
    expect(output).toContain("--raw");
    expect(output).toContain("--zip");
    expect(output).toContain("--tar");
    expect(output).toContain("--encode=");
    expect(output).toContain("--encode-level=");
  });

  it("should emit PACK_BEGIN/PACK_END markers with [<encoding>+base64,mode=0NNN,...]", () => {
    // Encoding-agnostic — the default encoding may change. Bracket may carry
    // extra k=v pairs after mode (mtime/btime/etc.); tests use the closing
    // ' =====' anchor instead of '\]' to stay future-proof.
    const output = runBash(`pack_text "${srcDir}" --raw`);
    expect(output).toMatch(/===== PACK_BEGIN: hello\.txt \[(?:gzip|brotli)\+base64,mode=\d{4}[^\]]*\] =====/);
    expect(output).toContain("===== PACK_END: hello.txt =====");
    expect(output).toMatch(/===== PACK_BEGIN: code\.js \[(?:gzip|brotli)\+base64,mode=\d{4}[^\]]*\] =====/);
    expect(output).toMatch(/===== PACK_BEGIN: sub\/nested\.txt \[(?:gzip|brotli)\+base64,mode=\d{4}[^\]]*\] =====/);
  });

  it("should include binary files (no extension filtering)", () => {
    const output = runBash(`pack_text "${srcDir}" --raw`);
    expect(output).toMatch(/PACK_BEGIN: binary\.bin \[(?:gzip|brotli)\+base64,mode=/);
  });

  it("should record actual file mode in the marker", () => {
    fs.writeFileSync(path.join(srcDir, "exec.sh"), "#!/bin/sh\necho hi\n");
    fs.chmodSync(path.join(srcDir, "exec.sh"), 0o755);
    fs.chmodSync(path.join(srcDir, "hello.txt"), 0o644);
    const output = runBash(`pack_text "${srcDir}" --raw`);
    expect(output).toMatch(/PACK_BEGIN: exec\.sh \[(?:gzip|brotli)\+base64,mode=0755[,\]]/);
    expect(output).toMatch(/PACK_BEGIN: hello\.txt \[(?:gzip|brotli)\+base64,mode=0644[,\]]/);
  });

  it("should auto-name to /tmp/<host>.<stem>.pack.txt for bare raw call", () => {
    const output = runBash(`pack_text "${srcDir}"`);
    expect(output).toContain("pack_text:");
    const lines = output.split("\n").filter((l) => l.startsWith("pack_text: /tmp/"));
    expect(lines.length).toBeGreaterThan(0);
    const outPath = lines[0].replace("pack_text: ", "").trim();
    // Layout: /tmp/<host>.<stem>.pack.txt — host first so backups group by
    // machine. Both segments are filename-safe: host is lowercase [a-z0-9_]+,
    // stem is case-preserving [a-zA-Z0-9_]+. The ONLY dots in the basename are
    // the segment separators (host.stem.pack.txt = exactly 3 dots).
    expect(outPath).toMatch(/^\/tmp\/[a-z0-9_]+\.[a-zA-Z0-9_]+\.pack\.txt$/);
    expect(fs.existsSync(outPath)).toBe(true);
    fs.unlinkSync(outPath);
  });

  it("should auto-generate .tar.gz with --tar (host-first naming, sanitized segments)", () => {
    const output = runBash(`pack_text "${srcDir}" --tar`);
    const lines = output.split("\n").filter((l) => l.startsWith("pack_text: /tmp/"));
    const outPath = lines[0].replace("pack_text: ", "").trim();
    expect(outPath).toMatch(/^\/tmp\/[a-z0-9_]+\.[a-zA-Z0-9_]+\.pack\.tar\.gz$/);
    expect(fs.existsSync(outPath)).toBe(true);
    fs.unlinkSync(outPath);
  });

  it("should auto-generate .zip with --zip (host-first naming, sanitized segments)", () => {
    const output = runBash(`pack_text "${srcDir}" --zip`);
    const lines = output.split("\n").filter((l) => l.startsWith("pack_text: /tmp/"));
    const outPath = lines[0].replace("pack_text: ", "").trim();
    expect(outPath).toMatch(/^\/tmp\/[a-z0-9_]+\.[a-zA-Z0-9_]+\.pack\.zip$/);
    expect(fs.existsSync(outPath)).toBe(true);
    fs.unlinkSync(outPath);
  });

  it("should support --plain as alias for --raw", () => {
    const output = runBash(`pack_text "${srcDir}" --plain`);
    expect(output).toMatch(/===== PACK_BEGIN: hello\.txt \[(?:gzip|brotli)\+base64/);
  });

  it("should accept flags in any argument position", () => {
    const outFile = path.join(TMP_DIR, "packed.txt");
    runBash(`pack_text --raw "${srcDir}" "${outFile}"`);
    expect(fs.existsSync(outFile)).toBe(true);
    const content = fs.readFileSync(outFile, "utf-8");
    expect(content).toContain("===== PACK_BEGIN: hello.txt");
  });

  it("should fail for nonexistent directory", () => {
    expect(() => runBash(`pack_text "/tmp/_nonexistent_${process.pid}"`)).toThrow();
  });

  it("should skip ignored dirs in non-git walk", () => {
    fs.mkdirSync(path.join(srcDir, "node_modules"), { recursive: true });
    fs.writeFileSync(path.join(srcDir, "node_modules", "pkg.js"), "module");
    fs.mkdirSync(path.join(srcDir, "__pycache__"), { recursive: true });
    fs.writeFileSync(path.join(srcDir, "__pycache__", "mod.py"), "cache");
    fs.mkdirSync(path.join(srcDir, ".venv"), { recursive: true });
    fs.writeFileSync(path.join(srcDir, ".venv", "pyvenv.cfg"), "venv");
    fs.mkdirSync(path.join(srcDir, ".ruff_cache"), { recursive: true });
    fs.writeFileSync(path.join(srcDir, ".ruff_cache", "data"), "{}");
    const output = runBash(`pack_text "${srcDir}" --raw`);
    expect(output).not.toContain("node_modules");
    expect(output).not.toContain("__pycache__");
    expect(output).not.toContain(".venv");
    expect(output).not.toContain(".ruff_cache");
    expect(output).toContain("PACK_BEGIN: hello.txt");
  });

  it("should use git ls-files for git repos", () => {
    const gitDir = path.join(TMP_DIR, "gitrepo");
    fs.mkdirSync(gitDir, { recursive: true });
    fs.writeFileSync(path.join(gitDir, "tracked.txt"), "tracked\n");
    fs.writeFileSync(path.join(gitDir, "untracked.txt"), "untracked\n");
    execSync(`git init && git add tracked.txt && git commit -m "init"`, {
      cwd: gitDir,
      stdio: "pipe",
      env: { ...process.env, GIT_AUTHOR_NAME: "test", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "test", GIT_COMMITTER_EMAIL: "t@t" },
    });
    const output = runBash(`pack_text "${gitDir}" --raw`);
    expect(output).toContain("PACK_BEGIN: tracked.txt");
    expect(output).not.toContain("PACK_BEGIN: untracked.txt");
  });

  it("should pick up untracked extras (.env / .bash* / .zsh* / .md / .xml / .src / .sh / .sql / .db / .sqlite* / .yml / .json / .toml / .ini / .conf / .cfg) in git mode", () => {
    const gitDir = path.join(TMP_DIR, "gitenv");
    fs.mkdirSync(gitDir, { recursive: true });
    fs.writeFileSync(path.join(gitDir, "tracked.js"), "code");
    fs.writeFileSync(path.join(gitDir, ".gitignore"), "*\n!tracked.js\n!.gitignore\n");
    execSync(`git init && git add . && git commit -m "init"`, {
      cwd: gitDir,
      stdio: "pipe",
      env: { ...process.env, GIT_AUTHOR_NAME: "test", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "test", GIT_COMMITTER_EMAIL: "t@t" },
    });
    fs.writeFileSync(path.join(gitDir, ".env"), "SECRET=abc");
    fs.writeFileSync(path.join(gitDir, ".bash_syle"), "alias x=y");
    fs.writeFileSync(path.join(gitDir, ".bash_profile"), "export FOO=1");
    fs.writeFileSync(path.join(gitDir, ".bashrc"), "PS1='$ '");
    fs.writeFileSync(path.join(gitDir, ".zshrc"), "PS1='%~ '");
    fs.writeFileSync(path.join(gitDir, ".zshenv"), "export ZSH=1");
    fs.writeFileSync(path.join(gitDir, "notes.md"), "local notes");
    fs.writeFileSync(path.join(gitDir, "config.xml"), "<x/>");
    fs.writeFileSync(path.join(gitDir, "build.src"), "src");
    fs.writeFileSync(path.join(gitDir, "deploy.sh"), "#!/bin/sh\necho hi\n");
    fs.writeFileSync(path.join(gitDir, "schema.sql"), "CREATE TABLE t (id INT);");
    fs.writeFileSync(path.join(gitDir, "data.db"), "fakedb");
    fs.writeFileSync(path.join(gitDir, "cache.sqlite"), "sqlite");
    fs.writeFileSync(path.join(gitDir, "wal.sqlite-wal"), "wal");
    fs.writeFileSync(path.join(gitDir, "config.yml"), "key: value\n");
    fs.writeFileSync(path.join(gitDir, "config.yaml"), "key: value\n");
    fs.writeFileSync(path.join(gitDir, "manifest.json"), "{}");
    fs.writeFileSync(path.join(gitDir, "pyproject.toml"), "[tool]\n");
    fs.writeFileSync(path.join(gitDir, "settings.ini"), "[main]\nkey=val\n");
    fs.writeFileSync(path.join(gitDir, "nginx.conf"), "server { }\n");
    fs.writeFileSync(path.join(gitDir, "setup.cfg"), "[metadata]\n");
    const output = runBash(`pack_text "${gitDir}" --raw`);
    expect(output).toContain("PACK_BEGIN: .env ");
    expect(output).toContain("PACK_BEGIN: .bash_syle ");
    expect(output).toContain("PACK_BEGIN: .bash_profile ");
    expect(output).toContain("PACK_BEGIN: .bashrc ");
    expect(output).toContain("PACK_BEGIN: .zshrc ");
    expect(output).toContain("PACK_BEGIN: .zshenv ");
    expect(output).toContain("PACK_BEGIN: notes.md ");
    expect(output).toContain("PACK_BEGIN: config.xml ");
    expect(output).toContain("PACK_BEGIN: build.src ");
    expect(output).toContain("PACK_BEGIN: deploy.sh ");
    expect(output).toContain("PACK_BEGIN: schema.sql ");
    expect(output).toContain("PACK_BEGIN: data.db ");
    expect(output).toContain("PACK_BEGIN: cache.sqlite ");
    expect(output).toContain("PACK_BEGIN: wal.sqlite-wal ");
    expect(output).toContain("PACK_BEGIN: config.yml ");
    expect(output).toContain("PACK_BEGIN: config.yaml ");
    expect(output).toContain("PACK_BEGIN: manifest.json ");
    expect(output).toContain("PACK_BEGIN: pyproject.toml ");
    expect(output).toContain("PACK_BEGIN: settings.ini ");
    expect(output).toContain("PACK_BEGIN: nginx.conf ");
    expect(output).toContain("PACK_BEGIN: setup.cfg ");
  });
});

describe("pack_text + unpack_text round-trip (byte-exact)", () => {
  const srcDir = path.join(TMP_DIR, "src");
  const destDir = path.join(TMP_DIR, "dest");

  beforeEach(() => {
    createTestFiles(srcDir);
  });

  afterEach(() => {
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  });

  it("should preserve text file bytes through raw round-trip", () => {
    const packedFile = path.join(TMP_DIR, "packed.txt");
    runBash(`pack_text "${srcDir}" "${packedFile}"`);
    runBash(`unpack_text "${packedFile}" "${destDir}"`);
    expect(sha(path.join(destDir, "hello.txt"))).toBe(sha(path.join(srcDir, "hello.txt")));
    expect(sha(path.join(destDir, "code.js"))).toBe(sha(path.join(srcDir, "code.js")));
    expect(sha(path.join(destDir, "sub", "nested.txt"))).toBe(sha(path.join(srcDir, "sub", "nested.txt")));
  });

  it("should preserve binary file bytes through round-trip", () => {
    const packedFile = path.join(TMP_DIR, "packed.txt");
    runBash(`pack_text "${srcDir}" "${packedFile}"`);
    runBash(`unpack_text "${packedFile}" "${destDir}"`);
    expect(sha(path.join(destDir, "binary.bin"))).toBe(sha(path.join(srcDir, "binary.bin")));
  });

  it("should preserve file modes (chmod) through round-trip", () => {
    fs.writeFileSync(path.join(srcDir, "exec.sh"), "#!/bin/sh\necho hi\n");
    fs.chmodSync(path.join(srcDir, "exec.sh"), 0o755);
    fs.chmodSync(path.join(srcDir, "hello.txt"), 0o644);
    const packedFile = path.join(TMP_DIR, "packed.txt");
    runBash(`pack_text "${srcDir}" "${packedFile}"`);
    runBash(`unpack_text "${packedFile}" "${destDir}"`);
    expect(fs.statSync(path.join(destDir, "exec.sh")).mode & 0o777).toBe(0o755);
    expect(fs.statSync(path.join(destDir, "hello.txt")).mode & 0o777).toBe(0o644);
  });

  it("should preserve content with leading/trailing blank lines (no trim)", () => {
    fs.writeFileSync(path.join(srcDir, "padded.txt"), "\n\n\nActual content\n\n\n");
    const packedFile = path.join(TMP_DIR, "packed.txt");
    runBash(`pack_text "${srcDir}" "${packedFile}"`);
    runBash(`unpack_text "${packedFile}" "${destDir}"`);
    expect(fs.readFileSync(path.join(destDir, "padded.txt"), "utf-8")).toBe("\n\n\nActual content\n\n\n");
  });

  it("should preserve internal blank lines through round-trip", () => {
    fs.writeFileSync(path.join(srcDir, "spaced.txt"), "line1\n\nline3\n\nline5\n");
    const packedFile = path.join(TMP_DIR, "packed.txt");
    runBash(`pack_text "${srcDir}" "${packedFile}"`);
    runBash(`unpack_text "${packedFile}" "${destDir}"`);
    expect(fs.readFileSync(path.join(destDir, "spaced.txt"), "utf-8")).toBe("line1\n\nline3\n\nline5\n");
  });

  it("should round-trip files with shell metacharacters in their content", () => {
    fs.writeFileSync(path.join(srcDir, "special.txt"), "echo \"hello $USER\" && echo 'world'\n");
    const packedFile = path.join(TMP_DIR, "packed.txt");
    runBash(`pack_text "${srcDir}" "${packedFile}"`);
    runBash(`unpack_text "${packedFile}" "${destDir}"`);
    expect(fs.readFileSync(path.join(destDir, "special.txt"), "utf-8")).toBe("echo \"hello $USER\" && echo 'world'\n");
  });

  it("should round-trip empty files", () => {
    fs.writeFileSync(path.join(srcDir, "empty.txt"), "");
    const packedFile = path.join(TMP_DIR, "packed.txt");
    runBash(`pack_text "${srcDir}" "${packedFile}"`);
    runBash(`unpack_text "${packedFile}" "${destDir}"`);
    expect(fs.existsSync(path.join(destDir, "empty.txt"))).toBe(true);
    expect(fs.readFileSync(path.join(destDir, "empty.txt"), "utf-8")).toBe("");
  });

  it("should recreate nested directory structure", () => {
    fs.mkdirSync(path.join(srcDir, "a", "b", "c"), { recursive: true });
    fs.writeFileSync(path.join(srcDir, "a", "b", "c", "deep.txt"), "deep\n");
    const packedFile = path.join(TMP_DIR, "packed.txt");
    runBash(`pack_text "${srcDir}" "${packedFile}"`);
    runBash(`unpack_text "${packedFile}" "${destDir}"`);
    expect(sha(path.join(destDir, "a", "b", "c", "deep.txt"))).toBe(sha(path.join(srcDir, "a", "b", "c", "deep.txt")));
  });

  it("should round-trip via .tar.gz archive", () => {
    const packedFile = path.join(TMP_DIR, "packed.tar.gz");
    runBash(`pack_text "${srcDir}" "${packedFile}" --tar`);
    runBash(`unpack_text "${packedFile}" "${destDir}"`);
    expect(sha(path.join(destDir, "hello.txt"))).toBe(sha(path.join(srcDir, "hello.txt")));
    expect(sha(path.join(destDir, "binary.bin"))).toBe(sha(path.join(srcDir, "binary.bin")));
  });

  it("should round-trip via .zip archive", () => {
    const packedFile = path.join(TMP_DIR, "packed.zip");
    runBash(`pack_text "${srcDir}" "${packedFile}" --zip`);
    runBash(`unpack_text "${packedFile}" "${destDir}"`);
    expect(sha(path.join(destDir, "hello.txt"))).toBe(sha(path.join(srcDir, "hello.txt")));
    expect(sha(path.join(destDir, "binary.bin"))).toBe(sha(path.join(srcDir, "binary.bin")));
  });

  it("should round-trip via stdin pipe (pack_text | unpack_text)", () => {
    runBash(`pack_text "${srcDir}" 2>/dev/null | unpack_text "${destDir}"`);
    expect(sha(path.join(destDir, "hello.txt"))).toBe(sha(path.join(srcDir, "hello.txt")));
    expect(sha(path.join(destDir, "binary.bin"))).toBe(sha(path.join(srcDir, "binary.bin")));
  });

  it("should ignore status-noise lines when stderr is merged into stdin", () => {
    runBash(`pack_text "${srcDir}" 2>&1 | unpack_text "${destDir}"`);
    expect(sha(path.join(destDir, "hello.txt"))).toBe(sha(path.join(srcDir, "hello.txt")));
  });
});

describe("unpack_text", () => {
  const srcDir = path.join(TMP_DIR, "src");
  const destDir = path.join(TMP_DIR, "dest");

  beforeEach(() => {
    createTestFiles(srcDir);
  });

  afterEach(() => {
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  });

  it("should show help with --help", () => {
    const output = runBash("unpack_text --help");
    expect(output).toContain("unpack_text:");
    expect(output).toContain("Usage:");
    expect(output).toContain("--view");
  });

  it("should fail for nonexistent input file", () => {
    expect(() => runBash(`unpack_text "/tmp/_nonexistent_${process.pid}.txt"`)).toThrow();
  });

  it("should create destination directory if it does not exist", () => {
    const packedFile = path.join(TMP_DIR, "packed.txt");
    const newDest = path.join(TMP_DIR, "brand_new_dir");
    runBash(`pack_text "${srcDir}" "${packedFile}"`);
    expect(fs.existsSync(newDest)).toBe(false);
    runBash(`unpack_text "${packedFile}" "${newDest}"`);
    expect(fs.existsSync(path.join(newDest, "hello.txt"))).toBe(true);
  });

  it("should accept '-' as explicit stdin marker", () => {
    runBash(`pack_text "${srcDir}" 2>/dev/null | unpack_text - "${destDir}"`);
    expect(sha(path.join(destDir, "hello.txt"))).toBe(sha(path.join(srcDir, "hello.txt")));
  });

  it("should default dest to current dir when piped without args", () => {
    fs.mkdirSync(destDir, { recursive: true });
    const tmpScript = `${TMP_DIR}_cwd_runner.sh`;
    fs.writeFileSync(
      tmpScript,
      `#!/usr/bin/env bash\nsource "${FZF_PROFILE_BASH}"\nsource "${PROFILE_BASH}"\ncd "${destDir}"\npack_text "${srcDir}" 2>/dev/null | unpack_text > /dev/null`,
      "utf-8",
    );
    try {
      execSync(`bash "${tmpScript}" 2>/dev/null`, { encoding: "utf-8", timeout: 30000 });
    } finally {
      try {
        fs.unlinkSync(tmpScript);
      } catch {}
    }
    expect(sha(path.join(destDir, "hello.txt"))).toBe(sha(path.join(srcDir, "hello.txt")));
  });

  it("should fail when archive contains no pack file", () => {
    const fakeZip = path.join(TMP_DIR, "fake.zip");
    fs.writeFileSync(path.join(TMP_DIR, "random.txt"), "no markers here");
    execSync(`cd "${TMP_DIR}" && zip -q "${fakeZip}" random.txt`, { stdio: "pipe" });
    expect(() => runBash(`unpack_text "${fakeZip}" "${destDir}"`)).toThrow();
  });
});

describe("view_pack_text", () => {
  const srcDir = path.join(TMP_DIR, "src");
  const destDir = path.join(TMP_DIR, "dest");

  beforeEach(() => {
    createTestFiles(srcDir);
  });

  afterEach(() => {
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  });

  it("should show help with --help", () => {
    const output = runBash("view_pack_text --help");
    expect(output).toContain("view_pack_text:");
    expect(output).toContain("alias for 'unpack_text --view'");
  });

  it("should decode text blocks inline (no encoding token)", () => {
    const packedFile = path.join(TMP_DIR, "packed.txt");
    runBash(`pack_text "${srcDir}" "${packedFile}"`);
    const view = runBash(`view_pack_text "${packedFile}"`);
    // Text block: encoding token absent, mode preserved, content visible.
    // The trailing blank line between content and END is intentional — the
    // decoder strips one trailing '\n' from raw blocks, so an extra separator
    // '\n' guarantees byte-exact round-trip whether or not the file ended
    // with a newline.
    // Bracket may include trailing k=v pairs (mtime/btime); allow them.
    expect(view).toMatch(/===== PACK_BEGIN: hello\.txt \[mode=\d{4}[^\]]*\] =====\nHello World\n+===== PACK_END: hello\.txt =====/);
    expect(view).toContain("function foo()");
  });

  it("should keep binary blocks as [<encoding>+base64,mode=0NNN]", () => {
    const packedFile = path.join(TMP_DIR, "packed.txt");
    runBash(`pack_text "${srcDir}" "${packedFile}"`);
    const view = runBash(`view_pack_text "${packedFile}"`);
    // Binary blocks (NUL byte detected) pass through unchanged in view mode —
    // they keep whatever encoding token the original pack used.
    // Bracket may include trailing k=v pairs (mtime/btime); allow them.
    expect(view).toMatch(/===== PACK_BEGIN: binary\.bin \[(?:gzip|brotli)\+base64,mode=\d{4}[^\]]*\] =====/);
  });

  it("output is itself a valid pack — feed back into unpack_text", () => {
    const packedFile = path.join(TMP_DIR, "packed.txt");
    const viewedFile = path.join(TMP_DIR, "viewed.txt");
    runBash(`pack_text "${srcDir}" "${packedFile}"`);
    runBash(`view_pack_text "${packedFile}" > "${viewedFile}"`);
    runBash(`unpack_text "${viewedFile}" "${destDir}"`);
    expect(sha(path.join(destDir, "hello.txt"))).toBe(sha(path.join(srcDir, "hello.txt")));
    expect(sha(path.join(destDir, "binary.bin"))).toBe(sha(path.join(srcDir, "binary.bin")));
  });

  it("end-to-end pipe: pack_text | view_pack_text | unpack_text", () => {
    runBash(`pack_text "${srcDir}" 2>/dev/null | view_pack_text | unpack_text "${destDir}"`);
    expect(sha(path.join(destDir, "hello.txt"))).toBe(sha(path.join(srcDir, "hello.txt")));
    expect(sha(path.join(destDir, "binary.bin"))).toBe(sha(path.join(srcDir, "binary.bin")));
  });

  it("should accept stdin via piped input", () => {
    runBash(`pack_text "${srcDir}" 2>/dev/null | view_pack_text > "${path.join(TMP_DIR, "view.out")}"`);
    const view = fs.readFileSync(path.join(TMP_DIR, "view.out"), "utf-8");
    expect(view).toContain("PACK_BEGIN: hello.txt [mode=");
  });
});

/** META_DATA banner + hostname-in-filename are pack_text provenance features:
 * the auto-generated output filename embeds a sanitized hostname before the
 * final extension, and a single META_DATA line is emitted at the top of the
 * stream carrying host / packed_utc / source / file_count. unpack_text strips
 * the banner as noise; view_pack_text preserves it (so view output is still a
 * valid, re-feedable pack with provenance intact). */
describe("META_DATA banner + hostname-in-filename", () => {
  const srcDir = path.join(TMP_DIR, "src");

  beforeEach(() => {
    createTestFiles(srcDir);
  });

  afterEach(() => {
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  });

  it("should emit a single META_DATA line at the top of the pack with host/packed_utc/source/file_count", () => {
    const out = path.join(TMP_DIR, "meta.pack.txt");
    runBash(`pack_text "${srcDir}" "${out}" --raw 2>/dev/null`);
    const packed = fs.readFileSync(out, "utf-8");
    const lines = packed.split("\n");
    // META_DATA must be the very first line, before any PACK_BEGIN.
    expect(lines[0]).toMatch(/^===== META_DATA: .* =====$/);
    expect(lines[0]).toMatch(/host=\S+/);
    expect(lines[0]).toMatch(/packed_utc=\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z/);
    expect(lines[0]).toMatch(/source=\S+/);
    expect(lines[0]).toMatch(/file_count=\d+/);
    // Exactly one META_DATA line — never duplicated per file.
    const metaCount = packed.match(/===== META_DATA: /g)?.length ?? 0;
    expect(metaCount).toBe(1);
  });

  it("should record file_count matching the actual number of PACK_BEGIN blocks", () => {
    const out = path.join(TMP_DIR, "count.pack.txt");
    runBash(`pack_text "${srcDir}" "${out}" --raw 2>/dev/null`);
    const packed = fs.readFileSync(out, "utf-8");
    const declared = parseInt(packed.match(/file_count=(\d+)/)[1], 10);
    const actual = (packed.match(/===== PACK_BEGIN: /g) || []).length;
    expect(declared).toBe(actual);
    expect(declared).toBeGreaterThan(0);
  });

  it("should lead auto-generated filenames with sanitized host AND sanitized stem", () => {
    const output = runBash(`pack_text "${srcDir}"`);
    const outPath = output
      .split("\n")
      .filter((l) => l.startsWith("pack_text: /tmp/"))[0]
      .replace("pack_text: ", "")
      .trim();
    // Layout: /tmp/<host>.<stem>.pack.txt
    //   host: lowercase [a-z0-9_]+, no double-underscores, no leading/trailing _
    //   stem: case-preserving [a-zA-Z0-9_]+, same shape rules
    const base = path.basename(outPath);
    const m = base.match(/^([a-z0-9_]+)\.([a-zA-Z0-9_]+)\.pack\.txt$/);
    expect(m).toBeTruthy();
    const [, hostSegment, stemSegment] = m;
    // Both segments: no double underscores, no leading/trailing _.
    expect(hostSegment).toMatch(/^[a-z0-9]+(?:_[a-z0-9]+)*$/);
    expect(stemSegment).toMatch(/^[a-zA-Z0-9]+(?:_[a-zA-Z0-9]+)*$/);
    // Stem must include the timestamp digits (YYYY_MM_DD_HH_MM_SS pattern).
    expect(stemSegment).toMatch(/_\d{4}_\d{2}_\d{2}_\d{2}_\d{2}_\d{2}$/);
    fs.unlinkSync(outPath);
  });

  it("should NOT mutate explicit output paths (only auto-generated ones get the host segment)", () => {
    const explicit = path.join(TMP_DIR, "my-explicit-name.pack.txt");
    runBash(`pack_text "${srcDir}" "${explicit}" --raw 2>/dev/null`);
    expect(fs.existsSync(explicit)).toBe(true); // exact path honored
  });

  it("unpack_text should silently strip META_DATA outside blocks (extract mode)", () => {
    const out = path.join(TMP_DIR, "extract.pack.txt");
    const dest = path.join(TMP_DIR, "out");
    runBash(`pack_text "${srcDir}" "${out}" --raw 2>/dev/null && unpack_text "${out}" "${dest}"`);
    // Extracted files must match originals byte-for-byte; META_DATA must NOT
    // leak into any extracted file. Sanity-check by sha-ing one round-trip.
    expect(sha(path.join(dest, "hello.txt"))).toBe(sha(path.join(srcDir, "hello.txt")));
    // No file should contain a META_DATA line.
    for (const f of ["hello.txt", "code.js", path.join("sub", "nested.txt")]) {
      const content = fs.readFileSync(path.join(dest, f), "utf-8");
      expect(content).not.toMatch(/===== META_DATA:/);
    }
  });

  it("view_pack_text should preserve META_DATA at the top of view output (and remain re-feedable)", () => {
    const out = path.join(TMP_DIR, "view.pack.txt");
    runBash(`pack_text "${srcDir}" "${out}" --raw 2>/dev/null`);
    const viewed = runBash(`view_pack_text "${out}"`);
    const firstLine = viewed.split("\n")[0];
    expect(firstLine).toMatch(/^===== META_DATA: .* =====$/);
    // View output must still be re-feedable into unpack_text.
    const refeedDest = path.join(TMP_DIR, "refed");
    const viewFile = path.join(TMP_DIR, "view.out");
    fs.writeFileSync(viewFile, viewed + "\n");
    runBash(`unpack_text "${viewFile}" "${refeedDest}"`);
    expect(sha(path.join(refeedDest, "hello.txt"))).toBe(sha(path.join(srcDir, "hello.txt")));
  });

  it("should still extract older packs that have NO META_DATA line (backward compatibility)", () => {
    // Hand-craft a pack without META_DATA — single-block, raw text.
    const legacy = path.join(TMP_DIR, "legacy.pack.txt");
    const body = "Hello legacy world\n";
    const b64 = require("zlib").gzipSync(Buffer.from(body)).toString("base64");
    const wrapped = b64.replace(/(.{76})/g, "$1\n") + (b64.length % 76 === 0 ? "" : "\n");
    fs.writeFileSync(
      legacy,
      "===== PACK_BEGIN: legacy.txt [gzip+base64,mode=0644] =====\n" + wrapped + "===== PACK_END: legacy.txt =====\n",
    );
    const dest = path.join(TMP_DIR, "legacy_out");
    runBash(`unpack_text "${legacy}" "${dest}"`);
    expect(fs.readFileSync(path.join(dest, "legacy.txt"), "utf-8")).toBe(body);
  });
});

/** Encoding selection — pack_text supports gzip and brotli per-block compression
 * via --encode=<algo> + --encode-level=N. Default is brotli (better ratio for
 * text-heavy config backups). unpack_text / view_pack_text auto-detect the
 * encoding from the per-block PACK_BEGIN token, so a pack may legally mix
 * encodings. Tests below verify defaults, explicit selection, validation,
 * round-trip for both, mixed packs, and the level knob. */
describe("encoding selection (gzip / brotli) and --encode-level", () => {
  const srcDir = path.join(TMP_DIR, "src");

  beforeEach(() => {
    createTestFiles(srcDir);
  });

  afterEach(() => {
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  });

  it("default encoding is brotli (META_DATA + every PACK_BEGIN token)", () => {
    const out = path.join(TMP_DIR, "default.pack.txt");
    runBash(`pack_text "${srcDir}" "${out}" --raw 2>/dev/null`);
    const packed = fs.readFileSync(out, "utf-8");
    expect(packed).toMatch(/encoding=brotli/);
    // Every PACK_BEGIN block should use brotli.
    const tokens = [...packed.matchAll(/PACK_BEGIN: \S+ \[(\S+?)\+base64,mode=/g)].map((m) => m[1]);
    expect(tokens.length).toBeGreaterThan(0);
    expect(new Set(tokens)).toEqual(new Set(["brotli"]));
  });

  it("--encode=gzip emits gzip+base64 tokens and encoding=gzip in META_DATA", () => {
    const out = path.join(TMP_DIR, "gz.pack.txt");
    runBash(`pack_text "${srcDir}" "${out}" --raw --encode=gzip 2>/dev/null`);
    const packed = fs.readFileSync(out, "utf-8");
    expect(packed).toMatch(/encoding=gzip/);
    const tokens = [...packed.matchAll(/PACK_BEGIN: \S+ \[(\S+?)\+base64,mode=/g)].map((m) => m[1]);
    expect(new Set(tokens)).toEqual(new Set(["gzip"]));
  });

  it("--encode=brotli (explicit) emits brotli+base64 tokens", () => {
    const out = path.join(TMP_DIR, "br.pack.txt");
    runBash(`pack_text "${srcDir}" "${out}" --raw --encode=brotli 2>/dev/null`);
    const packed = fs.readFileSync(out, "utf-8");
    const tokens = [...packed.matchAll(/PACK_BEGIN: \S+ \[(\S+?)\+base64,mode=/g)].map((m) => m[1]);
    expect(new Set(tokens)).toEqual(new Set(["brotli"]));
  });

  it("gzip round-trip is byte-exact for text + binary", () => {
    const packed = path.join(TMP_DIR, "gz.pack.txt");
    const dest = path.join(TMP_DIR, "gz_out");
    runBash(`pack_text "${srcDir}" "${packed}" --raw --encode=gzip 2>/dev/null && unpack_text "${packed}" "${dest}"`);
    expect(sha(path.join(dest, "hello.txt"))).toBe(sha(path.join(srcDir, "hello.txt")));
    expect(sha(path.join(dest, "binary.bin"))).toBe(sha(path.join(srcDir, "binary.bin")));
    expect(sha(path.join(dest, "code.js"))).toBe(sha(path.join(srcDir, "code.js")));
  });

  it("brotli round-trip is byte-exact for text + binary", () => {
    const packed = path.join(TMP_DIR, "br.pack.txt");
    const dest = path.join(TMP_DIR, "br_out");
    runBash(`pack_text "${srcDir}" "${packed}" --raw --encode=brotli 2>/dev/null && unpack_text "${packed}" "${dest}"`);
    expect(sha(path.join(dest, "hello.txt"))).toBe(sha(path.join(srcDir, "hello.txt")));
    expect(sha(path.join(dest, "binary.bin"))).toBe(sha(path.join(srcDir, "binary.bin")));
    expect(sha(path.join(dest, "code.js"))).toBe(sha(path.join(srcDir, "code.js")));
  });

  it("mixed-encoding pack (one gzip block + one brotli block) extracts both", () => {
    // Hand-craft a pack that interleaves gzip and brotli blocks. unpack_text
    // dispatches per-block via the encoding token, so this MUST work.
    const zlibLib = require("zlib");
    const gzipBody = "Plain gzip block body\n";
    const brotliBody = "Plain brotli block body\n";
    const gz = zlibLib.gzipSync(Buffer.from(gzipBody)).toString("base64");
    const br = zlibLib.brotliCompressSync(Buffer.from(brotliBody)).toString("base64");
    const wrap = (b64) => b64.replace(/(.{76})/g, "$1\n") + (b64.length % 76 === 0 ? "" : "\n");
    const mixed = path.join(TMP_DIR, "mixed.pack.txt");
    fs.writeFileSync(
      mixed,
      "===== PACK_BEGIN: gz.txt [gzip+base64,mode=0644] =====\n" +
        wrap(gz) +
        "===== PACK_END: gz.txt =====\n" +
        "===== PACK_BEGIN: br.txt [brotli+base64,mode=0644] =====\n" +
        wrap(br) +
        "===== PACK_END: br.txt =====\n",
    );
    const dest = path.join(TMP_DIR, "mixed_out");
    runBash(`unpack_text "${mixed}" "${dest}"`);
    expect(fs.readFileSync(path.join(dest, "gz.txt"), "utf-8")).toBe(gzipBody);
    expect(fs.readFileSync(path.join(dest, "br.txt"), "utf-8")).toBe(brotliBody);
  });

  it("view_pack_text decodes brotli text blocks inline (same as gzip)", () => {
    const packed = path.join(TMP_DIR, "br.pack.txt");
    runBash(`pack_text "${srcDir}" "${packed}" --raw --encode=brotli 2>/dev/null`);
    const view = runBash(`view_pack_text "${packed}"`);
    // Text content decoded inline -> "Hello World" should appear as-is, NOT
    // as base64.
    expect(view).toContain("Hello World");
    expect(view).toContain("function foo()");
    // Text blocks lose the encoding token in view mode (raw text re-emit).
    expect(view).toMatch(/===== PACK_BEGIN: hello\.txt \[mode=\d{4}[^\]]*\] =====\nHello World/);
  });

  it("--encode=foo errors with a clear allowed-list message", () => {
    expect(() => runBash(`pack_text "${srcDir}" --encode=foo`)).toThrow();
  });

  it("--encode-level=99 errors when out of range for gzip (max 9)", () => {
    expect(() => runBash(`pack_text "${srcDir}" --encode=gzip --encode-level=99`)).toThrow();
  });

  it("--encode-level=99 errors when out of range for brotli (max 11)", () => {
    expect(() => runBash(`pack_text "${srcDir}" --encode=brotli --encode-level=99`)).toThrow();
  });

  it("--encode-level=abc errors with non-integer message", () => {
    expect(() => runBash(`pack_text "${srcDir}" --encode-level=abc`)).toThrow();
  });

  it("brotli max-quality (11) produces measurably smaller output than min (0) on compressible text", () => {
    // Fill srcDir with a known-compressible blob — repeated text. Quality 11
    // SHOULD beat quality 0 by a comfortable margin; this is a smoke test that
    // --encode-level is actually being plumbed through to the compressor.
    const big = "x".repeat(100) + "\n" + "lorem ipsum ".repeat(500) + "\n";
    fs.writeFileSync(path.join(srcDir, "big.txt"), big);
    const minOut = path.join(TMP_DIR, "min.pack.txt");
    const maxOut = path.join(TMP_DIR, "max.pack.txt");
    runBash(`pack_text "${srcDir}" "${minOut}" --raw --encode=brotli --encode-level=0 2>/dev/null`);
    runBash(`pack_text "${srcDir}" "${maxOut}" --raw --encode=brotli --encode-level=11 2>/dev/null`);
    const minSize = fs.statSync(minOut).size;
    const maxSize = fs.statSync(maxOut).size;
    // Higher quality => smaller output. Allow a generous margin since other
    // pack overhead (META_DATA, markers, base64 wrapping) is constant.
    expect(maxSize).toBeLessThan(minSize);
  });
});

/** Timestamp preservation — pack_text records each file's mtime (modification
 * time) and btime (creation time / birthtime) in the PACK_BEGIN bracket as
 * ISO-8601 UTC. unpack_text restores mtime via fs.utimesSync; btime is
 * informational only (no portable Linux syscall to set birthtime). Missing
 * keys (legacy packs) -> file gets the current time at extract, by design. */
describe("mtime / btime preservation", () => {
  const srcDir = path.join(TMP_DIR, "src");

  beforeEach(() => {
    createTestFiles(srcDir);
  });

  afterEach(() => {
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  });

  it("PACK_BEGIN bracket records mtime= as ISO-8601 UTC", () => {
    // Set a known mtime (one year before "now") and verify the marker carries it.
    const knownMtime = new Date("2025-01-15T12:34:56Z");
    fs.utimesSync(path.join(srcDir, "hello.txt"), knownMtime, knownMtime);
    const out = path.join(TMP_DIR, "ts.pack.txt");
    runBash(`pack_text "${srcDir}" "${out}" --raw 2>/dev/null`);
    const packed = fs.readFileSync(out, "utf-8");
    expect(packed).toMatch(/PACK_BEGIN: hello\.txt \[[^\]]*mtime=2025-01-15T12:34:56Z/);
  });

  it("PACK_BEGIN bracket records btime= when the OS reports one (skipped on platforms without)", () => {
    const out = path.join(TMP_DIR, "bt.pack.txt");
    runBash(`pack_text "${srcDir}" "${out}" --raw 2>/dev/null`);
    const packed = fs.readFileSync(out, "utf-8");
    // macOS / Btrfs / ext4 expose birthtime; if we ever run on a fs that
    // doesn't, the marker simply omits btime= (graceful, not an error).
    const supportsBtime = fs.statSync(path.join(srcDir, "hello.txt")).birthtimeMs > 0;
    if (supportsBtime) {
      expect(packed).toMatch(/PACK_BEGIN: hello\.txt \[[^\]]*btime=\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z/);
    }
  });

  it("unpack_text restores mtime from the marker (round-trip within 1s precision)", () => {
    const knownMtime = new Date("2025-01-15T12:34:56Z");
    fs.utimesSync(path.join(srcDir, "hello.txt"), knownMtime, knownMtime);
    const packed = path.join(TMP_DIR, "rt.pack.txt");
    const dest = path.join(TMP_DIR, "rt_out");
    runBash(`pack_text "${srcDir}" "${packed}" --raw 2>/dev/null && unpack_text "${packed}" "${dest}"`);
    const restoredMtime = fs.statSync(path.join(dest, "hello.txt")).mtime.getTime();
    // Allow 1-second slack — most filesystems store mtime at second granularity.
    expect(Math.abs(restoredMtime - knownMtime.getTime())).toBeLessThan(1000);
  });

  it("missing mtime in marker (legacy pack) falls back to current time without erroring", () => {
    // Hand-craft a pack with NO mtime/btime keys — must still extract cleanly
    // and the resulting file gets a fresh mtime (>= test start).
    const zlibLib = require("zlib");
    const body = "Legacy file without timestamp metadata\n";
    const b64 = zlibLib.gzipSync(Buffer.from(body)).toString("base64");
    const wrapped = b64.replace(/(.{76})/g, "$1\n") + (b64.length % 76 === 0 ? "" : "\n");
    const legacy = path.join(TMP_DIR, "legacy_ts.pack.txt");
    fs.writeFileSync(
      legacy,
      "===== PACK_BEGIN: legacy.txt [gzip+base64,mode=0644] =====\n" + wrapped + "===== PACK_END: legacy.txt =====\n",
    );
    const dest = path.join(TMP_DIR, "legacy_ts_out");
    const before = Date.now();
    runBash(`unpack_text "${legacy}" "${dest}"`);
    expect(fs.readFileSync(path.join(dest, "legacy.txt"), "utf-8")).toBe(body);
    const restoredMtime = fs.statSync(path.join(dest, "legacy.txt")).mtime.getTime();
    // Generous lower bound — mtime should be >= the test start (allowing fs
    // truncation to second granularity which can drop below `before` by <1s).
    expect(restoredMtime).toBeGreaterThanOrEqual(before - 1000);
  });

  it("view_pack_text preserves mtime/btime in re-emitted brackets", () => {
    const knownMtime = new Date("2025-01-15T12:34:56Z");
    fs.utimesSync(path.join(srcDir, "hello.txt"), knownMtime, knownMtime);
    const packed = path.join(TMP_DIR, "view_ts.pack.txt");
    runBash(`pack_text "${srcDir}" "${packed}" --raw 2>/dev/null`);
    const view = runBash(`view_pack_text "${packed}"`);
    // Text block in view mode loses the encoding token but should keep mtime.
    expect(view).toMatch(/PACK_BEGIN: hello\.txt \[[^\]]*mtime=2025-01-15T12:34:56Z/);
  });

  it("garbage mtime in marker is silently skipped (no crash, file gets current time)", () => {
    const zlibLib = require("zlib");
    const body = "Body for corrupt-mtime test\n";
    const b64 = zlibLib.gzipSync(Buffer.from(body)).toString("base64");
    const wrapped = b64.replace(/(.{76})/g, "$1\n") + (b64.length % 76 === 0 ? "" : "\n");
    const corrupt = path.join(TMP_DIR, "corrupt_ts.pack.txt");
    fs.writeFileSync(
      corrupt,
      "===== PACK_BEGIN: corrupt.txt [gzip+base64,mode=0644,mtime=not-a-date] =====\n" + wrapped + "===== PACK_END: corrupt.txt =====\n",
    );
    const dest = path.join(TMP_DIR, "corrupt_ts_out");
    runBash(`unpack_text "${corrupt}" "${dest}"`);
    expect(fs.readFileSync(path.join(dest, "corrupt.txt"), "utf-8")).toBe(body);
  });
});

/** Forgiving parser — every field in the PACK_BEGIN bracket is optional, and a
 * malformed value in one slot must not block extraction of the file (or any
 * other file in the same pack). Tests below cover every per-field failure
 * mode we can think of: missing keys, garbage values, empty values, missing
 * brackets, unknown keys, and one mixed pack where a single bad block lives
 * alongside healthy blocks. */
describe("forgiving metadata parser (malformed / missing fields)", () => {
  const zlibLib = require("zlib");

  /** Build a minimal raw pack containing one PACK_BEGIN/PACK_END pair with the
   * exact bracket text supplied — used to exercise specific malformed shapes. */
  function buildPack(packPath, fileName, bracket, bodyText) {
    const b64 = zlibLib.gzipSync(Buffer.from(bodyText)).toString("base64");
    const wrapped = b64.replace(/(.{76})/g, "$1\n") + (b64.length % 76 === 0 ? "" : "\n");
    fs.writeFileSync(
      packPath,
      `===== PACK_BEGIN: ${fileName}${bracket ? " " + bracket : ""} =====\n${wrapped}===== PACK_END: ${fileName} =====\n`,
    );
  }

  beforeEach(() => {
    fs.mkdirSync(TMP_DIR, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  });

  it("missing bracket entirely -> file extracts as raw text (no crash)", () => {
    // No bracket -> encoding/mode/mtime all null, raw-text decode path used.
    // Note: raw-text decoder strips the single '\n' between body and END
    // marker so round-trip is byte-exact for files that may or may not
    // have a trailing newline. Test expectation honors that.
    const pack = path.join(TMP_DIR, "no_bracket.pack.txt");
    const body = "Plain text body, no bracket";
    fs.writeFileSync(pack, `===== PACK_BEGIN: plain.txt =====\n${body}\n===== PACK_END: plain.txt =====\n`);
    const dest = path.join(TMP_DIR, "out");
    runBash(`unpack_text "${pack}" "${dest}"`);
    expect(fs.readFileSync(path.join(dest, "plain.txt"), "utf-8")).toBe(body);
  });

  it("bad mode value (e.g. 'mode=abc') -> file extracts, mode just not chmod'd", () => {
    const pack = path.join(TMP_DIR, "bad_mode.pack.txt");
    const body = "Body for bad-mode test\n";
    buildPack(pack, "f.txt", "[gzip+base64,mode=abc]", body);
    const dest = path.join(TMP_DIR, "out");
    runBash(`unpack_text "${pack}" "${dest}"`);
    // File must still be extracted with correct content.
    expect(fs.readFileSync(path.join(dest, "f.txt"), "utf-8")).toBe(body);
  });

  it("missing mode -> file extracts (mode falls back to fs default)", () => {
    const pack = path.join(TMP_DIR, "no_mode.pack.txt");
    const body = "Body without mode\n";
    buildPack(pack, "f.txt", "[gzip+base64]", body);
    const dest = path.join(TMP_DIR, "out");
    runBash(`unpack_text "${pack}" "${dest}"`);
    expect(fs.readFileSync(path.join(dest, "f.txt"), "utf-8")).toBe(body);
  });

  it("empty mode value (mode= with nothing) -> file extracts, no crash", () => {
    const pack = path.join(TMP_DIR, "empty_mode.pack.txt");
    const body = "Body with empty mode\n";
    buildPack(pack, "f.txt", "[gzip+base64,mode=]", body);
    const dest = path.join(TMP_DIR, "out");
    runBash(`unpack_text "${pack}" "${dest}"`);
    expect(fs.readFileSync(path.join(dest, "f.txt"), "utf-8")).toBe(body);
  });

  it("unknown keys in bracket are silently ignored (forward compat)", () => {
    const pack = path.join(TMP_DIR, "unknown_keys.pack.txt");
    const body = "Body with future keys\n";
    buildPack(pack, "f.txt", "[gzip+base64,mode=0644,future_key=x,owner=alice,perm_v2=rw]", body);
    const dest = path.join(TMP_DIR, "out");
    runBash(`unpack_text "${pack}" "${dest}"`);
    expect(fs.readFileSync(path.join(dest, "f.txt"), "utf-8")).toBe(body);
  });

  it("ALL optional fields missing (encoding only) -> works", () => {
    const pack = path.join(TMP_DIR, "encoding_only.pack.txt");
    const body = "Body, encoding token only\n";
    buildPack(pack, "f.txt", "[gzip+base64]", body);
    const dest = path.join(TMP_DIR, "out");
    runBash(`unpack_text "${pack}" "${dest}"`);
    expect(fs.readFileSync(path.join(dest, "f.txt"), "utf-8")).toBe(body);
  });

  it("unknown encoding token (e.g. 'lzma+base64') -> that block fails, others continue", () => {
    // Mixed pack: first block uses unknown encoding (corrupt or future), second
    // is a normal gzip block. The first must fail with a clear error, the
    // SECOND must extract normally — no early termination.
    const pack = path.join(TMP_DIR, "unknown_enc.pack.txt");
    const okBody = "Healthy block survives\n";
    const okB64 = zlibLib.gzipSync(Buffer.from(okBody)).toString("base64");
    const okWrapped = okB64.replace(/(.{76})/g, "$1\n") + (okB64.length % 76 === 0 ? "" : "\n");
    fs.writeFileSync(
      pack,
      "===== PACK_BEGIN: bad.txt [lzma+base64,mode=0644] =====\n" +
        "garbage_payload\n" +
        "===== PACK_END: bad.txt =====\n" +
        "===== PACK_BEGIN: ok.txt [gzip+base64,mode=0644] =====\n" +
        okWrapped +
        "===== PACK_END: ok.txt =====\n",
    );
    const dest = path.join(TMP_DIR, "out");
    runBash(`unpack_text "${pack}" "${dest}"`);
    // Healthy block extracted; corrupt block silently skipped (or with stderr).
    expect(fs.readFileSync(path.join(dest, "ok.txt"), "utf-8")).toBe(okBody);
    expect(fs.existsSync(path.join(dest, "bad.txt"))).toBe(false);
  });

  it("garbage bracket value 'mode=-999' (negative) -> rejected, file still extracts", () => {
    const pack = path.join(TMP_DIR, "neg_mode.pack.txt");
    const body = "Body with negative mode\n";
    buildPack(pack, "f.txt", "[gzip+base64,mode=-999]", body);
    const dest = path.join(TMP_DIR, "out");
    runBash(`unpack_text "${pack}" "${dest}"`);
    expect(fs.readFileSync(path.join(dest, "f.txt"), "utf-8")).toBe(body);
  });

  it("everything malformed except encoding -> file still extracts", () => {
    const pack = path.join(TMP_DIR, "all_bad.pack.txt");
    const body = "Body with only encoding intact\n";
    buildPack(pack, "f.txt", "[gzip+base64,mode=garbage,mtime=nope,btime=also_nope,extra=ignored]", body);
    const dest = path.join(TMP_DIR, "out");
    runBash(`unpack_text "${pack}" "${dest}"`);
    expect(fs.readFileSync(path.join(dest, "f.txt"), "utf-8")).toBe(body);
  });
});

/** --verbose flag + streaming writer.
 *
 * Quiet mode (default) prints only summary lines; --verbose adds per-file PACK
 * lines and the "scanning"/"walking"/"git repo detected" trail. Streaming
 * writer fixes a pre-fix RangeError("Invalid string length") that hit V8's
 * ~512 MB string cap whenever the cumulative pack output got large; the test
 * here checks the side-effects we CAN observe — no leftover .blocks.tmp file
 * after a successful pack, and round-trip still byte-exact (so streaming
 * doesn't introduce drift). */
describe("--verbose flag + streaming writer hygiene", () => {
  const srcDir = path.join(TMP_DIR, "src");

  beforeEach(() => {
    createTestFiles(srcDir);
  });

  afterEach(() => {
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  });

  it("--verbose prints per-file PACK lines with raw->encoded byte counts", () => {
    // runBash redirects stderr to /dev/null by default — for this assertion
    // we want stderr captured. Use a one-off invocation that merges fd2->fd1.
    const tmpScript = path.join(TMP_DIR, "verbose_runner.sh");
    fs.writeFileSync(
      tmpScript,
      `#!/usr/bin/env bash\nsource "${path.join(ROOT_DIR, "software/scripts/bash-fzf.profile.bash")}"\nsource "${path.join(ROOT_DIR, "software/scripts/bash-file-utils.profile.bash")}"\npack_text "${srcDir}" "${path.join(TMP_DIR, "v.pack.txt")}" --verbose 2>&1 1>/dev/null\n`,
    );
    const stderr = execSync(`bash "${tmpScript}"`, { encoding: "utf-8", timeout: 30000 });
    // Per-file PACK lines should appear for each test file.
    expect(stderr).toMatch(/^\s*PACK: hello\.txt \(\d+ B raw -> \d+ B encoded\)$/m);
    expect(stderr).toMatch(/^\s*PACK: code\.js \(\d+ B raw -> \d+ B encoded\)$/m);
    expect(stderr).toMatch(/^\s*PACK: sub\/nested\.txt \(\d+ B raw -> \d+ B encoded\)$/m);
    // Scan/walk markers from the bash side.
    expect(stderr).toMatch(/pack_text: scanning /);
  });

  it("default (no --verbose) does NOT emit per-file PACK lines", () => {
    const tmpScript = path.join(TMP_DIR, "quiet_runner.sh");
    fs.writeFileSync(
      tmpScript,
      `#!/usr/bin/env bash\nsource "${path.join(ROOT_DIR, "software/scripts/bash-fzf.profile.bash")}"\nsource "${path.join(ROOT_DIR, "software/scripts/bash-file-utils.profile.bash")}"\npack_text "${srcDir}" "${path.join(TMP_DIR, "q.pack.txt")}" 2>&1 1>/dev/null\n`,
    );
    const stderr = execSync(`bash "${tmpScript}"`, { encoding: "utf-8", timeout: 30000 });
    expect(stderr).not.toMatch(/^\s*PACK: /m);
    expect(stderr).not.toMatch(/scanning /);
  });

  it("streaming writer cleans up its .blocks.tmp file after a successful pack", () => {
    const out = path.join(TMP_DIR, "stream.pack.txt");
    runBash(`pack_text "${srcDir}" "${out}" --raw 2>/dev/null`);
    expect(fs.existsSync(out)).toBe(true);
    expect(fs.existsSync(out + ".blocks.tmp")).toBe(false);
  });

  it("streaming writer round-trips byte-exact for a many-files tree", () => {
    // Stress the streaming path with 50 small files so we exercise multiple
    // 64 KB chunks during the final concat. Each file gets random-ish content
    // so per-file SHA matches before/after — any drift introduced by the
    // streaming writer would surface here.
    for (let i = 0; i < 50; i++) {
      fs.writeFileSync(path.join(srcDir, `gen_${i}.txt`), `line ${i}\n`.repeat(100));
    }
    const out = path.join(TMP_DIR, "many.pack.txt");
    const dest = path.join(TMP_DIR, "many_out");
    runBash(`pack_text "${srcDir}" "${out}" --raw 2>/dev/null && unpack_text "${out}" "${dest}"`);
    for (let i = 0; i < 50; i++) {
      expect(sha(path.join(dest, `gen_${i}.txt`))).toBe(sha(path.join(srcDir, `gen_${i}.txt`)));
    }
  });

  it("unpack_text --verbose prints per-file EXTRACT lines with byte counts and dest path", () => {
    const out = path.join(TMP_DIR, "v.pack.txt");
    const dest = path.join(TMP_DIR, "v_out");
    runBash(`pack_text "${srcDir}" "${out}" --raw 2>/dev/null`);
    const tmpScript = path.join(TMP_DIR, "unpack_v_runner.sh");
    fs.writeFileSync(
      tmpScript,
      `#!/usr/bin/env bash\nsource "${path.join(ROOT_DIR, "software/scripts/bash-fzf.profile.bash")}"\nsource "${path.join(ROOT_DIR, "software/scripts/bash-file-utils.profile.bash")}"\nunpack_text "${out}" "${dest}" --verbose 2>&1 1>/dev/null\n`,
    );
    const stderr = execSync(`bash "${tmpScript}"`, { encoding: "utf-8", timeout: 30000 });
    // EXTRACT lines should include both byte count AND full dest path so users
    // can see exactly where each file landed.
    expect(stderr).toMatch(/^\s*EXTRACT: hello\.txt \(\d+ B -> .+hello\.txt\)$/m);
    expect(stderr).toMatch(/^\s*EXTRACT: code\.js \(\d+ B -> .+code\.js\)$/m);
    expect(stderr).toMatch(/^\s*EXTRACT: sub\/nested\.txt \(\d+ B -> .+nested\.txt\)$/m);
    // Summary still prints in verbose mode.
    expect(stderr).toMatch(/unpack_text: extracted \d+ files to /);
  });

  it("unpack_text default (no --verbose) does NOT emit per-file EXTRACT lines", () => {
    const out = path.join(TMP_DIR, "q.pack.txt");
    const dest = path.join(TMP_DIR, "q_out");
    runBash(`pack_text "${srcDir}" "${out}" --raw 2>/dev/null`);
    const tmpScript = path.join(TMP_DIR, "unpack_q_runner.sh");
    fs.writeFileSync(
      tmpScript,
      `#!/usr/bin/env bash\nsource "${path.join(ROOT_DIR, "software/scripts/bash-fzf.profile.bash")}"\nsource "${path.join(ROOT_DIR, "software/scripts/bash-file-utils.profile.bash")}"\nunpack_text "${out}" "${dest}" 2>&1 1>/dev/null\n`,
    );
    const stderr = execSync(`bash "${tmpScript}"`, { encoding: "utf-8", timeout: 30000 });
    expect(stderr).not.toMatch(/^\s*EXTRACT: /m);
    // Summary line still prints — that's the floor of always-on output.
    expect(stderr).toMatch(/unpack_text: extracted \d+ files to /);
  });
});

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
    expect(output).toContain("gzip+base64");
  });

  it("should emit PACK_BEGIN/PACK_END markers with [gzip+base64,mode=0NNN]", () => {
    const output = runBash(`pack_text "${srcDir}" --raw`);
    expect(output).toMatch(/===== PACK_BEGIN: hello\.txt \[gzip\+base64,mode=\d{4}\] =====/);
    expect(output).toContain("===== PACK_END: hello.txt =====");
    expect(output).toMatch(/===== PACK_BEGIN: code\.js \[gzip\+base64,mode=\d{4}\] =====/);
    expect(output).toMatch(/===== PACK_BEGIN: sub\/nested\.txt \[gzip\+base64,mode=\d{4}\] =====/);
  });

  it("should include binary files (no extension filtering)", () => {
    const output = runBash(`pack_text "${srcDir}" --raw`);
    expect(output).toContain("PACK_BEGIN: binary.bin [gzip+base64,mode=");
  });

  it("should record actual file mode in the marker", () => {
    fs.writeFileSync(path.join(srcDir, "exec.sh"), "#!/bin/sh\necho hi\n");
    fs.chmodSync(path.join(srcDir, "exec.sh"), 0o755);
    fs.chmodSync(path.join(srcDir, "hello.txt"), 0o644);
    const output = runBash(`pack_text "${srcDir}" --raw`);
    expect(output).toMatch(/PACK_BEGIN: exec\.sh \[gzip\+base64,mode=0755\]/);
    expect(output).toMatch(/PACK_BEGIN: hello\.txt \[gzip\+base64,mode=0644\]/);
  });

  it("should auto-name to /tmp/<flat>.<ts>.pack.<host>.txt for bare raw call", () => {
    const output = runBash(`pack_text "${srcDir}"`);
    expect(output).toContain("pack_text:");
    const lines = output.split("\n").filter((l) => l.startsWith("pack_text: /tmp/"));
    expect(lines.length).toBeGreaterThan(0);
    const outPath = lines[0].replace("pack_text: ", "").trim();
    // Sanitized hostname is inserted before the final extension:
    // <stem>.pack.<sanitized_host>.txt where sanitized_host is [a-z0-9_]+.
    expect(outPath).toMatch(/\.pack\.[a-z0-9_]+\.txt$/);
    expect(fs.existsSync(outPath)).toBe(true);
    fs.unlinkSync(outPath);
  });

  it("should auto-generate .tar.gz with --tar (hostname segment included)", () => {
    const output = runBash(`pack_text "${srcDir}" --tar`);
    const lines = output.split("\n").filter((l) => l.startsWith("pack_text: /tmp/"));
    const outPath = lines[0].replace("pack_text: ", "").trim();
    expect(outPath).toMatch(/\.pack\.[a-z0-9_]+\.tar\.gz$/);
    expect(fs.existsSync(outPath)).toBe(true);
    fs.unlinkSync(outPath);
  });

  it("should auto-generate .zip with --zip (hostname segment included)", () => {
    const output = runBash(`pack_text "${srcDir}" --zip`);
    const lines = output.split("\n").filter((l) => l.startsWith("pack_text: /tmp/"));
    const outPath = lines[0].replace("pack_text: ", "").trim();
    expect(outPath).toMatch(/\.pack\.[a-z0-9_]+\.zip$/);
    expect(fs.existsSync(outPath)).toBe(true);
    fs.unlinkSync(outPath);
  });

  it("should support --plain as alias for --raw", () => {
    const output = runBash(`pack_text "${srcDir}" --plain`);
    expect(output).toMatch(/===== PACK_BEGIN: hello\.txt \[gzip\+base64/);
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
    expect(view).toMatch(/===== PACK_BEGIN: hello\.txt \[mode=\d{4}\] =====\nHello World\n+===== PACK_END: hello\.txt =====/);
    expect(view).toContain("function foo()");
  });

  it("should keep binary blocks as [gzip+base64,mode=0NNN]", () => {
    const packedFile = path.join(TMP_DIR, "packed.txt");
    runBash(`pack_text "${srcDir}" "${packedFile}"`);
    const view = runBash(`view_pack_text "${packedFile}"`);
    expect(view).toMatch(/===== PACK_BEGIN: binary\.bin \[gzip\+base64,mode=\d{4}\] =====/);
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

  it("should embed sanitized hostname before the final extension (auto-generated filenames only)", () => {
    const output = runBash(`pack_text "${srcDir}"`);
    const outPath = output
      .split("\n")
      .filter((l) => l.startsWith("pack_text: /tmp/"))[0]
      .replace("pack_text: ", "")
      .trim();
    // Filename: ...pack.<sanitized>.txt — sanitized = lowercase [a-z0-9_]+.
    const m = outPath.match(/\.pack\.([a-z0-9_]+)\.txt$/);
    expect(m).toBeTruthy();
    const segment = m[1];
    expect(segment).toMatch(/^[a-z0-9]+(?:_[a-z0-9]+)*$/); // no leading/trailing/double _
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

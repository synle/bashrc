/** Integration tests for pack_text and unpack_text bash functions. */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PROFILE_BASH = path.join(ROOT_DIR, "software/scripts/bash-file-utils.profile.bash");
const TMP_DIR = `/tmp/_pack_text_test_${process.pid}`;

/** Runs a bash script that sources the profile and executes the given commands. */
function runBash(script) {
  const tmpScript = `${TMP_DIR}_runner.sh`;
  fs.writeFileSync(tmpScript, `#!/usr/bin/env bash\nsource "${PROFILE_BASH}"\n${script}`, "utf-8");
  try {
    return execSync(`bash "${tmpScript}" 2>/dev/null`, { encoding: "utf-8", timeout: 30000 }).trim();
  } finally {
    try {
      fs.unlinkSync(tmpScript);
    } catch {}
  }
}

/** Creates a test directory with sample text files and a subdirectory. */
function createTestFiles(baseDir) {
  fs.mkdirSync(baseDir, { recursive: true });
  fs.mkdirSync(path.join(baseDir, "sub"), { recursive: true });
  fs.writeFileSync(path.join(baseDir, "hello.txt"), "Hello World\n");
  fs.writeFileSync(path.join(baseDir, "code.js"), "function foo() {\n  return 42;\n}\n");
  fs.writeFileSync(path.join(baseDir, "sub", "nested.txt"), "Nested content\n");
}

describe("pack_text", () => {
  const srcDir = path.join(TMP_DIR, "src");
  const outDir = path.join(TMP_DIR, "out");

  beforeEach(() => {
    fs.mkdirSync(outDir, { recursive: true });
    createTestFiles(srcDir);
  });

  afterEach(() => {
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  });

  it("should show help with --help", () => {
    const output = runBash("pack_text --help");
    expect(output).toContain("pack_text:");
    expect(output).toContain("Usage:");
    expect(output).toContain("--tar");
    expect(output).toContain("--zip");
    expect(output).toContain("--raw");
  });

  it("should pack files in --raw mode to stdout", () => {
    const output = runBash(`pack_text "${srcDir}" --raw`);
    expect(output).toContain("===== PACK_FILE_BEGIN: hello.txt =====");
    expect(output).toContain("Hello World");
    expect(output).toContain("===== PACK_FILE_END: hello.txt =====");
    expect(output).toContain("===== PACK_FILE_BEGIN: code.js =====");
    expect(output).toContain("===== PACK_FILE_BEGIN: sub/nested.txt =====");
  });

  it("should pack files in --raw mode to output file", () => {
    const outFile = path.join(outDir, "packed.txt");
    runBash(`pack_text "${srcDir}" "${outFile}" --raw`);
    expect(fs.existsSync(outFile)).toBe(true);
    const content = fs.readFileSync(outFile, "utf-8");
    expect(content).toContain("===== PACK_FILE_BEGIN: hello.txt =====");
    expect(content).toContain("===== PACK_FILE_END: hello.txt =====");
  });

  it("should create .tar.gz in default mode", () => {
    const outFile = path.join(outDir, "packed.tar.gz");
    runBash(`pack_text "${srcDir}" "${outFile}"`);
    expect(fs.existsSync(outFile)).toBe(true);
    expect(fs.statSync(outFile).size).toBeGreaterThan(0);
  });

  it("should create .zip with --zip mode", () => {
    const outFile = path.join(outDir, "packed.zip");
    runBash(`pack_text "${srcDir}" "${outFile}" --zip`);
    expect(fs.existsSync(outFile)).toBe(true);
    expect(fs.statSync(outFile).size).toBeGreaterThan(0);
  });

  it("should trim leading and trailing blank lines from content", () => {
    fs.writeFileSync(path.join(srcDir, "padded.txt"), "\n\n\nActual content\n\n\n");
    const output = runBash(`pack_text "${srcDir}" --raw`);
    const begin = "===== PACK_FILE_BEGIN: padded.txt =====";
    const end = "===== PACK_FILE_END: padded.txt =====";
    const bIdx = output.indexOf(begin);
    const eIdx = output.indexOf(end);
    const content = output.slice(bIdx + begin.length + 1, eIdx - 1);
    expect(content).toBe("Actual content");
  });

  it("should preserve internal blank lines in content", () => {
    fs.writeFileSync(path.join(srcDir, "spaced.txt"), "line1\n\nline3\n");
    const output = runBash(`pack_text "${srcDir}" --raw`);
    expect(output).toContain("line1\n\nline3");
  });

  it("should skip binary file extensions", () => {
    fs.writeFileSync(path.join(srcDir, "image.png"), Buffer.from([0x89, 0x50]));
    fs.writeFileSync(path.join(srcDir, "data.sqlite"), "fake db");
    fs.writeFileSync(path.join(srcDir, "font.woff2"), "fake font");
    const output = runBash(`pack_text "${srcDir}" --raw`);
    expect(output).not.toContain("image.png");
    expect(output).not.toContain("data.sqlite");
    expect(output).not.toContain("font.woff2");
    expect(output).toContain("hello.txt");
  });

  it("should skip ignored directories in non-git walk", () => {
    fs.mkdirSync(path.join(srcDir, "node_modules"), { recursive: true });
    fs.writeFileSync(path.join(srcDir, "node_modules", "pkg.js"), "module");
    fs.mkdirSync(path.join(srcDir, "__pycache__"), { recursive: true });
    fs.writeFileSync(path.join(srcDir, "__pycache__", "mod.py"), "cache");
    fs.mkdirSync(path.join(srcDir, ".gradle"), { recursive: true });
    fs.writeFileSync(path.join(srcDir, ".gradle", "config"), "gradle");
    fs.mkdirSync(path.join(srcDir, ".venv"), { recursive: true });
    fs.writeFileSync(path.join(srcDir, ".venv", "pyvenv.cfg"), "venv");
    const output = runBash(`pack_text "${srcDir}" --raw`);
    expect(output).not.toContain("node_modules");
    expect(output).not.toContain("__pycache__");
    expect(output).not.toContain(".gradle");
    expect(output).not.toContain(".venv");
    expect(output).toContain("hello.txt");
  });

  it("should use relative paths from source root in markers", () => {
    const output = runBash(`pack_text "${srcDir}" --raw`);
    expect(output).toContain("===== PACK_FILE_BEGIN: sub/nested.txt =====");
    expect(output).toContain("===== PACK_FILE_END: sub/nested.txt =====");
    expect(output).not.toContain(srcDir);
  });

  it("should fail for nonexistent directory", () => {
    expect(() => runBash(`pack_text "/tmp/_nonexistent_${process.pid}"`)).toThrow();
  });

  it("should skip empty files after trimming", () => {
    fs.writeFileSync(path.join(srcDir, "blank.txt"), "\n\n\n");
    const output = runBash(`pack_text "${srcDir}" --raw`);
    expect(output).not.toContain("blank.txt");
  });

  it("should accept flags in any argument position", () => {
    const outFile = path.join(outDir, "packed.txt");
    runBash(`pack_text --raw "${srcDir}" "${outFile}"`);
    expect(fs.existsSync(outFile)).toBe(true);
    const content = fs.readFileSync(outFile, "utf-8");
    expect(content).toContain("===== PACK_FILE_BEGIN:");
  });
});

describe("unpack_text", () => {
  const srcDir = path.join(TMP_DIR, "src");
  const outDir = path.join(TMP_DIR, "out");
  const destDir = path.join(TMP_DIR, "dest");

  beforeEach(() => {
    fs.mkdirSync(outDir, { recursive: true });
    createTestFiles(srcDir);
  });

  afterEach(() => {
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  });

  it("should show help with --help", () => {
    const output = runBash("unpack_text --help");
    expect(output).toContain("unpack_text:");
    expect(output).toContain("Usage:");
  });

  it("should unpack from raw text file", () => {
    const packedFile = path.join(outDir, "packed.txt");
    runBash(`pack_text "${srcDir}" "${packedFile}" --raw`);
    runBash(`unpack_text "${packedFile}" "${destDir}"`);
    expect(fs.existsSync(path.join(destDir, "hello.txt"))).toBe(true);
    expect(fs.existsSync(path.join(destDir, "code.js"))).toBe(true);
    expect(fs.existsSync(path.join(destDir, "sub", "nested.txt"))).toBe(true);
  });

  it("should unpack from tar.gz archive", () => {
    const packedFile = path.join(outDir, "packed.tar.gz");
    runBash(`pack_text "${srcDir}" "${packedFile}" --tar`);
    runBash(`unpack_text "${packedFile}" "${destDir}"`);
    expect(fs.existsSync(path.join(destDir, "hello.txt"))).toBe(true);
    expect(fs.existsSync(path.join(destDir, "code.js"))).toBe(true);
    expect(fs.existsSync(path.join(destDir, "sub", "nested.txt"))).toBe(true);
  });

  it("should unpack from zip archive", () => {
    const packedFile = path.join(outDir, "packed.zip");
    runBash(`pack_text "${srcDir}" "${packedFile}" --zip`);
    runBash(`unpack_text "${packedFile}" "${destDir}"`);
    expect(fs.existsSync(path.join(destDir, "hello.txt"))).toBe(true);
    expect(fs.existsSync(path.join(destDir, "sub", "nested.txt"))).toBe(true);
  });

  it("should create destination directory if it does not exist", () => {
    const packedFile = path.join(outDir, "packed.txt");
    const newDest = path.join(TMP_DIR, "brand_new_dir");
    runBash(`pack_text "${srcDir}" "${packedFile}" --raw`);
    expect(fs.existsSync(newDest)).toBe(false);
    runBash(`unpack_text "${packedFile}" "${newDest}"`);
    expect(fs.existsSync(path.join(newDest, "hello.txt"))).toBe(true);
  });

  it("should fail for nonexistent input file", () => {
    expect(() => runBash(`unpack_text "/tmp/_nonexistent_${process.pid}.txt"`)).toThrow();
  });

  it("should recreate nested directory structure", () => {
    fs.mkdirSync(path.join(srcDir, "a", "b", "c"), { recursive: true });
    fs.writeFileSync(path.join(srcDir, "a", "b", "c", "deep.txt"), "deep\n");
    const packedFile = path.join(outDir, "packed.txt");
    runBash(`pack_text "${srcDir}" "${packedFile}" --raw`);
    runBash(`unpack_text "${packedFile}" "${destDir}"`);
    expect(fs.existsSync(path.join(destDir, "a", "b", "c", "deep.txt"))).toBe(true);
    expect(fs.readFileSync(path.join(destDir, "a", "b", "c", "deep.txt"), "utf-8")).toBe("deep\n");
  });
});

describe("pack_text + unpack_text roundtrip", () => {
  const srcDir = path.join(TMP_DIR, "src");
  const outDir = path.join(TMP_DIR, "out");
  const destDir = path.join(TMP_DIR, "dest");

  beforeEach(() => {
    fs.mkdirSync(outDir, { recursive: true });
    createTestFiles(srcDir);
  });

  afterEach(() => {
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  });

  it("should preserve file content through raw roundtrip", () => {
    const packedFile = path.join(outDir, "packed.txt");
    runBash(`pack_text "${srcDir}" "${packedFile}" --raw`);
    runBash(`unpack_text "${packedFile}" "${destDir}"`);

    expect(fs.readFileSync(path.join(destDir, "hello.txt"), "utf-8")).toBe(
      fs.readFileSync(path.join(srcDir, "hello.txt"), "utf-8"),
    );
    expect(fs.readFileSync(path.join(destDir, "code.js"), "utf-8")).toBe(
      fs.readFileSync(path.join(srcDir, "code.js"), "utf-8"),
    );
    expect(fs.readFileSync(path.join(destDir, "sub", "nested.txt"), "utf-8")).toBe(
      fs.readFileSync(path.join(srcDir, "sub", "nested.txt"), "utf-8"),
    );
  });

  it("should preserve file content through tar roundtrip", () => {
    const packedFile = path.join(outDir, "packed.tar.gz");
    runBash(`pack_text "${srcDir}" "${packedFile}" --tar`);
    runBash(`unpack_text "${packedFile}" "${destDir}"`);

    expect(fs.readFileSync(path.join(destDir, "hello.txt"), "utf-8")).toBe(
      fs.readFileSync(path.join(srcDir, "hello.txt"), "utf-8"),
    );
    expect(fs.readFileSync(path.join(destDir, "sub", "nested.txt"), "utf-8")).toBe(
      fs.readFileSync(path.join(srcDir, "sub", "nested.txt"), "utf-8"),
    );
  });

  it("should preserve file content through zip roundtrip", () => {
    const packedFile = path.join(outDir, "packed.zip");
    runBash(`pack_text "${srcDir}" "${packedFile}" --zip`);
    runBash(`unpack_text "${packedFile}" "${destDir}"`);

    expect(fs.readFileSync(path.join(destDir, "hello.txt"), "utf-8")).toBe(
      fs.readFileSync(path.join(srcDir, "hello.txt"), "utf-8"),
    );
  });

  it("should preserve internal blank lines through roundtrip", () => {
    fs.writeFileSync(path.join(srcDir, "multi.txt"), "line1\n\nline3\n\nline5\n");
    const packedFile = path.join(outDir, "packed.txt");
    runBash(`pack_text "${srcDir}" "${packedFile}" --raw`);
    runBash(`unpack_text "${packedFile}" "${destDir}"`);

    expect(fs.readFileSync(path.join(destDir, "multi.txt"), "utf-8")).toBe("line1\n\nline3\n\nline5\n");
  });

  it("should handle files with special characters in content", () => {
    fs.writeFileSync(path.join(srcDir, "special.txt"), 'echo "hello $USER" && echo \'world\'\n');
    const packedFile = path.join(outDir, "packed.txt");
    runBash(`pack_text "${srcDir}" "${packedFile}" --raw`);
    runBash(`unpack_text "${packedFile}" "${destDir}"`);

    expect(fs.readFileSync(path.join(destDir, "special.txt"), "utf-8")).toBe(
      'echo "hello $USER" && echo \'world\'\n',
    );
  });
});

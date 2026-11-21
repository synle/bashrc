/** Behavior tests for the shared pandoc convert wrappers (html/docx). */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const WRAPPERS = path.join(ROOT, "software/scripts/bash-command-wrappers.profile.bash");

/** Shared pandoc helper plus html() and docx(), kept self-contained for bash -c. */
function converters() {
  const source = fs.readFileSync(WRAPPERS, "utf8");
  return source.slice(source.indexOf("# html: reverse of marked"));
}

let sandbox;

beforeEach(() => {
  sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "docx-convert-"));
  fs.mkdirSync(path.join(sandbox, "bin"));
  fs.writeFileSync(
    path.join(sandbox, "bin", "pandoc"),
    ["#!/bin/sh", 'printf "%s\\n" "$*" > "$PANDOC_CAPTURE"', 'printf "converted\\n" > "$6"', ""].join("\n"),
    { mode: 0o755 },
  );
});

afterEach(() => {
  fs.rmSync(sandbox, { recursive: true, force: true });
});

/** Run one wrapper with a stubbed pandoc and return its captured argv. */
function run(command, args = [], input = null) {
  const capture = path.join(sandbox, "pandoc-args");
  const script = `
    function is_help_arg() { [ "\${1:-}" = --help ]; }
    function paste() { command cat; }
    ${converters()}
    ${command}
  `;
  const result = spawnSync("/bin/bash", ["-c", script, "bash", ...args], {
    encoding: "utf8",
    env: { ...process.env, PATH: `${sandbox}/bin:${process.env.PATH}`, PANDOC_CAPTURE: capture },
    input,
    stdio: [input === null ? "ignore" : "pipe", "pipe", "pipe"],
  });
  const pandocArgs = fs.existsSync(capture) ? fs.readFileSync(capture, "utf8").trim() : "";
  return {
    ...result,
    pandocArgs: pandocArgs
      .split(" ")
      .map((a) => a.split(sandbox).join("<S>"))
      .join(" "),
  };
}

/** Create an input fixture and return its sandbox-relative path. */
function fixture(name, content = "content\n") {
  const file = path.join(sandbox, name);
  fs.writeFileSync(file, content);
  return file;
}

describe("pandoc convert wrappers", () => {
  it("converts DOCX to Markdown by default", () => {
    const input = fixture("report.docx", "PKfake");
    const output = path.join(sandbox, "out.md");
    const result = run('docx "$1" "$2"', [input, output]);
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.pandocArgs).toBe(`-f docx -t gfm-raw_html -o <S>/out.md <S>/report.docx`);
    expect(fs.readFileSync(output, "utf8")).toBe("converted\n");
    expect(result.stdout).toContain("docx: wrote");
  });

  it("converts Markdown to DOCX when given a .md file", () => {
    const input = fixture("quiz_6.md", "# Title\n");
    const output = path.join(sandbox, "out.docx");
    const result = run('docx "$1" "$2"', [input, output]);
    expect(result.status).toBe(0);
    expect(result.pandocArgs).toBe(`-f markdown -t docx -o <S>/out.docx <S>/quiz_6.md`);
    expect(fs.readFileSync(output, "utf8")).toBe("converted\n");
  });

  it("forces Markdown to DOCX for piped stdin with --to-docx", () => {
    const result = run("docx --to-docx", [], "# Title\n");
    expect(result.status).toBe(0);
    expect(result.pandocArgs).toMatch(
      /^-f markdown -t docx -o \/tmp\/docx-\d{4}-\d{2}-\d{2}-[A-Za-z0-9]+-clipboard\.docx \/tmp\/docx-input-\w+$/,
    );
    expect(result.stdout).toContain("docx: wrote");
    const output = result.pandocArgs.split(" ")[5];
    fs.rmSync(output);
  });

  it("prints help covering both directions", () => {
    const result = run("docx --help");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("docx input.docx output.md");
    expect(result.stdout).toContain("docx input.md output.docx");
    expect(result.stdout).toContain("--to-docx");
  });

  it("keeps html converting HTML to Markdown after the helper refactor", () => {
    const input = fixture("page.html", "<h1>Title</h1>");
    const output = path.join(sandbox, "page.md");
    const result = run('html "$1" "$2"', [input, output]);
    expect(result.status).toBe(0);
    expect(result.pandocArgs).toBe(`-f html -t gfm-raw_html -o <S>/page.md <S>/page.html`);
    expect(fs.readFileSync(output, "utf8")).toBe("converted\n");
  });
});

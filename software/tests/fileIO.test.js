import { describe, it, expect } from "vitest";
import { fileSystem, getIndexFunction } from "./setup.js";

const writeText = getIndexFunction("writeText");
const readText = getIndexFunction("readText");
const appendText = getIndexFunction("appendText");
const writeJson = getIndexFunction("writeJson");
const writeConfigToFile = getIndexFunction("writeConfigToFile");
const parseJsonWithComments = getIndexFunction("parseJsonWithComments");

// ---- tests ----

describe("readText", () => {
  it("should return file content from fileSystem", () => {
    fileSystem["/mock/test.txt"] = "hello world";
    expect(readText("/mock/test.txt")).toBe("hello world");
  });

  it("should return empty string for non-existent file", () => {
    expect(readText("/mock/nonexistent.txt")).toBe("");
  });
});

describe("writeText", () => {
  it("should write text to the fileSystem", () => {
    writeText("/mock/output.txt", "some content");
    expect(fileSystem["/mock/output.txt"]).toBe("some content");
  });

  it("should trim content before writing", () => {
    writeText("/mock/output.txt", "  padded  ");
    expect(fileSystem["/mock/output.txt"]).toBe("padded");
  });

  it("should handle null content gracefully", () => {
    writeText("/mock/output.txt", null);
    expect(fileSystem["/mock/output.txt"]).toBe("");
  });
});

describe("appendText", () => {
  it("should append text to existing content", () => {
    fileSystem["/mock/file.txt"] = "line1";
    appendText("/mock/file.txt", "line2");
    const result = fileSystem["/mock/file.txt"];
    expect(result).toContain("line1");
    expect(result).toContain("line2");
  });

  it("should work on empty file", () => {
    appendText("/mock/empty.txt", "new content");
    expect(fileSystem["/mock/empty.txt"]).toContain("new content");
  });
});

describe("writeJson", () => {
  it("should write JSON object as formatted string", () => {
    writeJson("/mock/config.json", { key: "value" });
    const written = fileSystem["/mock/config.json"];
    expect(written).toContain('"key"');
    expect(written).toContain('"value"');
  });

  it("should include comments when provided", () => {
    writeJson("/mock/config.json", { a: 1 }, "// auto-generated\n");
    const written = fileSystem["/mock/config.json"];
    expect(written).toContain("auto-generated");
    expect(written).toContain('"a"');
  });

  it("should produce valid JSON in the output", () => {
    writeJson("/mock/valid.json", { x: 1, y: [2, 3] });
    const written = fileSystem["/mock/valid.json"];
    const parsed = JSON.parse(written);
    expect(parsed).toEqual({ x: 1, y: [2, 3] });
  });
});

describe("writeConfigToFile", () => {
  it("should write JSON config to basePath/fileName", () => {
    writeConfigToFile("/mock/editor", "settings.json", { theme: "dark" });
    expect(fileSystem["/mock/editor/settings.json"]).toContain('"theme"');
  });

  it("should write text config when isJson is false", () => {
    writeConfigToFile("/mock/editor", "config.txt", "some text config", false);
    expect(fileSystem["/mock/editor/config.txt"]).toContain("some text config");
  });
});

describe("parseJsonWithComments", () => {
  it("should parse standard JSON", () => {
    expect(parseJsonWithComments('{"key": "value"}')).toEqual({ key: "value" });
  });

  it("should strip single-line comments", () => {
    const input = '{\n  // this is a comment\n  "key": "value"\n}';
    expect(parseJsonWithComments(input)).toEqual({ key: "value" });
  });

  it("should strip block comments", () => {
    const input = '{\n  /* block comment */\n  "key": "value"\n}';
    expect(parseJsonWithComments(input)).toEqual({ key: "value" });
  });

  it("should handle trailing commas", () => {
    const input = '{"a": 1, "b": 2, }';
    expect(parseJsonWithComments(input)).toEqual({ a: 1, b: 2 });
  });

  it("should parse nested objects", () => {
    const input = '{"a": {"b": [1, 2, 3]}}';
    expect(parseJsonWithComments(input)).toEqual({ a: { b: [1, 2, 3] } });
  });
});

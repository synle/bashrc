/**
 * Regression tests for `make format` not being a fixed point: oxfmt indented a
 * `// SOURCE` marker (breaking the column-0-only test expansion) and inserted a
 * blank line after a markdown BEGIN marker that build-include then removed again.
 */
import { describe, it, expect } from "vitest";
import buildIncludeModule from "../tools/build-include.js";
import { expandSourceMarkers, getIndexFunction } from "./setup.js";

const { padMarkdownMarkers } = buildIncludeModule;
const expandRuntime = getIndexFunction("_expandSourceMarkers");

const BEGIN = "<!-- BEGIN docs/a.md -->";
const END = "<!-- END docs/a.md -->";

describe("padMarkdownMarkers", () => {
  it("adds a blank line after BEGIN and before END around prose", () => {
    expect(padMarkdownMarkers(`${BEGIN}\n# Title\ntext\n${END}\n`, BEGIN, END)).toBe(`${BEGIN}\n\n# Title\ntext\n\n${END}\n`);
  });

  it("adds a blank line around a code fence", () => {
    expect(padMarkdownMarkers(`${BEGIN}\n\`\`\`bash\nls\n\`\`\`\n${END}`, BEGIN, END)).toBe(`${BEGIN}\n\n\`\`\`bash\nls\n\`\`\`\n\n${END}`);
  });

  it("leaves already-padded content unchanged", () => {
    const padded = `${BEGIN}\n\n# Title\n\n${END}\n`;
    expect(padMarkdownMarkers(padded, BEGIN, END)).toBe(padded);
  });

  it("leaves an empty block (adjacent markers) unchanged", () => {
    const empty = `${BEGIN}\n${END}\n`;
    expect(padMarkdownMarkers(empty, BEGIN, END)).toBe(empty);
  });
});

describe("indented // SOURCE markers", () => {
  const INDENTED = "const X = [\n  // SOURCE software/scripts/advanced/llm/llm-models.jsonc\n].flat();";

  it("test helper inlines an indented marker", () => {
    expect(expandSourceMarkers(INDENTED)).not.toContain("// SOURCE");
    expect(expandSourceMarkers(INDENTED)).toContain("minVramMib");
  });

  it("runtime expansion recognizes an indented marker", () => {
    const { sourceFiles } = expandRuntime(INDENTED, "//");
    expect(sourceFiles).toEqual(["software/scripts/advanced/llm/llm-models.jsonc"]);
  });
});

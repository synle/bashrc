/** Build-time marker records exclude runtime SOURCE markers. */
import { describe, it, expect } from "vitest";
import buildIncludeModule from "../tools/build-include.js";

/** Existing public marker parser. */
const { findMarkers } = buildIncludeModule;

describe("findMarkers", () => {
  it("should find # BEGIN markers in .sh files", () => {
    const content = "# BEGIN path/to/file.sh\nsome content\n# END path/to/file.sh";
    const markers = findMarkers(content, "target.sh");
    expect(markers.map(({ key, commentPrefix }) => ({ key, commentPrefix }))).toMatchInlineSnapshot(`
      [
        {
          "commentPrefix": "#",
          "key": "path/to/file.sh",
        },
      ]
    `);
  });

  it("should find <!-- BEGIN --> markers in .md files", () => {
    const content = "<!-- BEGIN path/to/file.sh -->\nsome content\n<!-- END path/to/file.sh -->";
    const markers = findMarkers(content, "README.md");
    expect(markers.map(({ key, commentPrefix }) => ({ key, commentPrefix }))).toMatchInlineSnapshot(`
      [
        {
          "commentPrefix": "<!--",
          "key": "path/to/file.sh",
        },
      ]
    `);
  });

  it("should find // BEGIN markers in .jsonc files", () => {
    const content = "// BEGIN some/file.js\nstuff\n// END some/file.js";
    const markers = findMarkers(content, "theme.jsonc");
    expect(markers.map(({ key, commentPrefix }) => ({ key, commentPrefix }))).toMatchInlineSnapshot(`
      [
        {
          "commentPrefix": "//",
          "key": "some/file.js",
        },
      ]
    `);
  });

  it("should return empty array when no markers found", () => {
    expect(findMarkers("no markers here", "file.sh")).toEqual([]);
  });

  it("should not match SOURCE markers (runtime-only, ignored by build-include)", () => {
    const content = "# SOURCE software/scripts/foo.bash\n# BEGIN path/to/file.sh\ncontent\n# END path/to/file.sh";
    const markers = findMarkers(content, "target.sh");
    expect(markers.map(({ key, commentPrefix }) => ({ key, commentPrefix }))).toMatchInlineSnapshot(`
      [
        {
          "commentPrefix": "#",
          "key": "path/to/file.sh",
        },
      ]
    `);
  });

  it("should not match SOURCE_BEGIN/SOURCE_END markers (runtime-only, ignored by build-include)", () => {
    const content =
      "# SOURCE_BEGIN software/scripts/foo.bash\ncontent\n# SOURCE_END software/scripts/foo.bash\n# BEGIN path/to/file.sh\ncontent\n# END path/to/file.sh";
    const markers = findMarkers(content, "target.sh");
    expect(markers.map(({ key, commentPrefix }) => ({ key, commentPrefix }))).toMatchInlineSnapshot(`
      [
        {
          "commentPrefix": "#",
          "key": "path/to/file.sh",
        },
      ]
    `);
  });
});

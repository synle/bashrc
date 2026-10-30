/** Profile marker classification distinguishes reusable build includes from managed runtime blocks. */
import { describe, expect, it } from "vitest";
import { extractBlocks } from "./profileBlocks.helpers.js";

describe("profile block classification", () => {
  it.each(["", "# ordinary source", "# BEGIN empty\n# END empty"])("returns no populated blocks for %j", (source) => {
    expect(extractBlocks(source)).toEqual([]);
  });
  it("recognizes build-time include metadata without hiding its body from syntax checks", () => {
    const blocks = extractBlocks(
      "# BEGIN helpers/common.bash\n# helpers/common.bash | 0123456789abcdef0123456789abcdef | 1 KB\n:\n# END helpers/common.bash",
    );
    expect(blocks).toEqual([
      {
        key: "helpers/common.bash",
        body: "# helpers/common.bash | 0123456789abcdef0123456789abcdef | 1 KB\n:",
        lineNumber: 2,
        isBuildInclude: true,
      },
    ]);
  });

  it("keeps a path-shaped managed block visible when its source metadata does not match", () => {
    const blocks = extractBlocks(
      "# BEGIN helpers/common.bash\n# other.bash | 0123456789abcdef0123456789abcdef | 1 KB\n:\n# END helpers/common.bash",
    );
    expect(blocks.map((block) => block.isBuildInclude)).toEqual([false]);
  });

  it.each([
    ["no metadata", "# ordinary managed content"],
    ["mismatched source", "# other.bash | 0123456789abcdef0123456789abcdef | 1 KB"],
    ["invalid fingerprint", "# duplicate | not-a-hash | 1 KB"],
    ["managed label with metadata", "# duplicate | 0123456789abcdef0123456789abcdef | 1 KB"],
  ])("keeps duplicate managed keys visible with %s", (_label, body) => {
    const content = `# BEGIN duplicate\n${body}\n:\n# END duplicate\n# BEGIN duplicate\n${body}\n:\n# END duplicate`;
    const managed = extractBlocks(content).filter((block) => !block.isBuildInclude);
    expect(managed.map((block) => block.key)).toEqual(["duplicate", "duplicate"]);
    expect(managed.map((block) => block.isBuildInclude)).toEqual([false, false]);
  });
});

/** Tests for _extractAppImageMetadata — failure path returns empty metadata instead of throwing. */
import { describe, it, expect } from "vitest";
import { getIndexFunction } from "./setup.js";

const _extractAppImageMetadata = getIndexFunction("_extractAppImageMetadata");

describe("_extractAppImageMetadata", () => {
  it("returns empty metadata when the temp extraction folder cannot be created", async () => {
    // The sandbox fs has no mkdtempSync, so the first fs call throws — the same shape as a real EACCES.
    const result = await _extractAppImageMetadata("/mock/home/app.AppImage", "App", "/mock/home/dest");
    expect(result).toEqual({ iconPath: "", desktopFields: null });
  });
});

import { describe, it, expect } from "vitest";
import { getIndexFunction } from "./setup.js";

const resolveOsKey = getIndexFunction("resolveOsKey");

// ---- tests ----

describe("resolveOsKey", () => {
  it("should return linux by default (sandbox has no OS flags set)", () => {
    const result = resolveOsKey({ mac: "mac-val", windows: "win-val", linux: "linux-val" });
    expect(result).toBe("linux-val");
  });

  it("should return linux value when only linux key is provided", () => {
    const result = resolveOsKey({ linux: "only-linux" });
    expect(result).toBe("only-linux");
  });

  it("should return undefined when linux key is missing", () => {
    const result = resolveOsKey({ mac: "mac-val", windows: "win-val" });
    expect(result).toBeUndefined();
  });
});

/** Tests for getWindowUserBaseDir — %USERPROFILE% to WSL path translation. */
import { describe, it, expect } from "vitest";
import { getIndexFunction, mockFsExistence, setMockExecSyncReturn } from "./setup.js";

const getWindowUserBaseDir = getIndexFunction("getWindowUserBaseDir");

describe("getWindowUserBaseDir", () => {
  // Result is memoized per process, so only the first call is observable — one test.
  it("translates cmd.exe %USERPROFILE% into its /mnt/<drive> WSL path", () => {
    setMockExecSyncReturn("C:\\Users\\Bob\r\n");
    mockFsExistence["/mnt/c/Users/Bob"] = true;
    expect(getWindowUserBaseDir()).toBe("/mnt/c/Users/Bob");
  });
});

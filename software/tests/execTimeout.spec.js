/**
 * Tests for the execBash / execBashSync timeout contract in software/index.js.
 *
 * Background: both helpers hard-clamped `options.timeout` to 30s, so a caller
 * asking for a longer budget silently got 30s. `curl -fsSL … | sh` installs that
 * download tens of MB were killed mid-download at exactly 30s — and because
 * execBash never rejects, the script reported success while its binary was never
 * written (see software/tests/scripts/temporal-cli.spec.js for the caller side).
 * The contract is now: 30s default, the caller's value when given, 5m ceiling.
 */
import { describe, it, expect } from "vitest";
import { getIndexFunction, getIndexConstant } from "./setup.js";

const resolveExecTimeout = getIndexFunction("resolveExecTimeout");
const EXEC_DEFAULT_TIMEOUT_MS = getIndexConstant("EXEC_DEFAULT_TIMEOUT_MS");
const EXEC_MAX_TIMEOUT_MS = getIndexConstant("EXEC_MAX_TIMEOUT_MS");

describe("resolveExecTimeout", () => {
  it("should default to 30s when no timeout is given", () => {
    expect(resolveExecTimeout()).toBe(30_000);
    expect(EXEC_DEFAULT_TIMEOUT_MS).toBe(30_000);
  });

  it("should return the caller timeout when it is below the ceiling", () => {
    expect(resolveExecTimeout({ timeout: 5_000 })).toBe(5_000);
    expect(resolveExecTimeout({ timeout: 120_000 })).toBe(120_000);
  });

  it("should clamp a caller timeout above the ceiling to 5 minutes", () => {
    expect(resolveExecTimeout({ timeout: 999_999 })).toBe(300_000);
    expect(EXEC_MAX_TIMEOUT_MS).toBe(300_000);
  });

  it("should ignore other exec options when resolving the timeout", () => {
    expect(resolveExecTimeout({ cwd: "/tmp", env: { FOO: "1" } })).toBe(30_000);
  });
});

import { describe, it, expect } from "vitest";
import { getIndexFunction, getIndexConstant } from "./setup.js";

const resolvePlaceholders = getIndexFunction("resolvePlaceholders");
const COMMON_PLACEHOLDERS = getIndexConstant("COMMON_PLACEHOLDERS");
const PLACEHOLDER_NAME_PATTERN = getIndexConstant("PLACEHOLDER_NAME_PATTERN");

// ---- tests ----

describe("resolvePlaceholders", () => {
  it("should substitute a bare-name token", () => {
    expect(resolvePlaceholders("resize-pane -L <<STEP>>", { STEP: 10 })).toBe("resize-pane -L 10");
  });

  it("should substitute a token whose key is already bracketed", () => {
    expect(resolvePlaceholders("wait <<SECONDS>>s", { "<<SECONDS>>": "60" })).toBe("wait 60s");
  });

  it("should replace every occurrence, not only the first", () => {
    expect(resolvePlaceholders("<<CMD>> and <<CMD>> and <<CMD>>", { CMD: "git" })).toBe("git and git and git");
  });

  it("should coerce a numeric value to a string", () => {
    expect(resolvePlaceholders("<<N>>", { N: 0 })).toBe("0");
  });

  it("should leave a single-bracket token alone even when the name is mapped", () => {
    // The whole point of the doubled delimiter: `<STEP>` is prose, shell
    // redirection, or an XML-ish tag, and must never be mistaken for a token.
    expect(resolvePlaceholders("<STEP> <<STEP>>", { STEP: "10" })).toBe("<STEP> 10");
  });

  it("should leave prose metavariables untouched", () => {
    const doc = "open github.com/<owner>/<repo>/pull/<number> for <REPO> and <CLI>";
    expect(resolvePlaceholders(doc, { REPO: "widget-store", CLI: "copilot" })).toBe(
      "open github.com/<owner>/<repo>/pull/<number> for <REPO> and <CLI>",
    );
  });

  it("should leave a token absent from the map unresolved", () => {
    expect(resolvePlaceholders("<<KNOWN>> <<UNKNOWN>>", { KNOWN: "yes" })).toBe("yes <<UNKNOWN>>");
  });

  it("should not interpret regex replacement patterns in the value", () => {
    // String.replace would expand $& / $` / $' / $1 here and mangle the value.
    expect(resolvePlaceholders("<<V>>", { V: "a$&b$1c$'d" })).toBe("a$&b$1c$'d");
  });

  it("should not treat a value's own token text as a further substitution", () => {
    expect(resolvePlaceholders("<<A>>", { A: "<<B>>", B: "second pass" })).toBe("<<B>>");
  });

  it("should merge COMMON_PLACEHOLDERS in without the caller declaring them", () => {
    expect(resolvePlaceholders("<<SY_ROOT_FOLDER>>/plans")).toBe(`${COMMON_PLACEHOLDERS.SY_ROOT_FOLDER}/plans`);
  });

  it("should let a caller override a common token", () => {
    expect(resolvePlaceholders("<<HOME>>", { HOME: "/tmp/fake-home" })).toBe("/tmp/fake-home");
  });

  it("should skip a token whose value is null or undefined", () => {
    expect(resolvePlaceholders("<<A>><<B>>", { A: null, B: undefined })).toBe("<<A>><<B>>");
  });

  it("should skip a name that is not SCREAMING_SNAKE_CASE", () => {
    // Enforcing one casing is what keeps a token visibly a token; a typo must
    // surface as an unresolved placeholder, never a half-substitution.
    expect(resolvePlaceholders("<<lower>> <<camelCase>> <<Mixed_Case>>", { lower: "x", camelCase: "y", Mixed_Case: "z" })).toBe(
      "<<lower>> <<camelCase>> <<Mixed_Case>>",
    );
  });

  it("should accept digits and underscores after the first letter", () => {
    expect(resolvePlaceholders("<<SY_PR_RETRY_MAX_5>>", { SY_PR_RETRY_MAX_5: "ok" })).toBe("ok");
  });

  it("should return falsy content untouched", () => {
    expect(resolvePlaceholders("", { A: "x" })).toBe("");
    expect(resolvePlaceholders(undefined, { A: "x" })).toBe(undefined);
  });

  it("should work with no token map at all", () => {
    expect(resolvePlaceholders("nothing to do here")).toBe("nothing to do here");
  });
});

describe("COMMON_PLACEHOLDERS", () => {
  it("should name every token in SCREAMING_SNAKE_CASE", () => {
    for (const name of Object.keys(COMMON_PLACEHOLDERS)) {
      expect(PLACEHOLDER_NAME_PATTERN.test(name), `${name} is not SCREAMING_SNAKE_CASE`).toBe(true);
    }
  });

  it("should resolve every token to a non-empty absolute path", () => {
    // A token resolving to undefined bakes the string "undefined" into a real
    // config file, which is a broken path nothing complains about at write time.
    for (const [name, value] of Object.entries(COMMON_PLACEHOLDERS)) {
      expect(typeof value, `${name} resolves to a non-string`).toBe("string");
      expect(value.startsWith("/"), `${name} resolves to a relative path`).toBe(true);
    }
  });
});

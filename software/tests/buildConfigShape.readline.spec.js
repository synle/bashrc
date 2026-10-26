import { describe, expect, it } from "vitest";

import { readBuildText, warnIfBuildArtifactMissing } from "./buildConfigShape.helpers.js";

describe(".build/inputrc", () => {
  it("keeps readline settings as a config snapshot", () => {
    const filename = "inputrc";
    if (warnIfBuildArtifactMissing(filename)) return;

    const settings = readBuildText(filename)
      .split(/\r?\n/)
      .filter((line) => /^\s*set /.test(line))
      .map((line) => line.split("#", 1)[0].trim());
    expect(settings).toMatchInlineSnapshot(`
      [
        "set completion-ignore-case on",
        "set expand-tilde on",
        "set show-all-if-ambiguous on",
        "set visible-stats on",
        "set colored-stats on",
        "set colored-completion-prefix on",
        "set mark-symlinked-directories on",
        "set completion-map-case on",
        "set skip-completed-text on",
        "set menu-complete-display-prefix on",
        "set match-hidden-files off",
        "set page-completions off",
        "set completion-query-items 250",
        "set echo-control-characters off",
        "set bell-style none",
        "set enable-bracketed-paste on",
        "set revert-all-at-newline on",
      ]
    `);
  });
});

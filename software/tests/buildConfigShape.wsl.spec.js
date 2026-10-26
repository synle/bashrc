import { describe, expect, it } from "vitest";

import { readBuildText, warnIfBuildArtifactMissing } from "./buildConfigShape.helpers.js";

describe(".build/windows_wsl2_config", () => {
  it("keeps the requested WSL2 settings", () => {
    const filename = "windows_wsl2_config";
    if (warnIfBuildArtifactMissing(filename)) return;

    const lines = readBuildText(filename).split(/\r?\n/);
    const settings = Object.fromEntries(
      lines.filter((line) => /^(guiApplications|memory|swap|processors|networkingMode)=/.test(line)).map((line) => line.split("=", 2)),
    );
    expect(lines).toContain("[wsl2]");
    expect(settings).toMatchInlineSnapshot(`
      {
        "guiApplications": "false",
        "memory": "8GB",
        "networkingMode": "mirrored",
        "processors": "2",
        "swap": "24GB",
      }
    `);
  });
});

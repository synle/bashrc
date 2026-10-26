import { describe, expect, it } from "vitest";

import { readBuildJson, readBuildText, warnIfBuildArtifactMissing } from "./buildConfigShape.helpers.js";

/** Matches an IPv4 field without retaining or printing its value.
 * @type {RegExp}
 */
const IPV4_SHAPE = /^[0-9]{1,3}(\.[0-9]{1,3}){3}$/;

describe(".build/ip-address.config.hostnamesFlattened", () => {
  it("keeps flattened host flags without snapshotting network identities", () => {
    const filename = "ip-address.config.hostnamesFlattened";
    if (warnIfBuildArtifactMissing(filename)) return;

    const entries = readBuildJson(filename);
    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0][2]).toMatchInlineSnapshot(`
      {
        "IS_FIRST_IP_IN_GROUP": true,
        "NO_SSH": true,
        "OSX_REMOTE": false,
        "WINDOWS_REMOTE": false,
      }
    `);
  });
});

describe(".build/ip-address.config.hostnamesGroupedByID", () => {
  it("keeps grouped host records without exposing names or addresses", () => {
    const filename = "ip-address.config.hostnamesGroupedByID";
    if (warnIfBuildArtifactMissing(filename)) return;

    const groups = readBuildText(filename)
      .trim()
      .split(/\r?\n\s*\r?\n/);
    expect(groups.length).toBeGreaterThan(0);
    expect(
      groups.every((group) => {
        const [address, ...hostnames] = group.split(/\r?\n/);
        return IPV4_SHAPE.test(address) && hostnames.length > 0;
      }),
    ).toBe(true);
  });
});

describe(".build/ip-address.config.etcHostnamesMappings", () => {
  it("keeps one address/hostname pair per flattened entry without snapshotting identities", () => {
    const filename = "ip-address.config.etcHostnamesMappings";
    if (warnIfBuildArtifactMissing(filename)) return;

    const mappings = readBuildText(filename).split(/\r?\n/).filter(Boolean);
    const flattened = readBuildJson("ip-address.config.hostnamesFlattened");
    expect(mappings.length).toBe(flattened.length);
    expect(mappings.every((line) => /^\S+\s+\S+$/.test(line))).toBe(true);
  });
});

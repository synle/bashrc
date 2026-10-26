import { describe, expect, it } from "vitest";

import { parseBuildToml, parseBuildYaml } from "./buildConfigShape.helpers.js";

describe("YAML config parsing", () => {
  it("converts nested YAML data into snapshot-ready JavaScript values", () => {
    expect(
      parseBuildYaml(`
application:
  name: bashrc
  enabled: true
  ports:
    - 8080
    - 8081
`),
    ).toMatchInlineSnapshot(`
      {
        "application": {
          "enabled": true,
          "name": "bashrc",
          "ports": [
            8080,
            8081,
          ],
        },
      }
    `);
  });
});

describe("TOML config parsing", () => {
  it("converts nested TOML data into snapshot-ready JavaScript values", () => {
    expect(
      parseBuildToml(`
title = "bashrc"
enabled = true

[server]
host = "127.0.0.1"
ports = [8080, 8081]
`),
    ).toMatchInlineSnapshot(`
      {
        "enabled": true,
        "server": {
          "host": "127.0.0.1",
          "ports": [
            8080,
            8081,
          ],
        },
        "title": "bashrc",
      }
    `);
  });
});

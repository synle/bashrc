/** Verifies MCP translation into native OpenCode configuration. */
import { beforeAll, describe, it, expect } from "vitest";
import { getIndexFunction, loadScriptHelpers } from "./setup.js";

beforeAll(() => {
  loadScriptHelpers("software/scripts/advanced/llm/llm-common.js");
});

describe("translateMcpServersForOpencode", () => {
  it("translates a local stdio entry to opencode's `{ type, command, environment, enabled }` shape", async () => {
    const out = getIndexFunction("translateMcpServersForOpencode")({
      myserver: { command: "node", args: ["server.js"], env: { K: "V" } },
    });
    expect(out).toMatchInlineSnapshot(`
      {
        "myserver": {
          "command": [
            "node",
            "server.js",
          ],
          "enabled": true,
          "environment": {
            "K": "V",
          },
          "type": "local",
        },
      }
    `);
  });

  it("translates a local entry with no args / no env to `{ type, command: [command], enabled }`", async () => {
    const out = getIndexFunction("translateMcpServersForOpencode")({ bare: { command: "uvx" } });
    expect(out).toMatchInlineSnapshot(`
      {
        "bare": {
          "command": [
            "uvx",
          ],
          "enabled": true,
          "type": "local",
        },
      }
    `);
  });

  it("translates a remote URL entry to opencode's `{ type: 'remote', url, headers, enabled }` shape", async () => {
    const out = getIndexFunction("translateMcpServersForOpencode")({
      remote: { url: "https://example.com/mcp", headers: { Authorization: "Bearer x" } },
    });
    expect(out).toMatchInlineSnapshot(`
      {
        "remote": {
          "enabled": true,
          "headers": {
            "Authorization": "Bearer x",
          },
          "type": "remote",
          "url": "https://example.com/mcp",
        },
      }
    `);
  });

  it("omits `headers` when the remote entry doesn't carry any", async () => {
    const out = getIndexFunction("translateMcpServersForOpencode")({ r: { url: "https://example.com/mcp" } });
    expect(out).toMatchInlineSnapshot(`
      {
        "r": {
          "enabled": true,
          "type": "remote",
          "url": "https://example.com/mcp",
        },
      }
    `);
  });

  it("passes through an unknown-shape entry verbatim so opencode reports the schema error", async () => {
    const weird = { weird: { foo: "bar" } };
    const out = getIndexFunction("translateMcpServersForOpencode")(weird);
    expect(out).toEqual(weird);
  });

  it("returns an empty object when given an empty / undefined input", async () => {
    expect(getIndexFunction("translateMcpServersForOpencode")({})).toEqual({});
    expect(getIndexFunction("translateMcpServersForOpencode")(undefined)).toEqual({});
  });
});

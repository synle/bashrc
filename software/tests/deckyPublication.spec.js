/** Exercise the actual CI publication shell against an explicit local release-API simulation. */
import { afterEach, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";

/** Test-owned release workspaces, removed after each test. */
const workspaces = [];
/** Canonical rolling asset name used by external consumers. */
const asset = "steamos-decky__bundle.zip";
/** Execute the workflow's publication block with simulated gh transport; return process and persisted assets. */
function publish({ previous = true, failure = "" } = {}) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "decky-publication-"));
  workspaces.push(folder);
  fs.mkdirSync(path.join(folder, "decky-cache"));
  fs.writeFileSync(path.join(folder, "decky-cache", asset), "verified new bundle");
  const stateFile = path.join(folder, "release.json");
  fs.writeFileSync(stateFile, JSON.stringify({ assets: previous ? [{ id: 101, name: asset, bytes: "previous bundle" }] : [] }));
  fs.writeFileSync(
    path.join(folder, "gh"),
    `#!${process.execPath}
const fs = require("fs");
const path = require("path");
const args = process.argv.slice(2);
const state = JSON.parse(fs.readFileSync(process.env.RELEASE_STATE, "utf8"));
const save = () => fs.writeFileSync(process.env.RELEASE_STATE, JSON.stringify(state));
const fail = () => { save(); process.stderr.write("fixture transport failure\\n"); process.exit(1); };
if (args[0] === "release" && args[1] === "upload") {
  const name = path.basename(args[3]);
  if (args.includes("--clobber")) state.assets = state.assets.filter(item => item.name !== name);
  if (process.env.RELEASE_FAILURE === "upload") fail();
  if (state.assets.some(item => item.name === name)) fail();
  state.assets.push({ id: 202, name, bytes: fs.readFileSync(args[3], "utf8") });
} else if (args[0] === "api") {
  const method = args.includes("--method") ? args[args.indexOf("--method") + 1] : "GET";
  if (method === "GET") {
    const query = args[args.indexOf("--jq") + 1];
    const name = query.match(/select\\(\\.name == "([^"]+)"\\)/)[1];
    const record = state.assets.find(item => item.name === name);
    if (record) process.stdout.write(String(record.id) + "\\n");
  } else {
    const id = Number(args[1].split("/").pop());
    const record = state.assets.find(item => item.id === id);
    if (!record) fail();
    if (method === "PATCH") {
      const name = args[args.indexOf("-f") + 1].slice(5);
      if (id === 202 && process.env.RELEASE_FAILURE.includes("activation")) fail();
      if (id === 101 && name === "steamos-decky__bundle.zip" && process.env.RELEASE_FAILURE === "activation-and-rollback") fail();
      if (state.assets.some(item => item.id !== id && item.name === name)) fail();
      record.name = name;
    } else if (method === "DELETE") {
      if (process.env.RELEASE_FAILURE === "cleanup") fail();
      if (!state.assets.some(item => item.id === 202 && item.name === "steamos-decky__bundle.zip")) fail();
      state.assets = state.assets.filter(item => item.id !== id);
    } else fail();
  }
} else fail();
save();
`,
    { mode: 0o755 },
  );
  const workflow = fs.readFileSync(".github/workflows/build-main.yml", "utf8");
  const section = workflow.split("      - name: Upload Decky bundle to binary-cache release\n")[1];
  const script = section.match(/        run: \|\n([\s\S]*?)(?=\n      - name:)/)[1].replace(/^          /gm, "");
  const result = spawnSync("/bin/bash", ["-e", "-o", "pipefail", "-c", script], {
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${folder}:${process.env.PATH}`,
      RUNNER_TEMP: folder,
      CACHE_REPO: "acme/example",
      GITHUB_RUN_ID: "123",
      GITHUB_RUN_ATTEMPT: "1",
      RELEASE_STATE: stateFile,
      RELEASE_FAILURE: failure,
    },
  });
  return { ...result, assets: JSON.parse(fs.readFileSync(stateFile, "utf8")).assets };
}

afterEach(() => {
  for (const folder of workspaces.splice(0)) fs.rmSync(folder, { recursive: true, force: true });
});

describe("Decky CI publication (local API simulation, not a live GitHub release)", () => {
  it("preserves the previous consumer-visible asset when candidate upload fails", () => {
    const result = publish({ failure: "upload" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("fixture transport failure");
    expect(result.assets).toMatchInlineSnapshot(`
      [
        {
          "bytes": "previous bundle",
          "id": 101,
          "name": "steamos-decky__bundle.zip",
        },
      ]
    `);
  });
  it.each([true, false])("publishes the completed candidate with previous asset present=%s", (previous) => {
    const result = publish({ previous });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.assets).toMatchInlineSnapshot(`
      [
        {
          "bytes": "verified new bundle",
          "id": 202,
          "name": "steamos-decky__bundle.zip",
        },
      ]
    `);
  });
  it("restores the previous consumer-visible asset when candidate activation fails", () => {
    const result = publish({ failure: "activation" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("fixture transport failure");
    expect(result.assets).toMatchInlineSnapshot(`
      [
        {
          "bytes": "previous bundle",
          "id": 101,
          "name": "steamos-decky__bundle.zip",
        },
        {
          "bytes": "verified new bundle",
          "id": 202,
          "name": "steamos-decky__bundle.candidate-123-1.zip",
        },
      ]
    `);
  });
  it("retains the previous backup and reports a failed rollback without claiming success", () => {
    const result = publish({ failure: "activation-and-rollback" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Decky cache rollback failed; previous asset retained as steamos-decky__bundle.previous-123-1.zip");
    expect(result.assets).toMatchInlineSnapshot(`
      [
        {
          "bytes": "previous bundle",
          "id": 101,
          "name": "steamos-decky__bundle.previous-123-1.zip",
        },
        {
          "bytes": "verified new bundle",
          "id": 202,
          "name": "steamos-decky__bundle.candidate-123-1.zip",
        },
      ]
    `);
  });
  it("keeps the activated bundle and reports retained backup when cleanup fails", () => {
    const result = publish({ failure: "cleanup" });
    expect(result.status).toBe(0);
    expect(result.stderr).toContain("Decky cache published; retained backup steamos-decky__bundle.previous-123-1.zip");
    expect(result.assets).toMatchInlineSnapshot(`
      [
        {
          "bytes": "previous bundle",
          "id": 101,
          "name": "steamos-decky__bundle.previous-123-1.zip",
        },
        {
          "bytes": "verified new bundle",
          "id": 202,
          "name": "steamos-decky__bundle.zip",
        },
      ]
    `);
  });
});

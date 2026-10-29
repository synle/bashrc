/** Filesystem contracts for pinned upstream resources and generated Sy adapter paths. */
import { afterEach, describe, expect, it } from "vitest";
import { expandSourceMarkers, getIndexFunction } from "./setup.js";
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import vm from "vm";

/** @type {string} Repository source root. */
const ROOT = path.resolve(".");
/** @type {Function} Production placeholder substitution. */
const resolvePlaceholders = getIndexFunction("resolvePlaceholders");
/** @type {string} Literal dependency body with significant surrounding whitespace. */
const BODY = "\n# Fixture skill\n\n";
/** @type {string} A bundled helper that must never execute during deployment. */
const SCRIPT = "#!/bin/sh\nexit 73\n";
/** @type {object} Independently constructed immutable resource fixture. */
const SOURCE = {
  id: "fixture",
  repository: "acme/fixture-skills",
  revision: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  skills: ["fixture"],
  files: [
    {
      path: "skills/fixture/SKILL.md",
      sha256: crypto.createHash("sha256").update(BODY).digest("hex"),
      bytes: Buffer.byteLength(BODY),
      executable: false,
    },
    {
      path: "skills/fixture/scripts/check",
      sha256: crypto.createHash("sha256").update(SCRIPT).digest("hex"),
      bytes: Buffer.byteLength(SCRIPT),
      executable: true,
    },
  ],
};
/** @type {string[]} Test-owned homes, removed after each case. */
const homes = [];

/**
 * Load the production deployment seam with an owned filesystem and download boundary.
 * @param {object[]} sources - Provider fixtures substituted for the generated manifest.
 * @returns {{common: Record<string, any>, home: string, downloads: string[], providers: object[]}} Isolated deployment, real manifest, and observed URLs.
 * @throws {Error} On fixture filesystem or source-evaluation failure.
 */
function loadDeployment(sources = [SOURCE]) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "upstream skills "));
  homes.push(home);
  const downloads = [];
  const common = {
    fs,
    path,
    crypto,
    resolvePlaceholders,
    BASE_HOMEDIR_LINUX: home,
    SY_ROOT_FOLDER: path.join(home, "sy"),
    process: { env: { LLM_ROOT_FOLDER: path.join(home, "llm") } },
    IS_DRY_RUN: false,
    log: () => {},
    is_os_mac: 0,
    readJson: () => ({}),
    readText: async (_parts, sourcePath) => fs.readFileSync(path.join(ROOT, sourcePath), "utf8"),
    writeText: async (target, content) => {
      if (fs.existsSync(target) && fs.readFileSync(target, "utf8") === content) return;
      fs.writeFileSync(target, content);
    },
    safeSymlink: (target, destination) => fs.symlinkSync(target, destination),
    getOllamaHosts: async () => [],
    downloadAsset: async (url, destination) => {
      downloads.push(url);
      fs.writeFileSync(destination, url.endsWith("/SKILL.md") ? BODY : SCRIPT);
      return destination;
    },
  };
  const source = expandSourceMarkers(fs.readFileSync(path.join(ROOT, "software/scripts/advanced/llm/llm-common.js"), "utf8")).replace(
    /^(const|let) /gm,
    "var ",
  );
  vm.createContext(common);
  vm.runInContext(source, common);
  const providers = common.LLM_UPSTREAM_SKILL_SOURCES;
  common.LLM_UPSTREAM_SKILL_SOURCES = sources;
  return { common, home, downloads, providers };
}

afterEach(() => {
  for (const home of homes.splice(0)) fs.rmSync(home, { recursive: true, force: true });
});

describe("upstream adapter bindings", () => {
  it.each([
    ["debug", "superpowers", "systematic-debugging"],
    ["dep-bump", "khasky", "awesome-dependency-upgrade"],
    ["rfc", "khasky", "awesome-design-doc"],
    ["test-gap", "khasky", "awesome-test-gap-audit"],
    ["test-gap", "khasky", "awesome-test-writing"],
    ["plan-grill-me", "addy", "interview-me"],
    ["onboard-repo", "khasky", "awesome-agents-md-generator"],
    ["execute-plan", "superpowers", "executing-plans"],
  ])("renders %s with its installed %s/%s dependency", async (name, providerId, upstreamSkill) => {
    const { common, home, providers } = loadDeployment();
    const provider = providers.find((entry) => entry.id === providerId);
    const resource = `skills/${upstreamSkill}/SKILL.md`;
    const body = await common.readLLMCommandSource(name);
    expect(provider.files.map((file) => file.path)).toContain(resource);
    expect(body).toContain(path.join(home, "llm/upstream", providerId, provider.revision, resource));
    expect(body).toContain(path.join(home, "llm/upstream/ADAPTERS.md"));
    expect(body).not.toMatch(/<<[A-Z_]+>>/);
  });
});

describe("upstream skill resources", () => {
  it("installs exact pinned resources before publishing Sy adapters", async () => {
    const { common, home, downloads } = loadDeployment();
    await common.deploySharedLLMSkills();
    const folder = path.join(home, "llm/upstream/fixture", SOURCE.revision);
    expect(fs.existsSync(path.join(folder, "skills/fixture/SKILL.md"))).toBe(true);
    expect(fs.readFileSync(path.join(folder, "skills/fixture/SKILL.md"), "utf8")).toBe(BODY);
    expect(fs.readFileSync(path.join(folder, "skills/fixture/scripts/check"), "utf8")).toBe(SCRIPT);
    expect(downloads).toEqual([
      "https://raw.githubusercontent.com/acme/fixture-skills/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/skills/fixture/SKILL.md",
      "https://raw.githubusercontent.com/acme/fixture-skills/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/skills/fixture/scripts/check",
    ]);
    expect(fs.statSync(path.join(folder, "skills/fixture/scripts/check")).mode & 0o111).toBe(0o111);
    expect(fs.existsSync(path.join(home, "llm/skills/sy-debug/SKILL.md"))).toBe(true);
    expect(fs.readFileSync(path.join(home, "llm/upstream/ADAPTERS.md"), "utf8")).not.toContain("<<LLM_ROOT_FOLDER>>");
  });

  it("reuses verified resources offline without rewriting their identity", async () => {
    const { common, home } = loadDeployment();
    await common.deploySharedLLMUpstreamSkills();
    const file = path.join(home, "llm/upstream/fixture", SOURCE.revision, "skills/fixture/SKILL.md");
    const original = fs.statSync(file);
    common.downloadAsset = async () => {
      throw new Error("offline");
    };
    await common.deploySharedLLMUpstreamSkills();
    expect(fs.readFileSync(file, "utf8")).toBe(BODY);
    expect(fs.statSync(file).ino).toBe(original.ino);
    expect(fs.statSync(file).mtimeMs).toBe(original.mtimeMs);
  });

  it.each([
    ["parent traversal", { ...SOURCE, files: [{ ...SOURCE.files[0], path: "../escape" }] }],
    ["absolute path", { ...SOURCE, files: [{ ...SOURCE.files[0], path: "/escape" }] }],
    ["hidden component", { ...SOURCE, files: [{ ...SOURCE.files[0], path: "skills/.hidden/file" }] }],
    ["secret path", { ...SOURCE, files: [{ ...SOURCE.files[0], path: "skills/fixture/a.secret.md" }] }],
    ["mutable revision", { ...SOURCE, revision: "main" }],
    ["invalid repository", { ...SOURCE, repository: "https://example.com/escape" }],
    ["invalid provider", { ...SOURCE, id: "../escape" }],
    ["missing provider", { ...SOURCE, id: undefined }],
    ["negative size", { ...SOURCE, files: [{ ...SOURCE.files[0], bytes: -1 }] }],
    ["oversized resource", { ...SOURCE, files: [{ ...SOURCE.files[0], bytes: 999999999 }] }],
    ["duplicate resource", { ...SOURCE, files: [SOURCE.files[0], SOURCE.files[0]] }],
    ["missing skill", { ...SOURCE, files: [SOURCE.files[1]] }],
    ["invalid hash", { ...SOURCE, files: [{ ...SOURCE.files[0], sha256: "bad" }] }],
  ])("rejects %s before touching upstream folders", async (_label, provider) => {
    const { common, home, downloads } = loadDeployment([provider]);
    await expect(common.deploySharedLLMUpstreamSkills()).rejects.toThrow();
    expect(fs.existsSync(path.join(home, "llm/upstream"))).toBe(false);
    expect(downloads).toEqual([]);
  });

  it("removes only its failed stage when downloaded bytes do not match", async () => {
    const { common, home } = loadDeployment();
    common.downloadAsset = async (_url, destination) => fs.writeFileSync(destination, "corrupt");
    await expect(common.deploySharedLLMUpstreamSkills()).rejects.toThrow(/integrity/);
    expect(fs.readdirSync(path.join(home, "llm/upstream/fixture"))).toEqual([]);
    expect(fs.existsSync(path.join(home, "llm/skills"))).toBe(false);
  });

  it("does not overwrite a corrupt or privately edited installed revision", async () => {
    const { common, home, downloads } = loadDeployment();
    const folder = path.join(home, "llm/upstream/fixture", SOURCE.revision, "skills/fixture");
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, "SKILL.md"), "Private changes\n");
    await expect(common.deploySharedLLMUpstreamSkills()).rejects.toThrow(/integrity/);
    expect(fs.readFileSync(path.join(folder, "SKILL.md"), "utf8")).toBe("Private changes\n");
    expect(downloads).toEqual([]);
  });

  it("rejects a linked provider folder without writing into its foreign target", async () => {
    const { common, home, downloads } = loadDeployment();
    const foreign = path.join(home, "foreign");
    fs.mkdirSync(foreign);
    fs.mkdirSync(path.join(home, "llm/upstream"), { recursive: true });
    fs.symlinkSync(foreign, path.join(home, "llm/upstream/fixture"));
    await expect(common.deploySharedLLMUpstreamSkills()).rejects.toThrow(/symbolic link/);
    expect(fs.readdirSync(foreign)).toEqual([]);
    expect(downloads).toEqual([]);
  });

  it("rejects a dangling revision link without replacing it", async () => {
    const { common, home, downloads } = loadDeployment();
    const parent = path.join(home, "llm/upstream/fixture");
    const foreign = path.join(home, "missing-foreign");
    fs.mkdirSync(parent, { recursive: true });
    fs.symlinkSync(foreign, path.join(parent, SOURCE.revision));
    await expect(common.deploySharedLLMUpstreamSkills()).rejects.toThrow(/symbolic link/);
    expect(fs.readlinkSync(path.join(parent, SOURCE.revision))).toBe(foreign);
    expect(fs.existsSync(foreign)).toBe(false);
    expect(downloads).toEqual([]);
  });

  it("rejects duplicate providers before creating dependency state", async () => {
    const { common, home, downloads } = loadDeployment([SOURCE, SOURCE]);
    await expect(common.deploySharedLLMUpstreamSkills()).rejects.toThrow(/unique/);
    expect(fs.existsSync(path.join(home, "llm"))).toBe(false);
    expect(downloads).toEqual([]);
  });

  it("performs no writes or downloads during dry-run", async () => {
    const { common, home, downloads } = loadDeployment();
    common.IS_DRY_RUN = true;
    await common.deploySharedLLMUpstreamSkills();
    expect(fs.existsSync(path.join(home, "llm"))).toBe(false);
    expect(downloads).toEqual([]);
  });
});

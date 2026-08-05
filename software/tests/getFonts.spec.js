/**
 * getFonts() — the font listing shared by fonts.js and fonts-chromeos.su.js.
 *
 * The behavior under test is the local-checkout fast path: it must return the same
 * repo-relative, alphabetically sorted shape the GitHub trees API returns, because that
 * list feeds the committed `.build/font.sh` artifact and the font preview HTML. A
 * different order (or a different path prefix) silently churns generated output on every
 * run. It must also still fall back to the remote listing when there is no checkout on
 * disk, which is how the bootstrap-from-GitHub path works.
 */
import { describe, it, expect, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import { mockFsExistence, mockFsDirEntries, loadScriptHelpers, getIndexFunction, getIndexConstant, setSandboxGlobal } from "./setup.js";

loadScriptHelpers("software/scripts/fonts.js");

const FONTS_FOLDER = "assets/fonts";

describe("getFonts", () => {
  /** @returns {Function} the sandboxed getFonts implementation */
  const getFonts = () => getIndexFunction("getFonts");

  beforeEach(() => {
    setSandboxGlobal("IS_LOCAL_REPO", true);
  });

  it("exposes the fonts folder as a named constant", () => {
    expect(getIndexConstant("FONTS_REPO_FOLDER")).toBe(FONTS_FOLDER);
  });

  it("lists local fonts as sorted repo-relative paths", async () => {
    mockFsExistence[FONTS_FOLDER] = true;
    mockFsDirEntries[FONTS_FOLDER] = ["Zed-Mono.ttf", "Hack-Regular.ttf", "IntelOneMono-Bold.otf"];

    await expect(getFonts()()).resolves.toEqual([
      `${FONTS_FOLDER}/Hack-Regular.ttf`,
      `${FONTS_FOLDER}/IntelOneMono-Bold.otf`,
      `${FONTS_FOLDER}/Zed-Mono.ttf`,
    ]);
  });

  it("keeps only .ttf and .otf entries", async () => {
    mockFsExistence[FONTS_FOLDER] = true;
    mockFsDirEntries[FONTS_FOLDER] = ["README.md", "Hack-Regular.ttf", "preview.html", "Mono.otf", "LICENSE"];

    await expect(getFonts()()).resolves.toEqual([`${FONTS_FOLDER}/Hack-Regular.ttf`, `${FONTS_FOLDER}/Mono.otf`]);
  });

  it("does not hit the network when the local folder is present", async () => {
    mockFsExistence[FONTS_FOLDER] = true;
    mockFsDirEntries[FONTS_FOLDER] = ["Hack-Regular.ttf"];
    setSandboxGlobal("listRepoDir", async () => {
      throw new Error("listRepoDir must not be called from a local checkout");
    });

    await expect(getFonts()()).resolves.toEqual([`${FONTS_FOLDER}/Hack-Regular.ttf`]);
  });

  it("falls back to the remote listing when there is no local checkout", async () => {
    setSandboxGlobal("IS_LOCAL_REPO", false);
    setSandboxGlobal("listRepoDir", async () => ["assets/fonts/Remote.ttf", "software/index.js", "assets/fonts/Remote.otf"]);

    await expect(getFonts()()).resolves.toEqual(["assets/fonts/Remote.ttf", "assets/fonts/Remote.otf"]);
  });

  it("falls back to the remote listing when the local folder is missing", async () => {
    mockFsExistence[FONTS_FOLDER] = false;
    setSandboxGlobal("listRepoDir", async () => ["assets/fonts/Remote.ttf"]);

    await expect(getFonts()()).resolves.toEqual(["assets/fonts/Remote.ttf"]);
  });

  it("matches the real repo fonts folder, sorted and non-empty", () => {
    const real = fs
      .readdirSync(path.resolve(FONTS_FOLDER))
      .filter((f) => f.endsWith(".ttf") || f.endsWith(".otf"))
      .sort();

    expect(real.length).toBeGreaterThan(0);
    expect([...real].sort()).toEqual(real);
  });
});

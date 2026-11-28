import { execFileSync } from "child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "fs";
import os from "os";
import path from "path";
import { describe, expect, it } from "vitest";

const FAV_CLONE_URL = "https://github.com/synle/fav.git";

function cloneFav(folder) {
  execFileSync("git", ["clone", "--depth", "1", "--quiet", FAV_CLONE_URL, folder], {
    encoding: "utf8",
    timeout: 60000,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function referencedRvxPaths(source) {
  const matches = source.matchAll(/\$\{BASHRC_RAW_BASE_URL\}\/(docs\/android\/[A-Za-z0-9._-]+)/g);
  return [...new Set([...matches].map((match) => match[1]))].sort();
}

describe("fav RVX config links", () => {
  it("references RVX files that exist in this repo", () => {
    const folder = mkdtempSync(path.join(os.tmpdir(), "fav-rvx-"));
    try {
      cloneFav(folder);
      const source = readFileSync(path.join(folder, "index.js"), "utf8");
      const paths = referencedRvxPaths(source);
      expect(paths).toMatchInlineSnapshot(`
          [
            "docs/android/rvx-youtube-music.txt",
            "docs/android/rvx-youtube-video.txt",
            "docs/android/sponsorblock.json",
          ]
        `);
      const missing = paths.filter((rel) => !existsSync(path.resolve(rel)));
      expect(missing).toEqual([]);
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  }, 60000);
});

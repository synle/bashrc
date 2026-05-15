/** Regression test: required binaries must never be queued via *InBackground in any _full-setup.sh. */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * Linux distro _full-setup.sh scripts that queue installs. Each is scanned for
 * `installXxxPackageInBackground <name>` lines and checked against the
 * `required` list in ci-binaries.json.
 */
const SETUP_FILES = [
  "software/scripts/ubuntu/_full-setup.sh",
  "software/scripts/redhat/_full-setup.sh",
  "software/scripts/arch_linux/_full-setup.sh",
  "software/scripts/chromeos/_full-setup.sh",
  "software/scripts/steamos/_full-setup.sh",
];

/**
 * Names from ci-binaries.json's `required` list that ALSO appear as an apt /
 * dnf / pacman package under the same name. Packages whose name differs from
 * the binary they install (e.g. `httpie` provides `http`) must be listed in
 * REQUIRED_PACKAGE_ALIASES below — without that alias, a regression that
 * queues `httpie` in background would slip past this guard.
 */
const REQUIRED_PACKAGE_ALIASES = {
  http: ["httpie"], // httpie provides /usr/bin/http
};

/**
 * Build the set of package names that must NOT appear in any background queue.
 *
 * @returns {Set<string>} package names (lowercased) that are required-tier.
 */
function getRequiredPackageNames() {
  const data = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, "software/metadata/ci-binaries.json"), "utf-8"));
  const names = new Set();
  for (const entry of data.required) {
    const binaryName = typeof entry === "string" ? entry : entry.name;
    names.add(binaryName);
    for (const alias of REQUIRED_PACKAGE_ALIASES[binaryName] || []) {
      names.add(alias);
    }
  }
  return names;
}

describe("required binaries must not be queued via *InBackground", () => {
  const requiredPackages = getRequiredPackageNames();

  for (const relPath of SETUP_FILES) {
    it(`${relPath} queues no required packages in background`, () => {
      const fullPath = path.join(ROOT_DIR, relPath);
      const content = fs.readFileSync(fullPath, "utf-8");
      // Match e.g. `installAptPackageInBackground btop` or
      // `installPacmanPackageInBackground httpie # comment`. First word after
      // the call is the package name; we don't care about flags/comments.
      const re = /^\s*install\w+PackageInBackground\s+([\w@.-]+)/gm;
      const offenders = [];
      let m;
      while ((m = re.exec(content)) !== null) {
        if (requiredPackages.has(m[1])) {
          offenders.push(m[1]);
        }
      }
      expect(
        offenders,
        `Required binaries queued in background (will race the 5-minute _waitForBackgroundPackages cap → CI binary verification failure). Move these to the foreground installXxxPackage call: ${offenders.join(", ")}`,
      ).toEqual([]);
    });
  }
});

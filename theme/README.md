# Theme reference and Sy backups

This folder contains inert theme backups and an evidence-backed comparison report. Nothing here is installed automatically.

## Layout

```text
theme/
  baseline/<app>_dark.jsonc
  baseline/<app>_light.jsonc
  sy/<app>_dark.jsonc
  sy/<app>_light.jsonc
  sy/_palette_dark.jsonc
  sy/_palette_light.jsonc
  manifest.jsonc
  audit.jsonc
  mappings.jsonc
  AUDIT.md
```

- `baseline/` contains the selected native/default reference pairs. Some selected themes are bundled alternatives rather than factory defaults.
- `sy/` contains current Sy definitions, not the proposed improved colors.
- Shared palettes use the `_palette_` prefix so they sort before application files.
- `manifest.jsonc` records provenance, captured versions, source hashes, file hashes, licensing reviews, and explicit gaps.
- `audit.jsonc` contains static measurements and coverage comparisons.
- `mappings.jsonc` contains proposed bindings and measured core-color candidates. It is not deployment configuration.
- `AUDIT.md` explains the findings, concrete palette recommendations, per-app leads, and verification limits.

## Reading a backup

Every application file is a JSONC archive with capture metadata and a `definition` field. It is not necessarily an installable theme file.

Native Vimscript, Ghostty configuration, Termux properties, and Gemini TypeScript are inline under `sourceText`, `definition.sourceText`, or `inlineSources`.

Original source comments and palette markers remain inside quoted source strings. They are not active regeneration markers in the archival JSONC.

A file with `captureStatus: "gap"` is a capability record, not a color definition. Do not import it or count it as a captured theme.

Combined native theme families remain complete. Use the recorded selector to select the intended dark or light appearance.

## Captured inventory

| App              | Baseline pair                                       | Current Sy pair                                  |
| ---------------- | --------------------------------------------------- | ------------------------------------------------ |
| VS Code          | Default High Contrast / Default High Contrast Light | Both                                             |
| Sublime Text     | Mariana / Breakers, local backup only               | Both                                             |
| Zed              | Ayu Dark / Ayu Light                                | Both                                             |
| Vim              | Ayu dark / light                                    | Both; rendered Vimscript is inline               |
| Windows Terminal | One Half Dark / One Half Light                      | Both                                             |
| Ghostty          | Ayu / Ayu Light                                     | Both                                             |
| Termux           | Solarized dark / light                              | Dark only; light is a gap record                 |
| Claude Code      | Native presets not exported; gap records            | Both; emitted native override objects are inline |
| OpenCode         | Native CLI theme, both appearances                  | No adapter; gap records                          |
| Pi               | Native dark / light                                 | No adapter; gap records                          |
| Gemini           | Default / Default Light                             | No adapter; gap records                          |
| Copilot CLI      | Native palette definition unavailable; gap records  | No adapter; gap records                          |

The inventory contains 20 captured baseline definitions, 15 captured Sy definitions, 13 capability records, and two shared palette files.

## Limits and licensing

The report contains static source-pair evidence, not screenshots or proof of native rendering. No core colors or application mappings were changed.

License banners are left-aligned block comments of at most four lines, including delimiters. Known copyright notices are retained; full-text source links appear in the manifest.

Short attribution does not establish that all redistribution conditions are satisfied. Sublime references are local-only; verify their terms before publishing them.

Ghostty's collection license explicitly distinguishes collection rights from individual-theme rights. Resolve the recorded per-asset review before redistribution.

No repository license file was found for the Sy sources. This archive does not infer a license that the source does not declare.

## Integrity check

Run from the repository root with its existing development dependencies installed:

```bash
node <<'NODE'
const fs = require("fs");
const crypto = require("crypto");
const ts = require("typescript");
const parse = (file) => {
  const result = ts.parseConfigFileTextToJson(file, fs.readFileSync(file, "utf8"));
  if (result.error) throw new Error(file + ": invalid JSONC");
  return result.config;
};
const manifest = parse("theme/manifest.jsonc");
for (const entry of manifest.files) {
  const file = "theme/" + entry.file;
  const bytes = fs.readFileSync(file);
  const hash = crypto.createHash("sha256").update(bytes).digest("hex");
  if (hash !== entry.sha256 || bytes.length !== entry.bytes) throw new Error(file + ": integrity mismatch");
  if (file.endsWith(".jsonc")) parse(file);
}
console.log("Theme inventory, JSONC, and file hashes verified.");
NODE
```

The manifest excludes its own hash to avoid a circular checksum.

## Canonical plan

The loaded plan-placement rule requires the implementation plan to remain outside the checkout:

`/Users/syle/_extra/ai_llm/plans/bashrc-theme_mapping_audit.md`

`AUDIT.md` and `mappings.jsonc` consolidate the actionable findings inside this folder. The canonical plan includes the corresponding implementation leads and acceptance criteria.

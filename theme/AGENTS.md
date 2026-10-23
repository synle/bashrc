# Theme context

Follow the authoritative workflow in `README.md` → Required workflow for new feature colors.

- **Ownership:** `sy/_palette_dark.jsonc` and `sy/_palette_light.jsonc` own foundation colors and recipes. Keep their role sets aligned.
- **Bindings:** application sources in `sy/` bind both appearances to semantic/derived roles with placeholder comments. Do not hand-author product color literals.
- **Generation:** `software/tools/build-include.js` resolves recipes and replaces literals while preserving marker comments, including stable string recipes.
- **Consumption:** use `readSyTheme(app, mode)` and the responsible renderer/deployer. Do not recreate palettes in scripts or generated native files.
- **References:** `baseline/` is immutable evidence, not an active source or regeneration target.
- **Audit:** `audit.jsonc` and `AUDIT.md` track current closure. Preserve historical measurements and explicit capability/native-verification limits.
- **Chrome:** saved tab/title-bar identity remains separate from uniform terminal content colors. Respect shared opt-out without changing existing files when disabled.

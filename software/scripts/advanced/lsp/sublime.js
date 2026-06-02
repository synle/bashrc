/** Registers the LSP core + per-language LSP-* helper packages with Sublime Text's Package Control. Independent of the install layer (lsp/install.sh) — both ship in separate PRs. */
// SOURCE software/scripts/advanced/editor.common.js
// SOURCE software/scripts/advanced/lsp/lsp-common.js

/**
 * Reads existing Package Control settings and returns the `installed_packages` array.
 * Returns `[]` when the file is missing or unreadable so the merge below starts from a
 * stable empty list.
 *
 * @param {string} pkgControlPath - Absolute path to `Packages/User/Package Control.sublime-settings`.
 * @returns {Promise<string[]>} Existing installed_packages list (may be empty).
 */
async function _readExistingInstalledPackages(pkgControlPath) {
  try {
    const existing = await readJson`${pkgControlPath}`;
    return Array.isArray(existing && existing.installed_packages) ? existing.installed_packages : [];
  } catch (e) {
    return [];
  }
}

/**
 * Main entry: queues a build artifact listing the LSP packages and (when Sublime is
 * locally installed) merges them into the user's Package Control settings without
 * dropping any packages already registered there.
 */
async function doWork() {
  const lspPackages = getSublimeLspPackages();
  log(">>> sublime-lsp: registering LSP packages:", lspPackages.join(", "));

  /** @type {object[]} Build artifacts batched into a single writeBuildArtifact call (CI ScriptSkipError after first invocation). */
  const artifacts = [
    {
      file: `${BUILD_DIR}/sublime-text-ext-lsp`,
      data: `# Use Preferences > Package Control > Package Control: Advanced Install Package. \n${lspPackages.join(",")}`,
    },
  ];

  const targetPath = await _getPathSublimeText();
  if (targetPath) {
    log(">>> sublime-lsp: deploying to local Sublime install:", targetPath);
    const pkgControlPath = path.join(targetPath, "Packages/User/Package Control.sublime-settings");
    const existingPackages = await _readExistingInstalledPackages(pkgControlPath);

    /** @type {string[]} Merge: keep every package already installed, add our LSP-* set, dedupe + sort. */
    const mergedPackages = [...new Set([...existingPackages, ...lspPackages])].sort();

    await backupConfigFile(pkgControlPath);
    await writeJson(pkgControlPath, { installed_packages: mergedPackages });

    // LSP.sublime-settings — enable format-on-save uniformly across every attached LSP
    // server (including LSP-prettier). Matches VS Code's `editor.formatOnSave: true` and
    // Zed's `format_on_save: "on"` so the format chord and save use the same code path.
    const lspSettingsPath = path.join(targetPath, "Packages/User/LSP.sublime-settings");
    await backupConfigFile(lspSettingsPath);
    await writeJson(lspSettingsPath, { lsp_format_on_save: true });

    // LSP-prettier.sublime-settings — pin the selector explicitly so we don't depend on
    // LSP-prettier's evolving default. Includes every syntax scope Prettier handles AND
    // the MarkdownEditing package's scope (`text.html.markdown.gfm`) so .md files format
    // whether the user runs stock Sublime markdown or MarkdownEditing.
    const lspPrettierSettingsPath = path.join(targetPath, "Packages/User/LSP-prettier.sublime-settings");
    await backupConfigFile(lspPrettierSettingsPath);
    await writeJson(lspPrettierSettingsPath, {
      selector:
        "source.css | source.scss | source.less | source.js | source.jsx | source.ts | source.tsx | source.vue | source.json | source.jsonc | source.yaml | source.graphql | text.html | text.html.basic | text.html.markdown | text.html.markdown.gfm",
    });
  } else {
    log(">>> sublime-lsp: Sublime Text config dir not found — skipping local deploy");
  }

  await writeBuildArtifact(artifacts);
}

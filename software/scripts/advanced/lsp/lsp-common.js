/** Single source of truth for LSP server binary names and per-editor identifiers, shared by lsp/zed.js, lsp/sublime.js, and the LSP extension entries added to vs-code.js's TO_INSTALL_EXTENSIONS list. Independent of the install layer (lsp/install.sh) — both ship in separate PRs. */

/**
 * Per-language LSP server descriptors. Used by editor wiring scripts to:
 *   - point Zed's `lsp.<key>.binary.path` at the shared binary (lsp/zed.js),
 *   - register Sublime LSP-* helper packages via Package Control (lsp/sublime.js),
 *   - keep VS Code extension IDs documented (the actual install list lives in
 *     `software/scripts/advanced/vs-code.js`'s `TO_INSTALL_EXTENSIONS` — this map
 *     records the *intended* IDs for cross-referencing only).
 *
 * Schema per entry:
 *   - `binary`         — Bare CLI name of the language server. Zed accepts a bare
 *                        binary name and resolves it via `$PATH`, so callers do not
 *                        need to probe the full install path.
 *   - `extensionId`    — VS Code Marketplace ID (`publisher.name`). `null` when VS
 *                        Code ships the server built-in (TypeScript, HTML, CSS, JSON,
 *                        Markdown) or when no preferred extension exists (SQL).
 *   - `sublimePackage` — Package Control package name (`LSP-<lang>`). `null` to skip
 *                        Sublime registration for that language.
 *   - `stdioFlag`      — When `true`, Zed needs to pass `["--stdio"]` to the binary.
 *                        Native-protocol servers (rust-analyzer, gopls, jdtls, taplo)
 *                        set this to `false`. Used by `lsp/zed.js` to build the
 *                        `binary.arguments` array.
 *
 * @type {Record<string, { binary: string, extensionId: (string|null), sublimePackage: (string|null), stdioFlag: boolean }>}
 */
const LSP_SERVERS = {
  typescript: { binary: "typescript-language-server", extensionId: null, sublimePackage: "LSP-typescript", stdioFlag: true },
  pyright: { binary: "pyright-langserver", extensionId: "ms-pyright.pyright", sublimePackage: "LSP-pyright", stdioFlag: true },
  "rust-analyzer": {
    binary: "rust-analyzer",
    extensionId: "rust-lang.rust-analyzer",
    sublimePackage: "LSP-rust-analyzer",
    stdioFlag: false,
  },
  gopls: { binary: "gopls", extensionId: "golang.go", sublimePackage: "LSP-gopls", stdioFlag: false },
  jdtls: { binary: "jdtls", extensionId: "redhat.java", sublimePackage: "LSP-jdtls", stdioFlag: false },
  bash: { binary: "bash-language-server", extensionId: "mads-hartmann.bash-ide-vscode", sublimePackage: "LSP-bash", stdioFlag: true },
  yaml: { binary: "yaml-language-server", extensionId: "redhat.vscode-yaml", sublimePackage: "LSP-yaml", stdioFlag: true },
  html: { binary: "vscode-html-language-server", extensionId: null, sublimePackage: "LSP-html", stdioFlag: true },
  css: { binary: "vscode-css-language-server", extensionId: null, sublimePackage: "LSP-css", stdioFlag: true },
  json: { binary: "vscode-json-language-server", extensionId: null, sublimePackage: "LSP-json", stdioFlag: true },
  eslint: { binary: "vscode-eslint-language-server", extensionId: "dbaeumer.vscode-eslint", sublimePackage: "LSP-eslint", stdioFlag: true },
  docker: { binary: "docker-langserver", extensionId: "ms-azuretools.vscode-docker", sublimePackage: "LSP-dockerfile", stdioFlag: true },
  markdown: { binary: "vscode-markdown-language-server", extensionId: null, sublimePackage: "LSP-marksman", stdioFlag: true },
  vue: { binary: "vue-language-server", extensionId: "Vue.volar", sublimePackage: "LSP-volar", stdioFlag: true },
  tailwind: {
    binary: "tailwindcss-language-server",
    extensionId: "bradlc.vscode-tailwindcss",
    sublimePackage: "LSP-tailwindcss",
    stdioFlag: true,
  },
  graphql: { binary: "graphql-lsp", extensionId: "GraphQL.vscode-graphql", sublimePackage: "LSP-graphql", stdioFlag: true },
  prisma: { binary: "prisma-language-server", extensionId: "Prisma.prisma", sublimePackage: "LSP-prisma", stdioFlag: true },
  sql: { binary: "sql-language-server", extensionId: null, sublimePackage: "LSP-SQL", stdioFlag: true },
  taplo: { binary: "taplo", extensionId: "tamasfe.even-better-toml", sublimePackage: null, stdioFlag: false },
};

/**
 * Builds the Zed-shaped `lsp` block from `LSP_SERVERS`. Maps each entry to:
 *   `{ "<key>": { "binary": { "path": "<binary>", "arguments": [...] } } }`
 * `arguments` is `["--stdio"]` for servers that require it (per `stdioFlag`), `[]`
 * otherwise — Zed accepts an empty array.
 * @returns {object} Object suitable for direct assignment to `settings.lsp` in Zed.
 */
function buildZedLspBlock() {
  /** @type {Record<string, object>} */
  const out = {};
  for (const [key, { binary, stdioFlag }] of Object.entries(LSP_SERVERS)) {
    out[key] = { binary: { path: binary, arguments: stdioFlag ? ["--stdio"] : [] } };
  }
  return out;
}

/**
 * Returns the list of Sublime LSP-* helper packages to register via Package Control.
 * Always includes the core `LSP` client package; appends every non-null `sublimePackage`
 * from `LSP_SERVERS`. De-duplicates so a future shared entry doesn't double-register.
 *
 * NOTE: Prettier in Sublime is handled by the standalone `JsPrettier` package (registered
 * in `software/scripts/advanced/sublime-text.js`), NOT via LSP. We tried LSP-prettier and
 * it either wasn't auto-installable from Package Control or didn't attach reliably. The
 * Sublime keymap chord is context-bound — JsPrettier owns prettier-supported file types,
 * lsp_format_document owns everything else (rust-analyzer, pyright, gopls, jdtls, etc.).
 *
 * @returns {string[]} Sorted, deduped list of package names.
 */
function getSublimeLspPackages() {
  const pkgs = new Set(["LSP"]);
  for (const { sublimePackage } of Object.values(LSP_SERVERS)) {
    if (sublimePackage) pkgs.add(sublimePackage);
  }
  return Array.from(pkgs).sort();
}

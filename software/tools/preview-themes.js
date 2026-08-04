/**
 * preview-themes.js - Renders a visual preview of every generated editor color theme.
 *
 * Output: .build/_theme-preview.html and .build/_theme-preview.png (both gitignored via `/.build/_*`).
 *
 * The theme specs live in `software/scripts/advanced/*-color-{dark,light}.jsonc` and are generated
 * from `COLOR_MAP` in `software/tools/build-include.js`. Unit tests assert numeric contrast floors,
 * but they can only check the pairs someone thought to list. This tool covers the rest of the gap:
 * it mocks up the surfaces where two colors sitting next to each other is the whole point, so a
 * collision that no assertion happens to cover is still obvious on sight.
 *
 * Every panel here exists because it caught a real bug:
 *   - title bar active vs inactive        -> both resolved to `surface`; a blurred window read as focused
 *   - tab active / inactive / unfocused   -> unfocused-active matched inactive; active tab vanished
 *   - list hover / active / inactive sel  -> hover matched inactive selection
 *   - terminal ANSI ramp                  -> dark ansi.black was #000000 on a near-black background
 *
 * Colors are read straight from the committed theme files, so the preview can never drift from what
 * actually ships. Anything the tool cannot find is rendered as magenta (`MISSING`) rather than
 * silently falling back, so a renamed or dropped key shows up instead of quietly looking fine.
 *
 * Usage:
 *   make preview_themes
 *   node software/tools/preview-themes.js            # html + png
 *   node software/tools/preview-themes.js --html     # skip the puppeteer render
 */
const fs = require("fs");
const path = require("path");

/** Repo root, resolved from this file so the tool works from any cwd. */
const REPO_ROOT = path.resolve(__dirname, "..", "..");

/** Directory holding the generated theme specs. */
const THEME_DIR = path.join(REPO_ROOT, "software", "scripts", "advanced");

/** Build output directory for the generated artifacts. */
const BUILD_DIR = path.join(REPO_ROOT, ".build");

/** Sentinel used when a theme does not define a key the preview asks for. */
const MISSING = "#ff00ff";

/**
 * Sentinel for a syntax scope that no rule covers. TextMate-based editors render such scopes in the
 * default `editor.foreground`, so this is normal inheritance, not a theme defect -- it is resolved to
 * the theme foreground before rendering and reported separately from genuinely missing chrome keys.
 * @type {string}
 */
const INHERIT = "__inherit__";

/**
 * Parse a JSONC file (`//` comments + trailing commas).
 *
 * Quoted strings are matched before comments so a `"https://..."` value is not truncated at its `//`.
 *
 * @param {string} file - Absolute path to the `.jsonc` file.
 * @returns {object} The parsed object.
 */
function parseJsonc(file) {
  const raw = fs.readFileSync(file, "utf-8");
  const stripped = raw.replace(/"(?:\\.|[^"\\])*"|\/\/[^\n]*/g, (m) => (m.startsWith("//") ? "" : m));
  return JSON.parse(stripped.replace(/,(\s*[}\]])/g, "$1"));
}

/**
 * Look up the first key that exists in a color bag.
 *
 * @param {object} bag - Flat map of theme key to color string.
 * @param {...string} keys - Candidate keys, tried in order.
 * @returns {string} The first defined value, or `MISSING`.
 */
function pick(bag, ...keys) {
  for (const key of keys) {
    if (bag && bag[key]) return bag[key];
  }
  return MISSING;
}

/**
 * Composite a `#rrggbbaa` color over an opaque backdrop. Opaque input passes through unchanged.
 *
 * The preview renders on solid panels, so alpha-carrying theme values have to be flattened to see
 * what the user actually perceives.
 *
 * @param {string} color - `#rrggbb` or `#rrggbbaa`.
 * @param {string} backdrop - Opaque `#rrggbb` backdrop.
 * @returns {string} An opaque `#rrggbb` color.
 */
function flatten(color, backdrop) {
  if (typeof color !== "string" || !color.startsWith("#")) return MISSING;
  if (color.length <= 7) return color;
  const alpha = parseInt(color.slice(7, 9), 16) / 255;
  const base = backdrop.length > 7 ? backdrop.slice(0, 7) : backdrop;
  const channels = [1, 3, 5].map((i) =>
    Math.round(parseInt(color.slice(i, i + 2), 16) * alpha + parseInt(base.slice(i, i + 2), 16) * (1 - alpha)),
  );
  return `#${channels.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** Relative luminance of an opaque `#rrggbb` color, per WCAG 2.1. */
function luminance(hex) {
  const channels = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/**
 * WCAG contrast ratio between two colors, compositing over `backdrop` first when either has alpha.
 *
 * @param {string} a - First color.
 * @param {string} b - Second color.
 * @param {string} backdrop - Backdrop used to flatten any alpha.
 * @returns {number} Contrast ratio between 1 and 21.
 */
function contrast(a, b, backdrop) {
  const [x, y] = [flatten(a, backdrop), flatten(b, backdrop)];
  if (x === MISSING || y === MISSING) return 0;
  const [la, lb] = [luminance(x), luminance(y)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * Build the preview model for a Zed theme file.
 *
 * @param {string} file - Path to `zed-color-{dark,light}.jsonc`.
 * @returns {object} Normalized preview model.
 */
function readZed(file) {
  const theme = parseJsonc(file).themes[0];
  const s = theme.style;
  /** Resolve a syntax token's color, since Zed nests it under `{ color }`. */
  const syn = (name) => (s.syntax[name] && s.syntax[name].color) || MISSING;
  return {
    name: theme.name,
    editor: "Zed",
    appearance: theme.appearance,
    bg: pick(s, "editor.background", "background"),
    surface: pick(s, "surface.background", "elevated_surface.background"),
    fg: pick(s, "text"),
    fgMuted: pick(s, "text.muted"),
    fgDisabled: pick(s, "text.disabled"),
    border: pick(s, "border"),
    guide: pick(s, "editor.indent_guide", "editor.wrap_guide"),
    lineNr: pick(s, "editor.line_number"),
    lineNrActive: pick(s, "editor.active_line_number"),
    activeLine: pick(s, "editor.active_line.background"),
    selection: pick(s, "element.selected"),
    match: pick(s, "search.match_background"),
    hover: pick(s, "element.hover"),
    pressed: pick(s, "element.active"),
    activeSel: pick(s, "element.selected"),
    // Zed has no distinct "inactive selection"; ghost_element.selected is the closest analogue.
    inactiveSel: pick(s, "ghost_element.selected", "element.active"),
    titleActive: pick(s, "title_bar.background"),
    titleInactive: pick(s, "title_bar.inactive_background", "title_bar.background"),
    tabActive: pick(s, "tab.active_background"),
    tabInactive: pick(s, "tab.inactive_background"),
    // Zed has no unfocused-active tab key; null tells the preview to skip that comparison rather
    // than report a self-comparison as a collision.
    tabUnfocused: null,
    statusBar: pick(s, "status_bar.background"),
    accent: pick(s, "text.accent"),
    cursor: pick(s, "editor.foreground"),
    syntax: {
      keyword: syn("keyword"),
      string: syn("string"),
      number: syn("number"),
      comment: syn("comment"),
      func: syn("function"),
      type: syn("type"),
      variable: syn("variable"),
      property: syn("property"),
      punctuation: syn("punctuation"),
    },
    status: {
      error: pick(s, "error"),
      warning: pick(s, "warning"),
      info: pick(s, "info"),
      hint: pick(s, "hint"),
    },
    ansi: ANSI_NAMES.map((n) => pick(s, `terminal.ansi.${n}`)),
    ansiBright: ANSI_NAMES.map((n) => pick(s, `terminal.ansi.bright_${n}`)),
  };
}

/** Lowercase ANSI color names in standard 0-7 order. */
const ANSI_NAMES = ["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white"];

/**
 * Resolve a TextMate scope against a rule list the way a real editor does: the winning rule is the
 * one whose declared scope is the longest dotted prefix of the requested scope. An exact match wins
 * outright; `variable.other` legitimately styles `variable.other.property`, and a bare `punctuation`
 * rule would style every `punctuation.*`. Naive equality matching reports false "unresolved key"
 * findings for scopes the theme actually covers.
 *
 * @param {Array<object>} rules - TextMate rules, each with `scope` (string or array) and a color.
 * @param {string} scope - The dotted scope being resolved, e.g. `variable.other.property`.
 * @param {(rule: object) => string|undefined} getColor - Extracts the color from a matched rule.
 * @returns {string} The resolved color, or `MISSING` when no rule covers the scope.
 */
function resolveScope(rules, scope, getColor) {
  let best = null;
  let bestLen = -1;
  for (const rule of rules) {
    const declared = Array.isArray(rule.scope) ? rule.scope : [rule.scope];
    for (const sc of declared) {
      if (typeof sc !== "string") continue;
      // Split on commas so `"a, b"` behaves like `["a", "b"]`, then match on dotted-prefix boundaries.
      for (const one of sc.split(",").map((s) => s.trim())) {
        if (!one) continue;
        if (scope !== one && !scope.startsWith(`${one}.`)) continue;
        if (one.length > bestLen) {
          bestLen = one.length;
          best = rule;
        }
      }
    }
  }
  return (best && getColor(best)) || INHERIT;
}

/**
 * Build the preview model for a VS Code theme file.
 *
 * @param {string} file - Path to `vs-code-color-{dark,light}.jsonc`.
 * @param {string} label - Display name for the panel.
 * @param {string} appearance - `dark` or `light`.
 * @returns {object} Normalized preview model.
 */
function readVsCode(file, label, appearance) {
  const parsed = parseJsonc(file);
  const c = parsed["workbench.colorCustomizations"];
  const rules = parsed["editor.tokenColorCustomizations"].textMateRules || [];
  /** Resolve a TextMate scope to its foreground via longest-dotted-prefix rule matching. */
  const syn = (scope) => resolveScope(rules, scope, (r) => r.settings && r.settings.foreground);
  return {
    name: label,
    editor: "VS Code",
    appearance,
    bg: pick(c, "editor.background"),
    surface: pick(c, "sideBar.background"),
    fg: pick(c, "editor.foreground"),
    fgMuted: pick(c, "descriptionForeground"),
    fgDisabled: pick(c, "disabledForeground", "input.placeholderForeground"),
    border: pick(c, "panel.border", "editorGroup.border"),
    guide: pick(c, "editorIndentGuide.background1", "editorIndentGuide.background"),
    lineNr: pick(c, "editorLineNumber.foreground"),
    lineNrActive: pick(c, "editorLineNumber.activeForeground"),
    activeLine: pick(c, "editor.lineHighlightBackground"),
    selection: pick(c, "editor.selectionBackground"),
    match: pick(c, "editor.findMatchBackground"),
    hover: pick(c, "list.hoverBackground"),
    pressed: pick(c, "list.dropBackground"),
    activeSel: pick(c, "list.activeSelectionBackground"),
    inactiveSel: pick(c, "list.inactiveSelectionBackground"),
    titleActive: pick(c, "titleBar.activeBackground"),
    titleInactive: pick(c, "titleBar.inactiveBackground"),
    tabActive: pick(c, "tab.activeBackground"),
    tabInactive: pick(c, "tab.inactiveBackground"),
    tabUnfocused: pick(c, "tab.unfocusedActiveBackground"),
    statusBar: pick(c, "statusBar.background"),
    accent: pick(c, "textLink.foreground", "focusBorder"),
    cursor: pick(c, "editorCursor.foreground"),
    syntax: {
      keyword: syn("keyword"),
      string: syn("string"),
      number: syn("constant.numeric"),
      comment: syn("comment"),
      func: syn("entity.name.function"),
      type: syn("entity.name.type"),
      variable: syn("variable"),
      property: syn("variable.other.property"),
      punctuation: syn("punctuation"),
    },
    status: {
      error: pick(c, "editorError.foreground"),
      warning: pick(c, "editorWarning.foreground"),
      info: pick(c, "editorInfo.foreground"),
      hint: pick(c, "editorHint.foreground", "editorInfo.foreground"),
    },
    ansi: ANSI_NAMES.map((n) => pick(c, `terminal.ansi${n[0].toUpperCase()}${n.slice(1)}`)),
    ansiBright: ANSI_NAMES.map((n) => pick(c, `terminal.ansiBright${n[0].toUpperCase()}${n.slice(1)}`)),
  };
}

/**
 * Build the preview model for a Sublime Text theme file.
 *
 * Sublime values are `var(name)` references into a `variables` block, so they are dereferenced here.
 *
 * @param {string} file - Path to `sublime-text-color-{dark,light}.jsonc`.
 * @param {string} label - Display name for the panel.
 * @param {string} appearance - `dark` or `light`.
 * @returns {object} Normalized preview model.
 */
function readSublime(file, label, appearance) {
  const parsed = parseJsonc(file);
  const vars = parsed.variables || {};
  /** Dereference a `var(name)` indirection down to a literal color. */
  const deref = (value) => {
    let out = value;
    for (let i = 0; i < 5 && typeof out === "string" && out.startsWith("var("); i++) out = vars[out.slice(4, -1)];
    return typeof out === "string" && out.startsWith("#") ? out : MISSING;
  };
  const g = {};
  for (const [k, v] of Object.entries(parsed.globals || {})) g[k] = deref(v);
  /** Resolve a Sublime scope selector to its foreground via longest-dotted-prefix rule matching. */
  const syn = (scope) => {
    const hex = resolveScope(parsed.rules || [], scope, (r) => r.foreground);
    return hex === INHERIT ? INHERIT : deref(hex);
  };
  return {
    name: label,
    editor: "Sublime",
    appearance,
    bg: pick(g, "background"),
    surface: deref(vars.surface || ""),
    fg: pick(g, "foreground"),
    fgMuted: pick(g, "invisibles"),
    fgDisabled: deref(vars.fg_dim || ""),
    border: deref(vars.guide_active || ""),
    guide: pick(g, "guide"),
    lineNr: pick(g, "line_highlight"),
    lineNrActive: pick(g, "caret"),
    activeLine: pick(g, "line_highlight"),
    selection: pick(g, "selection"),
    match: pick(g, "find_highlight"),
    hover: deref(vars.surface || ""),
    pressed: pick(g, "selection"),
    activeSel: pick(g, "selection"),
    inactiveSel: pick(g, "inactive_selection", "selection"),
    titleActive: deref(vars.surface || ""),
    titleInactive: pick(g, "background"),
    tabActive: pick(g, "background"),
    tabInactive: deref(vars.surface || ""),
    // Sublime tab chrome lives in the .sublime-theme file, not the color scheme.
    tabUnfocused: null,
    statusBar: deref(vars.surface || ""),
    accent: pick(g, "caret"),
    cursor: pick(g, "caret"),
    syntax: {
      keyword: syn("keyword"),
      string: syn("string"),
      number: syn("constant.numeric"),
      comment: syn("comment"),
      func: syn("entity.name.function"),
      type: syn("entity.name.type"),
      variable: syn("variable"),
      property: syn("variable.other.member"),
      punctuation: syn("punctuation"),
    },
    // Sublime color schemes carry no diagnostic severity colors; that lives in the LSP plugin.
    status: { error: null, warning: null, info: null, hint: null },
    ansi: [],
    ansiBright: [],
  };
}

/** Code sample rendered in each mock editor, as `[token, syntaxRole]` pairs per line. */
const CODE_SAMPLE = [
  [["// resolve the active profile for this host", "comment"]],
  [
    ["const", "keyword"],
    [" ", null],
    ["MAX_RETRIES", "variable"],
    [" = ", "punctuation"],
    ["3", "number"],
    [";", "punctuation"],
  ],
  [],
  [
    ["export function ", "keyword"],
    ["loadProfile", "func"],
    ["(", "punctuation"],
    ["host", "variable"],
    [": ", "punctuation"],
    ["Host", "type"],
    [") {", "punctuation"],
  ],
  [
    ["  const ", "keyword"],
    ["name", "variable"],
    [" = ", "punctuation"],
    ["host", "variable"],
    [".", "punctuation"],
    ["profile", "property"],
    [" ?? ", "punctuation"],
    ['"default"', "string"],
    [";", "punctuation"],
  ],
  [
    ["  return ", "keyword"],
    ["{ ", "punctuation"],
    ["name", "property"],
    [", ", "punctuation"],
    ["retries", "property"],
    [": ", "punctuation"],
    ["MAX_RETRIES", "variable"],
    [" };", "punctuation"],
  ],
  [["}", "punctuation"]],
];

/**
 * Render one mock editor window for a theme.
 *
 * @param {object} t - Preview model from one of the `read*` builders.
 * @returns {string} An HTML fragment.
 */
function renderTheme(t) {
  const bg = flatten(t.bg, t.bg);
  /** Flatten a value against this theme's editor background. */
  const f = (c) => flatten(c, bg);
  /** Flatten a value against this theme's chrome surface. */
  const fs2 = (c) => flatten(c, flatten(t.surface, bg));

  const codeRows = CODE_SAMPLE.map((tokens, i) => {
    const lineNo = i + 1;
    const isActive = lineNo === 5;
    const spans = tokens
      .map(([text, role]) => {
        const color = role ? t.syntax[role] || MISSING : t.fg;
        const safe = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        // Line 6 doubles as the selection sample so selection-vs-text legibility is visible.
        const sel = lineNo === 6 ? ` background:${f(t.selection)};` : "";
        return `<span style="color:${f(color)};${sel}">${safe}</span>`;
      })
      .join("");
    return `<div class="ln" style="background:${isActive ? f(t.activeLine) : "transparent"}">
      <span class="gutter" style="color:${isActive ? f(t.lineNrActive) : f(t.lineNr)}">${lineNo}</span>
      <span class="guide" style="border-left:1px solid ${f(t.guide)}"></span>
      <span class="code">${spans || "&nbsp;"}</span>
    </div>`;
  }).join("");

  /** Render a labelled swatch pair and flag it when the two colors are indistinguishable. */
  const pair = (label, a, b, aLabel, bLabel) => {
    if (a === null || b === null) {
      return `<div class="pair">
        <div class="pair-label">${label} <em>n/a</em></div>
        <div class="pair-row"><div class="chip" style="background:${f(a || b)};color:${f(t.fg)}">${a ? aLabel : bLabel}</div></div>
      </div>`;
    }
    const ratio = contrast(a, b, bg);
    const collide = ratio < 1.06;
    return `<div class="pair">
      <div class="pair-label">${label} ${collide ? '<em class="bad">SAME</em>' : `<em>${ratio.toFixed(2)}:1</em>`}</div>
      <div class="pair-row">
        <div class="chip" style="background:${f(a)};color:${f(t.fg)}">${aLabel}</div>
        <div class="chip" style="background:${f(b)};color:${f(t.fg)}">${bLabel}</div>
      </div>
    </div>`;
  };

  const listRow = (label, fill) => `<div class="row" style="background:${fs2(fill)};color:${f(t.fg)}">${label}</div>`;

  const ansiRamp = (colors, label) =>
    colors.length
      ? `<div class="ansi"><span class="ansi-label" style="color:${f(t.fgMuted)}">${label}</span>${colors
          .map((c) => `<span class="ansi-cell" style="background:${f(c)}"></span>`)
          .join("")}</div>`
      : "";

  return `<section class="theme">
    <h2>${t.editor} &mdash; ${t.name} <em>(${t.appearance})</em></h2>
    <div class="window" style="background:${bg};border-color:${f(t.border)}">
      <div class="titles">
        <div class="title" style="background:${f(t.titleActive)};color:${f(t.fg)}">title bar &mdash; focused</div>
        <div class="title" style="background:${f(t.titleInactive)};color:${f(t.fgMuted)}">title bar &mdash; blurred</div>
      </div>
      <div class="tabs" style="background:${fs2(t.surface)};border-color:${f(t.border)}">
        <span class="tab" style="background:${f(t.tabActive)};color:${f(t.fg)};border-top:2px solid ${f(t.accent)}">active.ts</span>
        <span class="tab" style="background:${f(t.tabInactive)};color:${f(t.fgDisabled)}">inactive.ts</span>
        ${t.tabUnfocused ? `<span class="tab" style="background:${f(t.tabUnfocused)};color:${f(t.fgMuted)}">unfocused-active.ts</span>` : ""}
      </div>
      <div class="body">
        <div class="sidebar" style="background:${fs2(t.surface)};border-color:${f(t.border)}">
          ${listRow("rest", t.surface)}
          ${listRow("hover", t.hover)}
          ${listRow("selected (focused)", t.activeSel)}
          ${listRow("selected (blurred)", t.inactiveSel)}
        </div>
        <div class="editor">${codeRows}</div>
      </div>
      <div class="status" style="background:${f(t.statusBar)};color:${f(t.fg)}">
        ${
          t.status.error
            ? `<span style="color:${f(t.status.error)}">&#9679; 2 errors</span>
        <span style="color:${f(t.status.warning)}">&#9679; 5 warnings</span>
        <span style="color:${f(t.status.info)}">&#9679; info</span>
        <span style="color:${f(t.status.hint)}">&#9679; hint</span>`
            : `<span style="color:${f(t.fgMuted)}">Ln 5, Col 12 &nbsp; Spaces: 2 &nbsp; UTF-8</span>`
        }
      </div>
      ${ansiRamp(t.ansi, "ansi")}
      ${ansiRamp(t.ansiBright, "bright")}
    </div>
    <div class="pairs">
      ${pair("title bar", t.titleActive, t.titleInactive, "focused", "blurred")}
      ${pair("tab state", t.tabInactive, t.tabUnfocused, "inactive", "unfocused-active")}
      ${pair("list state", t.hover, t.inactiveSel, "hover", "inactive sel")}
      ${pair("editor fill", t.activeLine, t.selection, "active line", "selection")}
    </div>
  </section>`;
}

/**
 * Assemble the full preview document.
 *
 * @param {object[]} themes - Preview models to render.
 * @returns {string} A complete HTML document.
 */
function renderHtml(themes) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Theme preview</title><style>
  body { margin:0; padding:24px; background:#3a3a3a; color:#f0f0f0;
         font:13px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
  h1 { font-size:18px; margin:0 0 4px; }
  .sub { color:#b0b0b0; margin:0 0 20px; font-size:12px; }
  .grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:22px; }
  .theme h2 { font-size:13px; font-weight:600; margin:0 0 6px; }
  .theme h2 em { color:#b0b0b0; font-weight:400; }
  .window { border:1px solid; border-radius:6px; overflow:hidden; }
  .titles { display:flex; }
  .titles .title { flex:1; padding:5px 9px; font-size:11px; }
  .tabs { display:flex; gap:1px; padding:0; border-bottom:1px solid; }
  .tab { padding:6px 11px; font-size:11px; }
  .body { display:flex; min-height:132px; }
  .sidebar { width:150px; border-right:1px solid; padding:4px 0; }
  .sidebar .row { padding:4px 9px; font-size:11px; }
  .editor { flex:1; padding:6px 0; font:12px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace; }
  .ln { display:flex; align-items:baseline; padding:0 8px; }
  .gutter { width:20px; text-align:right; flex:none; font-size:11px; }
  .guide { display:inline-block; width:0; height:1.1em; margin:0 8px; flex:none; }
  .code { white-space:pre; }
  .status { display:flex; gap:14px; padding:4px 9px; font-size:11px; }
  .ansi { display:flex; align-items:center; gap:2px; padding:4px 9px; }
  .ansi-label { width:44px; font-size:10px; }
  .ansi-cell { width:26px; height:13px; border-radius:2px; }
  .pairs { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-top:8px; }
  .pair-label { font-size:10px; color:#c8c8c8; margin-bottom:3px; }
  .pair-label em { font-style:normal; color:#8f8f8f; }
  .pair-label em.bad { color:#ff5f5f; font-weight:700; }
  .pair-row { display:flex; gap:2px; }
  .chip { flex:1; padding:5px 4px; font-size:9px; text-align:center; border-radius:2px; }
</style></head><body>
  <h1>Editor theme preview</h1>
  <p class="sub">Generated from the committed theme specs. Magenta means a key the preview asked for is
  missing. <strong>SAME</strong> marks two colors that render effectively identically.</p>
  <div class="grid">${themes.map(renderTheme).join("")}</div>
</body></html>`;
}

/** Collect every theme preview model from the committed specs. */
function collectThemes() {
  const themes = [
    readZed(path.join(THEME_DIR, "zed-color-dark.jsonc")),
    readZed(path.join(THEME_DIR, "zed-color-light.jsonc")),
    readVsCode(path.join(THEME_DIR, "vs-code-color-dark.jsonc"), "Sy Dark", "dark"),
    readVsCode(path.join(THEME_DIR, "vs-code-color-light.jsonc"), "Sy Light", "light"),
    readSublime(path.join(THEME_DIR, "sublime-text-color-dark.jsonc"), "Sy Dark", "dark"),
    readSublime(path.join(THEME_DIR, "sublime-text-color-light.jsonc"), "Sy Light", "light"),
  ];
  // Collapse TextMate scope inheritance the way a real editor does, so the preview shows the colors
  // that actually render. Which scopes inherited is kept for the stdout report.
  for (const t of themes) {
    t.inherited = [];
    for (const [scope, color] of Object.entries(t.syntax)) {
      if (color !== INHERIT) continue;
      t.inherited.push(scope);
      t.syntax[scope] = t.fg;
    }
  }
  return themes;
}

/**
 * Generate the preview HTML and, unless `--html` is passed, screenshot it with Puppeteer.
 *
 * @returns {Promise<void>}
 */
async function main() {
  const htmlOnly = process.argv.includes("--html");
  const themes = collectThemes();

  fs.mkdirSync(BUILD_DIR, { recursive: true });
  const htmlPath = path.join(BUILD_DIR, "_theme-preview.html");
  fs.writeFileSync(htmlPath, renderHtml(themes));
  console.log(`>> Theme preview HTML: ${htmlPath}`);

  // Report collisions on stdout too, so the tool is useful without opening the image.
  for (const t of themes) {
    const bg = flatten(t.bg, t.bg);
    const checks = [
      ["title bar focused/blurred", t.titleActive, t.titleInactive],
      ["tab inactive/unfocused-active", t.tabInactive, t.tabUnfocused],
      ["list hover/inactive-selection", t.hover, t.inactiveSel],
    ];
    for (const [label, a, b] of checks) {
      if (a === null || b === null) continue;
      if (contrast(a, b, bg) < 1.06) console.log(`   !! ${t.editor} ${t.name}: ${label} render the same`);
    }
    const missing = [];
    /**
     * Walk the preview model and collect every dotted path still set to `MISSING`.
     * @param {any} node Current node.
     * @param {string} prefix Dotted path accumulated so far.
     * @returns {void}
     */
    const scan = (node, prefix) => {
      if (node === MISSING) return void missing.push(prefix);
      if (Array.isArray(node)) return node.forEach((v, i) => scan(v, `${prefix}[${i}]`));
      if (node && typeof node === "object") {
        for (const [k, v] of Object.entries(node)) scan(v, prefix ? `${prefix}.${k}` : k);
      }
    };
    scan(t, "");
    if (missing.length) console.log(`   ?? ${t.editor} ${t.name}: unresolved keys -> ${missing.join(", ")}`);
    if (t.inherited.length) {
      console.log(`   -- ${t.editor} ${t.name}: inherits default foreground -> ${t.inherited.join(", ")}`);
    }
  }

  if (htmlOnly) return;

  let puppeteer;
  try {
    puppeteer = require("puppeteer");
  } catch {
    console.log(">> puppeteer not installed; skipping PNG (run `make init`, or pass --html)");
    return;
  }

  const browser = await puppeteer.launch({ headless: "new" });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1560, height: 1200, deviceScaleFactor: 2 });
    await page.goto(`file://${htmlPath}`, { waitUntil: "load" });
    const pngPath = path.join(BUILD_DIR, "_theme-preview.png");
    await page.screenshot({ path: pngPath, fullPage: true });
    console.log(`>> Theme preview PNG:  ${pngPath}`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

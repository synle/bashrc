/**
 * text-server keybindings: the one table of every keyboard shortcut the browser editor handles,
 * plus the dispatcher that wires it to the page and the CodeMirror 5 editor.
 *
 * Browser script (no imports). text-server.cjs inlines it into text-server.html in place of the
 * `<script src="text-server.keybindings.cjs"></script>` tag, so the page never fetches it; the
 * `module.exports` tail exists only so vitest can load the pure helpers.
 *
 * `super` follows docs/editor-keybindings.md (OS_KEY): the OS key is Cmd on macOS and Alt on
 * Windows/Linux, but browsers there speak Ctrl. A browser page cannot tell which convention the
 * user's hands expect, so every `super` chord is registered as a PAIR:
 *
 *   super+d   mac -> Cmd-D,  Alt-D        win/linux -> Ctrl-D, Alt-D
 *
 * A chord that already names ctrl (super+ctrl+g) keeps only the pair member that still has a
 * distinct modifier on that OS: mac -> Cmd-Ctrl-G + Ctrl-Alt-G, win/linux -> Ctrl-Alt-G.
 * Exception, arrows and Backspace: the pair member that is the OS's native word-motion modifier
 * (Alt on mac, Ctrl on win/linux: word jump / word delete) is dropped, so super+left stays
 * mac Cmd-Left and win/linux Alt-Left and native word navigation keeps working.
 * Names follow CodeMirror's canonical order (Shift-Cmd-Ctrl-Alt-Key) so they read like its keymaps.
 */
(function (root) {
  /** True when the browser runs on macOS / iOS (Cmd is the OS key). */
  const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

  /** CodeMirror's modifier order in a key name. */
  const MODIFIER_ORDER = ["Shift", "Cmd", "Ctrl", "Alt"];

  /** Chord token -> modifier name. `super` is handled separately (it expands into a pair). */
  const MODIFIER_TOKENS = { shift: "Shift", ctrl: "Ctrl", alt: "Alt", cmd: "Cmd" };

  /** Lowercase chord key token -> CodeMirror key name, for keys whose name is not just the uppercased token. */
  const KEY_TOKENS = {
    up: "Up",
    down: "Down",
    left: "Left",
    right: "Right",
    backspace: "Backspace",
    delete: "Delete",
    enter: "Enter",
    "\\": "\\",
  };

  /** KeyboardEvent.code (layout-independent physical key) -> CodeMirror key name. Letters/digits/F-keys are derived. */
  const CODE_TO_KEY = {
    BracketLeft: "[",
    BracketRight: "]",
    Backslash: "\\",
    Slash: "/",
    Comma: ",",
    Period: ".",
    Equal: "=",
    Minus: "-",
    Semicolon: ";",
    Quote: "'",
    Backquote: "`",
    ArrowUp: "Up",
    ArrowDown: "Down",
    ArrowLeft: "Left",
    ArrowRight: "Right",
    Backspace: "Backspace",
    Delete: "Delete",
    Enter: "Enter",
  };

  /** Key tokens whose native word-motion modifier must not be taken by a super pair. */
  const WORD_MOTION_KEYS = ["up", "down", "left", "right", "backspace"];

  /**
   * Where a binding fires. PAGE: anywhere on the page. EDITOR: only while the CodeMirror editor has
   * focus, so typing in the search box or a prompt keeps the browser's own behavior.
   */
  const Scope = { PAGE: "page", EDITOR: "editor" };

  /**
   * Every shortcut. `action` is either a key of the page's actions object, a CodeMirror command
   * name (EDITOR scope), or `extend:<command>` to run a motion command while extending the selection.
   * Order matters only for the docs table; conflicts throw in buildIndex.
   * @type {{chord: string, action: string, scope: string, label: string}[]}
   */
  const BINDINGS = [
    // --- Files & app ---
    { chord: "super+s", action: "snapshot", scope: Scope.PAGE, label: "Snapshot the open file" },
    { chord: "super+shift+s", action: "saveNow", scope: Scope.PAGE, label: "Save pending edits now" },
    { chord: "super+r", action: "refreshAll", scope: Scope.PAGE, label: "Refresh the file list and the open file" },
    { chord: "f5", action: "refreshAll", scope: Scope.PAGE, label: "Refresh (alt)" },
    { chord: "super+n", action: "newFile", scope: Scope.PAGE, label: "New file" },
    { chord: "f2", action: "renameFile", scope: Scope.PAGE, label: "Rename the open file" },
    { chord: "super+shift+[", action: "prevFile", scope: Scope.PAGE, label: "Previous file in the list" },
    { chord: "super+shift+]", action: "nextFile", scope: Scope.PAGE, label: "Next file in the list" },
    { chord: "super+c", action: "copyImage", scope: Scope.PAGE, label: "Copy the open image (else normal copy)" },
    // --- Editor UI ---
    { chord: "super+\\", action: "toggleSidebar", scope: Scope.PAGE, label: "Toggle the file list sidebar" },
    { chord: "ctrl+shift+super+\\", action: "toggleWrap", scope: Scope.PAGE, label: "Toggle soft wrap" },
    { chord: "cmd+shift+enter", action: "toggleWrap", scope: Scope.PAGE, label: "Toggle soft wrap (mac alt)" },
    { chord: "ctrl+shift+enter", action: "toggleWrap", scope: Scope.PAGE, label: "Toggle soft wrap (alt)" },
    { chord: "super+=", action: "zoomIn", scope: Scope.PAGE, label: "Editor font zoom in" },
    { chord: "super+-", action: "zoomOut", scope: Scope.PAGE, label: "Editor font zoom out" },
    { chord: "super+0", action: "zoomReset", scope: Scope.PAGE, label: "Reset editor font zoom" },
    // --- Search ---
    { chord: "super+shift+f", action: "findInFiles", scope: Scope.PAGE, label: "Find in files (content search)" },
    { chord: "super+p", action: "quickOpen", scope: Scope.PAGE, label: "Quick open (file name search)" },
    { chord: "super+f", action: "find", scope: Scope.EDITOR, label: "Find" },
    { chord: "super+h", action: "replace", scope: Scope.EDITOR, label: "Find and replace" },
    { chord: "super+g", action: "findNext", scope: Scope.EDITOR, label: "Find next" },
    { chord: "super+shift+g", action: "findPrev", scope: Scope.EDITOR, label: "Find previous" },
    { chord: "super+;", action: "jumpToLine", scope: Scope.EDITOR, label: "Go to line" },
    { chord: "ctrl+m", action: "goToBracket", scope: Scope.EDITOR, label: "Jump to matching bracket" },
    // --- Multi-cursor ---
    { chord: "super+d", action: "selectNextOccurrence", scope: Scope.EDITOR, label: "Select next match" },
    { chord: "super+shift+d", action: "selectPrevOccurrence", scope: Scope.EDITOR, label: "Select previous match" },
    { chord: "super+ctrl+g", action: "findAllUnder", scope: Scope.EDITOR, label: "Select all matches" },
    { chord: "super+l", action: "selectLine", scope: Scope.EDITOR, label: "Select line" },
    { chord: "super+shift+l", action: "splitSelectionByLine", scope: Scope.EDITOR, label: "Cursor on every selected line" },
    // --- Text editing ---
    { chord: "super+a", action: "selectAll", scope: Scope.EDITOR, label: "Select all" },
    { chord: "super+z", action: "undo", scope: Scope.EDITOR, label: "Undo" },
    { chord: "super+y", action: "redo", scope: Scope.EDITOR, label: "Redo" },
    { chord: "super+shift+z", action: "redo", scope: Scope.EDITOR, label: "Redo (alt)" },
    { chord: "super+backspace", action: "delLineLeft", scope: Scope.EDITOR, label: "Delete to line start" },
    // Literal cmd/ctrl/alt (no super pair): super would collide with the explicit alt chord off mac.
    { chord: "cmd+shift+backspace", action: "trimTrailingWhitespace", scope: Scope.EDITOR, label: "Trim trailing whitespace" },
    { chord: "ctrl+shift+backspace", action: "trimTrailingWhitespace", scope: Scope.EDITOR, label: "Trim trailing whitespace (alt)" },
    { chord: "alt+shift+backspace", action: "trimTrailingWhitespace", scope: Scope.EDITOR, label: "Trim trailing whitespace (alt)" },
    { chord: "cmd+shift+delete", action: "uniqueLines", scope: Scope.EDITOR, label: "Remove duplicate lines" },
    { chord: "ctrl+shift+delete", action: "uniqueLines", scope: Scope.EDITOR, label: "Remove duplicate lines (alt)" },
    { chord: "alt+shift+delete", action: "uniqueLines", scope: Scope.EDITOR, label: "Remove duplicate lines (alt)" },
    // --- Code editing ---
    { chord: "super+/", action: "toggleComment", scope: Scope.EDITOR, label: "Toggle comment" },
    { chord: "super+[", action: "indentLess", scope: Scope.EDITOR, label: "Outdent" },
    { chord: "super+]", action: "indentMore", scope: Scope.EDITOR, label: "Indent" },
    { chord: "super+,", action: "fold", scope: Scope.EDITOR, label: "Fold" },
    { chord: "super+.", action: "unfold", scope: Scope.EDITOR, label: "Unfold" },
    // --- Cursor movement ---
    { chord: "super+up", action: "goPageUp", scope: Scope.EDITOR, label: "Page up" },
    { chord: "super+down", action: "goPageDown", scope: Scope.EDITOR, label: "Page down" },
    { chord: "super+left", action: "goLineStartSmart", scope: Scope.EDITOR, label: "Line start" },
    { chord: "super+right", action: "goLineEnd", scope: Scope.EDITOR, label: "Line end" },
    { chord: "super+shift+up", action: "extend:goPageUp", scope: Scope.EDITOR, label: "Select page up" },
    { chord: "super+shift+down", action: "extend:goPageDown", scope: Scope.EDITOR, label: "Select page down" },
    { chord: "super+shift+left", action: "extend:goLineStartSmart", scope: Scope.EDITOR, label: "Select to line start" },
    { chord: "super+shift+right", action: "extend:goLineEnd", scope: Scope.EDITOR, label: "Select to line end" },
    { chord: "super+ctrl+up", action: "goDocStart", scope: Scope.EDITOR, label: "Top of file" },
    { chord: "super+ctrl+down", action: "goDocEnd", scope: Scope.EDITOR, label: "Bottom of file" },
    { chord: "super+ctrl+shift+up", action: "extend:goDocStart", scope: Scope.EDITOR, label: "Select to top of file" },
    { chord: "super+ctrl+shift+down", action: "extend:goDocEnd", scope: Scope.EDITOR, label: "Select to bottom of file" },
  ];

  /**
   * Turn one chord key token into its CodeMirror key name.
   * @param {string} token Lowercase key token ("d", "[", "up", "f5").
   * @returns {string} Key name ("D", "[", "Up", "F5").
   */
  function keyNameFor(token) {
    if (KEY_TOKENS[token]) return KEY_TOKENS[token];
    return token.toUpperCase();
  }

  /**
   * Expand a chord into the concrete CodeMirror key names it is registered under.
   * @param {string} chord `+`-joined, lowercase, key last ("super+shift+d", "ctrl+m", "f5").
   * @param {boolean} isMac Whether the OS key is Cmd (mac) or Ctrl (everything else).
   * @returns {string[]} Unique key names, e.g. ["Shift-Cmd-D", "Shift-Alt-D"].
   * @throws {Error} On an unknown modifier token or an empty key.
   */
  function expandChord(chord, isMac) {
    const parts = chord.split("+");
    const key = parts.pop();
    if (!key) throw new Error("chord has no key: " + chord);
    const base = new Set();
    let hasSuper = false;
    for (const token of parts) {
      if (token === "super") {
        hasSuper = true;
        continue;
      }
      if (!MODIFIER_TOKENS[token]) throw new Error("unknown modifier '" + token + "' in chord: " + chord);
      base.add(MODIFIER_TOKENS[token]);
    }
    // The pair: the browser's OS key, and Alt (the repo's OS_KEY on Windows/Linux).
    let superVariants = hasSuper ? [isMac ? "Cmd" : "Ctrl", "Alt"] : [null];
    if (hasSuper && WORD_MOTION_KEYS.includes(key)) superVariants = [isMac ? "Cmd" : "Alt"];
    const names = [];
    for (const variant of superVariants) {
      // A variant already named explicitly would collapse into a different, plainer chord; skip it.
      if (variant && base.has(variant)) continue;
      const mods = new Set(base);
      if (variant) mods.add(variant);
      const name =
        MODIFIER_ORDER.filter((m) => mods.has(m))
          .map((m) => m + "-")
          .join("") + keyNameFor(key);
      if (!names.includes(name)) names.push(name);
    }
    return names;
  }

  /**
   * CodeMirror-style key name for a keydown event, from the physical key (e.code) so Alt chords
   * still match on mac, where Alt+key types a symbol instead of the letter.
   * @param {{code: string, shiftKey: boolean, metaKey: boolean, ctrlKey: boolean, altKey: boolean}} e Keydown event.
   * @returns {string|null} Name like "Shift-Cmd-D", or null for keys no binding uses.
   */
  function eventKeyName(e) {
    const code = e.code || "";
    let key = CODE_TO_KEY[code];
    if (!key && /^Key[A-Z]$/.test(code)) key = code.slice(3);
    if (!key && /^Digit[0-9]$/.test(code)) key = code.slice(5);
    if (!key && /^F[0-9]{1,2}$/.test(code)) key = code;
    if (!key) return null;
    const held = { Shift: e.shiftKey, Cmd: e.metaKey, Ctrl: e.ctrlKey, Alt: e.altKey };
    return (
      MODIFIER_ORDER.filter((m) => held[m])
        .map((m) => m + "-")
        .join("") + key
    );
  }

  /**
   * Map every concrete key name to its binding for one OS.
   * @param {typeof BINDINGS} bindings Binding table.
   * @param {boolean} isMac OS flavor to expand for.
   * @returns {Map<string, (typeof BINDINGS)[number]>} Key name -> binding.
   * @throws {Error} When two bindings expand to the same key name (a silent shadow otherwise).
   */
  function buildIndex(bindings, isMac) {
    const index = new Map();
    for (const binding of bindings) {
      for (const name of expandChord(binding.chord, isMac)) {
        const prev = index.get(name);
        if (prev) throw new Error("keybinding conflict on " + name + ": '" + prev.chord + "' vs '" + binding.chord + "'");
        index.set(name, binding);
      }
    }
    return index;
  }

  /**
   * Strip trailing spaces / tabs from every line.
   * @param {string[]} lines Document lines.
   * @returns {string[]} New array, same length, each line right-trimmed of whitespace.
   */
  function trimTrailingLines(lines) {
    return lines.map((line) => line.replace(/[ \t]+$/, ""));
  }

  /**
   * Drop repeated lines, keeping the first occurrence and the original order (case-sensitive).
   * @param {string[]} lines Lines to dedupe.
   * @returns {string[]} New array without duplicates.
   */
  function uniqueLines(lines) {
    const seen = new Set();
    return lines.filter((line) => (seen.has(line) ? false : seen.add(line)));
  }

  /**
   * Register the editor commands the table names that CodeMirror and its addons do not ship.
   * trimTrailingWhitespace: right-trim every line of the document in one undo step.
   * uniqueLines: drop duplicate lines (first wins) in the lines the primary selection touches,
   * or the whole document when nothing is selected.
   * selectPrevOccurrence: reverse of the sublime keymap's selectNextOccurrence — add a cursor on the
   * previous match of the topmost selection's text, wrapping at the top. Empty selection selects the word.
   * @param {object} CodeMirror The CodeMirror 5 global.
   */
  function registerCommands(CodeMirror) {
    CodeMirror.commands.trimTrailingWhitespace = (cm) => {
      const before = cm.getValue().split("\n");
      const after = trimTrailingLines(before);
      cm.operation(() => {
        after.forEach((line, i) => {
          if (line !== before[i]) cm.replaceRange("", CodeMirror.Pos(i, line.length), CodeMirror.Pos(i, before[i].length));
        });
      });
    };
    CodeMirror.commands.uniqueLines = (cm) => {
      const sel = cm.listSelections()[0];
      const whole = !cm.somethingSelected();
      const first = whole ? cm.firstLine() : sel.from().line;
      const last = whole ? cm.lastLine() : sel.to().line;
      const from = CodeMirror.Pos(first, 0);
      const to = CodeMirror.Pos(last, cm.getLine(last).length);
      const before = cm.getRange(from, to).split("\n");
      const after = uniqueLines(before);
      if (after.length !== before.length) cm.replaceRange(after.join("\n"), from, to);
    };
    CodeMirror.commands.selectPrevOccurrence = (cm) => {
      if (!cm.somethingSelected()) return CodeMirror.commands.selectNextOccurrence(cm);
      const sels = cm.listSelections();
      const text = cm.getRange(sels[0].from(), sels[0].to());
      let cur = cm.getSearchCursor(text, sels[0].from());
      let found = cur.findPrevious();
      if (!found) {
        cur = cm.getSearchCursor(text, CodeMirror.Pos(cm.lastLine()));
        found = cur.findPrevious();
      }
      if (!found) return;
      const taken = sels.some((s) => CodeMirror.cmpPos(s.from(), cur.from()) === 0 && CodeMirror.cmpPos(s.to(), cur.to()) === 0);
      if (!taken) cm.addSelection(cur.from(), cur.to());
    };
  }

  /**
   * Install the single keydown dispatcher (capture phase, so browser defaults and CodeMirror's own
   * keymap never see a handled chord). PAGE actions come from `actions`; EDITOR actions run as
   * CodeMirror commands. An action returning `false` declines: the event is left alone.
   * @param {{editor: object, CodeMirror: object, actions: Object<string, function(KeyboardEvent): (boolean|void)>, target?: EventTarget, isMac?: boolean}} opts
   * @returns {Map<string, object>} The key-name index in use (for tooltips / debugging).
   * @throws {Error} When a PAGE binding names an action missing from `actions`.
   */
  function install(opts) {
    const { editor, CodeMirror, actions } = opts;
    const target = opts.target || document;
    const index = buildIndex(BINDINGS, opts.isMac === undefined ? IS_MAC : opts.isMac);
    for (const b of BINDINGS) {
      if (b.scope === Scope.PAGE && typeof actions[b.action] !== "function") throw new Error("missing page action: " + b.action);
    }
    registerCommands(CodeMirror);
    target.addEventListener(
      "keydown",
      (e) => {
        const binding = index.get(eventKeyName(e));
        if (!binding) return;
        if (binding.scope === Scope.EDITOR && !editor.hasFocus()) return;
        if (binding.scope === Scope.PAGE) {
          if (actions[binding.action](e) === false) return;
        } else if (binding.action.startsWith("extend:")) {
          editor.setExtending(true);
          editor.execCommand(binding.action.slice("extend:".length));
          editor.setExtending(false);
        } else {
          editor.execCommand(binding.action);
        }
        e.preventDefault();
        e.stopPropagation();
      },
      true,
    );
    return index;
  }

  /**
   * Human hint for a tooltip, e.g. "Cmd/Alt+S" on mac, "Ctrl/Alt+S" elsewhere.
   * @param {string} action Action name from the table.
   * @param {boolean} [isMac] OS flavor; defaults to the running browser.
   * @returns {string} Every chord bound to the action, joined with " or ".
   */
  function hintFor(action, isMac) {
    const mac = isMac === undefined ? IS_MAC : isMac;
    return BINDINGS.filter((b) => b.action === action)
      .map((b) => expandChord(b.chord, mac).join(" / ").replace(/-/g, "+"))
      .join(" or ");
  }

  const api = {
    IS_MAC,
    Scope,
    BINDINGS,
    expandChord,
    eventKeyName,
    buildIndex,
    trimTrailingLines,
    uniqueLines,
    registerCommands,
    install,
    hintFor,
  };
  root.TextServerKeys = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);

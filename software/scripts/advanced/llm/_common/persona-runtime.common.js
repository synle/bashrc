/**
 * Creates isolated persona sessions with explicit command parsing and canonical rule selection.
 * @param {{caveman: string, ultracave: string}} rules - Full canonical rules for each active mode.
 * @returns {{mode: function(string): string, update: function(string, string): object, context: function(string): string, restore: function(string, string): void, forget: function(string): void}} Session runtime; no IO or payload rewriting.
 */
function createLLMPersonaRuntime(rules) {
  if (
    !rules ||
    typeof rules.caveman !== "string" ||
    !rules.caveman.trim() ||
    typeof rules.ultracave !== "string" ||
    !rules.ultracave.trim()
  )
    throw new TypeError("Persona rules require nonempty caveman and ultracave content");
  const sessions = new Map();
  /** @param {string} id Session identity. @returns {string} Active mode, defaulting to caveman. */
  function mode(id) {
    return sessions.get(id) ?? "caveman";
  }
  /** @param {string} id Session identity. @param {string} value Saved mode. @returns {void} Restores only recognized modes. */
  function restore(id, value) {
    if (!["caveman", "ultracave", "off"].includes(value)) throw new TypeError("Invalid persona mode");
    sessions.set(id, value);
  }
  /** @param {string} id Session identity. @returns {void} Releases one completed session. */
  function forget(id) {
    sessions.delete(id);
  }
  /**
   * Parses only a complete explicit control prompt; quoted or embedded directives do not switch modes.
   * @param {string} id Session identity.
   * @param {string} prompt Raw submitted prompt.
   * @returns {{mode: string, status: boolean, changed: boolean}} Current mode and transition result.
   */
  function update(id, prompt) {
    const command = typeof prompt === "string" ? prompt.trim().toLowerCase() : "";
    const before = mode(id);
    const status = command === "/caveman status" || command === "caveman status";
    if (["/caveman", "caveman mode", "/caveman on"].includes(command)) restore(id, "caveman");
    if (["/ultracave", "/caveman ultra", "ultracave mode"].includes(command)) restore(id, "ultracave");
    if (["/caveman off", "stop caveman", "normal mode"].includes(command)) restore(id, "off");
    return { mode: mode(id), status, changed: mode(id) !== before };
  }
  /** @param {string} id Session identity. @returns {string} Full active rules or explicit off instruction. */
  function context(id) {
    const active = mode(id);
    const body =
      active === "off"
        ? "Use normal concise prose. Do not apply Caveman or ultracave style."
        : active === "ultracave"
          ? rules.caveman + "\n\n" + rules.ultracave
          : rules.caveman;
    return `<sy_persona mode="${active}">\n${body}\n</sy_persona>`;
  }
  return { mode, restore, forget, update, context };
}

if (typeof module !== "undefined") module.exports = { createLLMPersonaRuntime };

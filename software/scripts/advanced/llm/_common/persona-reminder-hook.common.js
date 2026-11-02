/** @type {Record<string, object | ((reminder: string) => object)>} Documented hook event payload adapters. */
const payloads = {
  copilot: (reminder) => ({ additionalContext: reminder }),
  claude: {
    hookEventName: "UserPromptSubmit",
  },
  gemini: {
    hookEventName: "BeforeAgent",
  },
};

const target = payloads[process.argv[2]];
const reminder = process.argv[3];
const event = process.argv[4];
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
if (!target || typeof reminder !== "string" || !reminder) {
  process.stderr.write("Expected hook target: copilot, claude, or gemini\n");
  process.exitCode = 2;
} else {
  /** Emits the documented hook response without exposing input or session identifiers. @param {string} context Persona rules. @returns {void} Writes JSON. */
  function emit(context) {
    const payload =
      typeof target === "function"
        ? target(context)
        : {
            hookSpecificOutput: { ...target, hookEventName: event || target.hookEventName, additionalContext: context },
          };
    process.stdout.write(JSON.stringify(payload) + "\n");
  }
  if (process.argv[2] !== "claude" || event === undefined) emit(reminder);
  else if (!["SessionStart", "SubagentStart", "UserPromptSubmit"].includes(event)) {
    process.stderr.write("Unsupported persona hook event\n");
    process.exitCode = 2;
  } else {
    let input = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      input += chunk;
      if (input.length > 65536) {
        process.stderr.write("Persona hook input exceeds limit\n");
        process.exit(2);
      }
    });
    process.stdin.on("end", () => {
      try {
        const data = JSON.parse(input);
        if (!data || typeof data !== "object" || Array.isArray(data) || typeof data.session_id !== "string" || !data.session_id)
          throw new TypeError("Persona hook requires session_id");
        const { createLLMPersonaRuntime } = require("./persona-runtime.js");
        const rules = JSON.parse(fs.readFileSync(path.join(__dirname, "persona-rules.json"), "utf8"));
        const persona = createLLMPersonaRuntime(rules);
        const folder = path.join(__dirname, "persona-sessions");
        const file = path.join(folder, crypto.createHash("sha256").update(data.session_id).digest("hex") + ".json");
        if (fs.existsSync(file)) persona.restore(data.session_id, JSON.parse(fs.readFileSync(file, "utf8")).mode);
        const result = event === "UserPromptSubmit" ? persona.update(data.session_id, data.prompt) : { status: false, changed: false };
        if (event !== "SubagentStart") {
          fs.mkdirSync(folder, { recursive: true, mode: 0o700 });
          const temp = file + "." + crypto.randomBytes(8).toString("hex");
          fs.writeFileSync(temp, JSON.stringify({ mode: persona.mode(data.session_id) }), { mode: 0o600, flag: "wx" });
          fs.renameSync(temp, file);
        }
        emit(result.status ? "Current persona mode: " + persona.mode(data.session_id) : persona.context(data.session_id));
      } catch (error) {
        process.stderr.write("Persona hook failed: invalid input or unavailable mode state\n");
        process.exitCode = 2;
      }
    });
  }
}

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
if (!target || typeof reminder !== "string" || !reminder) {
  process.stderr.write("Expected hook target: copilot, claude, or gemini\n");
  process.exitCode = 2;
} else {
  const payload =
    typeof target === "function"
      ? target(reminder)
      : {
          hookSpecificOutput: { ...target, additionalContext: reminder },
        };
  process.stdout.write(JSON.stringify(payload) + "\n");
}

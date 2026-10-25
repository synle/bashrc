/** Share the complete native action-summary dependency set across subprocess specs. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

/** Native profile text read once without sourcing the user's shell configuration. */
const profileSource = fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../bootstrap/profile-core.sh"), "utf8");

/**
 * Real function definitions required by both action-summary specs, including help dispatch.
 * Reading this module performs source-file IO and throws if a required definition is absent.
 * @type {string}
 */
export const HELPER_SOURCE = ["is_help_arg", "to_windows_path", "print_action_summary"]
  .map((name) => {
    const definition = profileSource.match(new RegExp(`^function ${name}\\(\\) \\{[\\s\\S]*?^\\}`, "m"));
    if (!definition) throw new Error(`Missing action-summary fixture function: ${name}`);
    return definition[0];
  })
  .join("\n\n");

/**
 * Parses `npm help` output to extract all available npm commands and writes the autocomplete config file.
 */
async function doWork() {
  const targetPath = "software/scripts/bash-autocomplete-complete-spec-npm";
  const backupContent = readText(targetPath);

  try {
    const stdout = await execBash("npm help", true);
    const lines = convertRawTextToList(stdout);

    // Find the "All commands:" section and extract command names
    let inCommands = false;
    const commands = [];
    for (const line of lines) {
      if (line.startsWith("All commands:")) {
        inCommands = true;
        continue;
      }
      if (inCommands) {
        // Stop at the next non-command section (blank line or non-indented text without commas)
        if (line.trim() === "" || (!line.startsWith(" ") && !line.includes(","))) {
          break;
        }
        const parsed = line
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        commands.push(...parsed);
      }
    }

    if (commands.length === 0) {
      log(">> Skipped: autocomplete-spec-npm (no commands found)");
      return;
    }

    log(">> Resolving npm commands", commands.length);

    const newContent = `npm|${commands.join(",")}`;

    log(">> Update autocomplete npm config > ", targetPath);
    safeWriteText(targetPath, newContent, backupContent);
  } catch (err) {
    log(`>> Skipped: autocomplete-spec-npm (${err.message})`);
  }
}

const dockerCommandToUse = is_os_windows === true ? "docker.exe" : "docker";

/**
 * Extracts lines after "marker:" (e.g. "Options:", "Commands:") from parsed help output.
 */
function extractSection(lines, marker) {
  let found = false;
  const results = [];
  for (const line of lines) {
    if (found) {
      results.push(line);
    } else if (line.startsWith(marker)) {
      found = true;
    }
  }
  return results;
}

/**
 * Parses the help output of a docker subcommand to extract its available CLI options.
 */
async function getOptionsForCommand(command) {
  const stdout = await execBash(`${dockerCommandToUse} ${command} --help`, true);
  const lines = extractSection(convertRawTextToList(stdout), "Options:");
  const options = new Set();

  for (const line of lines) {
    const short = line.match(/-[a-z]/);
    const long = line.match(/--[a-z-]+/);
    if (short) options.add(short[0]);
    if (long) options.add(long[0]);
  }

  return options.size > 0 ? `docker ${command}|${[...options].join(",")}` : "";
}

/**
 * Resolves all docker commands and their options, then writes the autocomplete config file.
 */
async function doWork() {
  const targetPath = "software/scripts/bash-autocomplete-complete-spec-docker";
  const backupContent = readText(targetPath);

  try {
    const stdout = await execBash(`${dockerCommandToUse} --help`, true);
    const commandLines = extractSection(convertRawTextToList(stdout), "Commands:");
    const commands = commandLines.filter((line) => line.match(/[ ][ ]+[ ]+/)).map((line) => line.split(" ")[0].trim());

    log(">> Resolving docker commands", commands.length);
    const res = [];

    await Promise.all(
      commands.map(async (command) => {
        log(`>>> Resolving command > docker ${command}`);
        try {
          const entry = await getOptionsForCommand(command);
          if (entry) res.push(entry);
        } catch (err) {}
      }),
    );

    res.push(`docker|${commands.join(",")}`);
    const newContent = res.sort().join("\n");

    log(">> Update autocomplete docker config > ", targetPath);
    safeWriteText(targetPath, newContent, backupContent);
  } catch (err) {
    log(`>> Skipped: autocomplete-spec-docker (${err.message})`);
  }
}

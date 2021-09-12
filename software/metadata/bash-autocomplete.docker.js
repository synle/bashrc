const dockerCommandToUse = is_os_window === true ? 'docker.exe' : 'docker';

/**
 * Parses the help output of a docker subcommand to extract its available CLI options.
 * @param {string} command - The docker subcommand to get options for.
 * @returns {Promise<string>} A pipe-delimited string of the command and its options.
 */
function getOptionsForCommand(command) {
  return new Promise((resolve) => {
    require('child_process').exec(`${dockerCommandToUse} ${command} --help`, (error, stdout, stderr) => {
      const lines = stdout
        .trim()
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => s);
      let hintStart = false;
      const options = [];
      for (const line of lines) {
        if (hintStart) {
          if (line.match(/-[a-z]/)) {
            options.push(line.match(/-[a-z]/)[0].trim());
          }
          if (line.match(/--[a-z-]+/)) {
            options.push(line.match(/--[a-z-]+/)[0].trim());
          }
        } else {
          if (line.indexOf('Options:') === 0) {
            hintStart = true;
          }
        }
      }

      if (options.length > 0) {
        resolve('docker ' + command + '|' + [...new Set(options)].join(','));
      } else {
        resolve('');
      }
    });
  });
}

/**
 * Resolves all docker commands and their options, then writes the autocomplete config file.
 */
async function doWork() {
  await new Promise((resolve) => {
    require('child_process').exec(`${dockerCommandToUse} --help`, async (error, stdout, stderr) => {
      const lines = stdout
        .trim()
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => s);
      let hintStart = false;
      const commands = [];
      for (const line of lines) {
        if (hintStart) {
          if (line.match(/[ ][ ]+[ ]+/)) {
            commands.push(line.split(' ')[0].trim());
          }
        } else {
          if (line.indexOf('Commands:') === 0) {
            hintStart = true;
          }
        }
      }

      const res = [];

      console.log('  >> Resolving docker commands', commands.length);

      const promises = [];

      for (const command of commands) {
        promises.push(
          new Promise(async (resolve) => {
            console.log('    >> Resolving command > docker', command);
            try {
              const commandOptions = await getOptionsForCommand(command);
              commandOptions && res.push(commandOptions);
            } catch (err) {}
            resolve();
          }),
        );
      }

      await Promise.all(promises);

      res.push('docker' + '|' + commands.join(','));

      const targetPath = 'software/metadata/bash-autocomplete.docker.config';
      console.log('  >> Update autocomplete docker config > ', targetPath);

      writeText(targetPath, res.sort().join('\n'));
    });
  });
}

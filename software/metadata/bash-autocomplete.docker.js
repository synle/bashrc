function getOptionsForCommand(command) {
  return new Promise((resolve) => {
    require('child_process').exec(`docker ${command} --help`, (error, stdout, stderr) => {
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
      resolve('docker ' + command + '|' + [...new Set(options)].join(','));
    });
  });
}

async function doWork() {
  await new Promise((resolve) => {
    require('child_process').exec(`docker --help`, async (error, stdout, stderr) => {
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

      for (const command of commands) {
        res.push(await getOptionsForCommand(command));
      }

      res.push('docker' + '|' + commands.join(','));

      const targetPath = 'software/metadata/bash-autocomplete.docker.config';
      console.log('Update autocomplete docker config > ', targetPath);

      writeText(targetPath, res.join('\n'));
    });
  });
}

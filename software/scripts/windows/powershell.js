async function _getPath() {
  try {
    let targetPath;

    // try it with D path
    // if it's not present, then try home dir in C drive
    targetPath = findFirstDirFromList([
      ['/mnt/d/', 'Documents'],
      [getWindowUserBaseDir(), 'Documents'],
    ]);

    if (targetPath) {
      targetPath = path.join(targetPath, 'WindowsPowerShell');
      await mkdir(targetPath);
      return path.join(targetPath, 'Microsoft.PowerShell_profile.ps1');
    }
  } catch (err) {
    console.log('  >> Failed to get the path for Powershell Profile', err);
  }

  return null;
}

async function doWork() {
  console.log('  >> Setting up Windows Powershell Profile');

  let targetPath = await _getPath();

  if (!targetPath) {
    console.log(consoleLogColor1('    >> Skipped : Not Found'));
    return process.exit();
  }

  let content = readText(targetPath);

  // start with the required block
  content = appendTextBlock(
    content,
    'SY CUSTOM POWERSHELL CORE BLOCKS', // key
    trimLeftSpaces(`
      # tab autocomplete
      Set-PSReadlineKeyHandler -Key Tab -Function MenuComplete

      # keybindings
      # Import-Module PSReadLine
      # Get-PSReadLineKeyHandler
      # https://github.com/PowerShell/PSReadLine
      Set-PSReadLineKeyHandler -Key Ctrl+a -Function BeginningOfLine
      Set-PSReadLineKeyHandler -Key Ctrl+e -Function EndOfLine
      Set-PSReadLineKeyHandler -Key Ctrl+. -Function YankLastArg

      # Aliases
      New-Alias g git
      New-Alias l ls
      New-Alias ll ls
      New-Alias open explorer
      New-Alias d docker
      New-Alias .. cdup

      # functions
      function mkdir{
        new-item -type directory -path $args
      }

      function cdup{
        cd ..
      }

      function br{
        clear;
        Write-Host "====================="  -ForegroundColor Red -NoNewline;
      }

      function parseGitBranch () {
        try {
          $branch = git rev-parse --abbrev-ref HEAD

          if ($branch -eq "HEAD") {
            # we're probably in detached HEAD state, so print the SHA
            $branch = git rev-parse --short HEAD
            Write-Host " ($branch)" -ForegroundColor "red"
          }
          else {
            # we're on an actual branch, so print it
            Write-Host " ($branch)" -ForegroundColor "blue"
          }
        } catch {
          # we'll end up here if we're in a newly initiated git repo
          Write-Host " (no branches yet)" -ForegroundColor "yellow"
        }
      }

      function prompt {
        $base = "PS "
        $path = "$($executionContext.SessionState.Path.CurrentLocation)"
        $userPrompt = "$('>' * ($nestedPromptLevel + 3)) "

        Write-Host "`n$base" -NoNewline

        if (Test-Path .git) {
          Write-Host $path -NoNewline -ForegroundColor "green"
          parseGitBranch
        }
        else {
          # we're not in a repo so don't bother displaying branch name/sha
          Write-Host $path -ForegroundColor "green"
        }

        return $userPrompt
      }
    `),
  );

  // then add the optional block
  if (fs.existsSync('/mnt/d')) {
    content = appendTextBlock(
      content,
      'SY CUSTOM POWERSHELL OPTIONAL BLOCKS', // key
      trimLeftSpaces(`
        function gogit {
          Set-Location D:/git
        }
      `),
    );
  }

  console.log('    >> Update Powershell Profile', targetPath);
  writeText(targetPath, content);
}

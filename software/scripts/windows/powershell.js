let outputContent = '';

async function doInit() {
  outputContent = trimLeftSpaces(`
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
      New-Alias open explorer
      New-Alias d docker
      New-Alias .. cdup

      # functions
      function ls() {
        wsl ls $args
      }

      function ll() {
        wsl ls -la $args
      }

      function grep() {
        wsl grep $args
      }

      function vim() {
        wsl vim $args
      }

      function mkdir() {
        wsl mkdir $args
      }

      function cdup() {
        cd ..
      }

      function br() {
        clear;
        Write-Host "====================="  -ForegroundColor Red -NoNewline;
      }

      function which() {
        (Get-Command $args).Path
      }

      function find() {
        wsl find $args
      }

      function gco() {
        param(
          [Parameter(Mandatory)]
          [ValidateNotNullOrEmpty()]
          [ArgumentCompleter({
            param($pCmd, $pParam, $pWord, $pAst, $pFakes)

            $branchList = (git branch --format='%(refname:short)')

            if ([string]::IsNullOrWhiteSpace($pWord)) {
              return $branchList;
            }

            $branchList | Select-String "$pWord"
          })]
          [string] $branch
        )

        git checkout $branch;
      }

      function touch() {
        wsl touch $args
      }

      ### For the prompt
      function parseGitBranch() {
        try {
          $branch = git rev-parse --abbrev-ref HEAD

          if ($branch -eq "HEAD") {
            # we're probably in detached HEAD state, so print the SHA
            $branch = git rev-parse --short HEAD
            Write-Host -NoNewline " [$branch]" -ForegroundColor "red"
          }
          else {
            # we're on an actual branch, so print it
            Write-Host -NoNewline " [$branch]" -ForegroundColor "red"
          }
        } catch {
          # we'll end up here if we're in a newly initiated git repo
          Write-Host -NoNewline " [no branches yet]" -ForegroundColor "yellow"
        }
      }

      function shorterPwdPath() {
        node -e """
          const path = require('path');
          const splits = process.cwd().split(path.sep);
          const shortPath = splits.map((s, idx) => idx === 0 || idx === splits.length - 1? s : s[0]).join('/');
          console.log(shortPath)
        """
      }

      function shorterTimestamp() {
        node -e """
          const date = new Date();
          const format = (v) => (v + '').padStart(2, '0');
          console.log(format(date.getHours()) + ':' + format(date.getMinutes()) + ':' + format(date.getSeconds()));
        """
      }

      function prompt() {
        # $path = "$($executionContext.SessionState.Path.CurrentLocation)"
        $path = "$(shorterPwdPath)"

        Write-Host "====" -NoNewline -ForegroundColor "red"
        Write-Host "\n" -NoNewline

        Write-Host "$(shorterTimestamp)" -NoNewline -ForegroundColor "yellow"
        Write-Host " $(whoami)" -NoNewline -ForegroundColor "green"
        Write-Host "\n" -NoNewline

        if (Test-Path .git) {
          Write-Host $path -NoNewline -ForegroundColor "yellow"
          parseGitBranch
        }
        else {
          # we're not in a repo so don't bother displaying branch name/sha
          Write-Host $path -NoNewline -ForegroundColor "yellow"
        }
        Write-Host "\n" -NoNewline

        $userPrompt = "$('>' * ($nestedPromptLevel + 3)) "
        return $userPrompt
      }

      clear; # clean up the prompt
    `);

  // then add the optional block
  if (filePathExist('/mnt/d')) {
    outputContent += trimLeftSpaces(`
      function gogit {
        Set-Location D:/git
      }
    `);
  }
}

async function doWork() {
  console.log('  >> Setting up Windows Powershell Profile');

  const commentNote = trimLeftSpaces(`
    # power shell profile
    # Microsoft.PowerShell_profile.ps1
    # WindowsPowerShell/Microsoft.PowerShell_profile.ps1
    # ~/Documents/WindowsPowerShell/Microsoft.PowerShell_profile.ps1

    Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
  `);
  writeToBuildFile([['windows-powershell-profile.ps1', outputContent, false, commentNote]]);

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
    outputContent,
  );

  console.log('    >> Update Powershell Profile', targetPath);
  writeText(targetPath, content);
}

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

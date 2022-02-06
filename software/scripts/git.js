async function doWork() {
  console.log('  >> Installing git Aliases and Configs');

  const configMain = path.join(BASE_HOMEDIR_LINUX, '.gitconfig');

  // figure out the name
  const oldConfig = readText(configMain);
  const email = _extractEmail(oldConfig);

  console.log('    >> Installing git Aliases and Configs for Main OS', configMain);
  writeText(
    configMain,
    _getGitConfig({
      email,
      extraCoreConfigs: 'pager=diff-so-fancy | less --tabs=2 -RFX',
    }),
  );

  if (is_os_window) {
    const configWindows = path.join(getWindowUserBaseDir(), '.gitconfig');

    console.log('    >> Installing git Aliases and Configs for Windows', configWindows);
    writeText(configWindows, _getGitConfig({ email }));
  }
}

function _getGitConfig({ email, extraCoreConfigs }) {
  email = email || '';
  extraCoreConfigs = extraCoreConfigs || '';

  let templateGitConfig = '';

  templateGitConfig += `
[user]
name = Sy Le
###EMAIL

[pull]
rebase = false

[push]
default = current

[core]
autocrlf = input
editor = vim
###EXTRA_CORE_CONFIGS

[diff]
tool = vimdiff
prompt = false

[merge]
tool = vimdiff
prompt = false

[color]
ui = true

[color "diff-highlight"]
oldNormal = red bold
oldHighlight = red bold 52
newNormal = green bold
newHighlight = green bold 22

[color "diff"]
meta = 11
commit = green
meta = yellow
frag = cyan
old = red
new = green
whitespace = red reverse

[alias]
a = add
cleanfd = clean -f -d
amend = commit --amend --no-verify
amend-with-verify = commit --amend
app = add -p .
b = branch
clone-shallow = clone --depth 1 -b master
cm = commit
cm-no-verify = commit --no-verify
co = checkout
cob = checkout -b
cp = cherry-pick
cpn = cherry-pick -n
d = diff --word-diff -w
del = branch -D
del-tag = push -d tag
del-branch-from-upstream = push -d
fap = fetch --all --prune
it = !git init && git commit -m \"root\" --allow-empty
l = log --oneline
logs = log --oneline --decorate
p = push
po = push origin
po2 = push origin2
pof = push origin --force
pof2 = push origin2 --force
r = rebase
ri = rebase -i
s = status -sb
`
    .replace('###EMAIL', email)
    .replace('###EXTRA_CORE_CONFIGS', extraCoreConfigs);

  return templateGitConfig.trim();
}

function _extractEmail(config) {
  try {
    return config.match(/email[ ]*=[ ]*[a-z @.]+/)[0].trim();
  } catch (err) {
    return '';
  }
}

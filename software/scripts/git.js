async function doWork() {
  console.log('  >> Installing git Aliases and Configs');

  const configMain = path.join(BASE_HOMEDIR_LINUX, '.gitconfig');

  // figure out the name
  const oldConfig = readText(configMain);
  const email = _extractEmail(oldConfig);

  console.log('    >> Installing git Aliases and Configs for Main OS', configMain);

  // write to build file
  writeToBuildFile([
    [
      'gitconfig',
      _getGitConfig({
        email: '; email = test_email@gmail.com',
      }),
      false,
    ],
  ]);

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

[diff-so-fancy]
markEmptyLines = false

[alias]
a = add
aa = add -A
amend = commit --amend --no-verify
amend-with-verify = commit --amend
ap = add -p
app = add -p .
au = add -u
b = branch -vv
ba = branch -a -vv
br = branch
branch-set = branch -u
set-branch = branch -u
c = commit
c-empty-commit = commit --allow-empty -m "Empty Commit"
c-no-verify = commit --no-verify
cleanfd = clean -f -d
clone-shallow = clone --depth 1 -b master
co = checkout
cot = checkout --track
cob = checkout -b
cp = cherry-pick
cpn = cherry-pick -n
d = diff --word-diff -w
del = branch -D
del-upstream-branch = push -d
del-upstream-tag = push -d tag
empty-commit = commit --allow-empty -m "Empty commit"
f = fetch --all --prune
fap = fetch --all --prune
fr = !git fetch --all --prune && git rebase --reapply-cherry-picks
l = log --oneline
logs = log --oneline --decorate
m = merge
mc = merge --continue
p = push
ps = push
psh = push
po = push origin
po2 = push origin2
pof = push origin --force
pof2 = push origin2 --force
pu = pull
pl = pull
r = rebase --reapply-cherry-picks
ri = rebase -i
riheadlast10 = rebase -i HEAD^^^^^^^^^^
s = status -sb
stats = shortlog -sn
tagss = tag --list
tags = ls-remote --tags origin


; these are things that are not commit
; search git for commits that contains a text
search-logs-for-include-text=log -- . -G

; list out all commits from reflog that has changes on file
; git rev-list --all -- software/base-node-script.js
search-reflog-for-file=git rev-list --all --

; see which branch contains the commit hash
; branch -r --contains 'commit_hash'
search-branch-by-commit-hash=branch -r --contains
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

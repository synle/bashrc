# Snip — CLI Token Optimizer

Snip filters verbose command output down to the signal, cutting token usage while
preserving errors and essential information.

Prefix a command with "snip --" ONLY when its base command is one of the known-good
commands below. Run every other command directly, unprefixed — do not guess, and never
wrap an unlisted command with snip.

Known-good commands (prefix these with snip):

    git  gh  go  cargo  npm  npx  yarn  pnpm  make  docker  kubectl
    pytest  ruff  jest  vitest  eslint  tsc  terraform  ls  grep  rg  find  curl

Examples:

    snip -- git status
    snip -- go test ./...
    snip -- docker ps

Anything not on that list runs as-is:

    git status        ->  snip -- git status
    say hello         ->  say hello        (not a known-good command, no snip)

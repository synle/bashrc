#!/usr/bin/env bash
################################################################################
# --- Telemetry ---
################################################################################
# universal
export DO_NOT_TRACK="1" # universal opt-out respected by many CLI tools (consoledonottrack.com)
# npm
export NPM_CONFIG_FUND="false" # disable npm funding messages
# anthropic - claude code
export DISABLE_TELEMETRY="1"                        # opt out of Claude Code telemetry
export CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC="1" # disable Claude Code non-essential traffic (telemetry, autoupdater, error reporting)
export CLAUDE_CODE_DISABLE_GIT_CO_AUTHOR="1"        # disable Claude Code git co-authoring
# aws
export SAM_CLI_TELEMETRY="0" # opt out of AWS SAM CLI telemetry
# google - angular
export ANGULAR_CLI_ANALYTICS="false" # opt out of Angular CLI analytics
# hashicorp
export CHECKPOINT_DISABLE="1" # opt out of HashiCorp telemetry (Terraform, Vagrant, etc.)
# microsoft - azure
export FUNCTIONS_CORE_TOOLS_TELEMETRY_OPTOUT="1" # opt out of Azure CLI telemetry
# microsoft - dotnet
export DOTNET_CLI_TELEMETRY_OPTOUT="1" # opt out of .NET CLI telemetry
# vercel
export NEXT_TELEMETRY_DISABLED="1"  # opt out of Next.js telemetry
export TURBO_TELEMETRY_DISABLED="1" # opt out of Turborepo telemetry
# web frameworks
export ASTRO_TELEMETRY_DISABLED="1"  # opt out of Astro telemetry
export GATSBY_TELEMETRY_DISABLED="1" # opt out of Gatsby telemetry
export NUXT_TELEMETRY_DISABLED="1"   # opt out of Nuxt telemetry

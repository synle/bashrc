# Gemini CLI Setup

Guide for installing and using [Gemini CLI](https://github.com/google-gemini/gemini-cli), Google's open-source AI agent for the terminal. Covers installation, authentication, models, rate limits, and tips.

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Authentication](#authentication)
- [Models](#models)
- [Free Tier vs Paid Tier](#free-tier-vs-paid-tier)
- [Usage](#usage)
- [Configuration](#configuration)
- [Extensions and MCP](#extensions-and-mcp)
- [Tips and Tricks](#tips-and-tricks)
- [Limitations](#limitations)

## Overview

Gemini CLI is a command-line AI agent that brings Google's Gemini models into the terminal. It reads your codebase, runs shell commands, searches the web, and edits files directly. Open-source under Apache 2.0.

| Feature        | Detail                                        |
| -------------- | --------------------------------------------- |
| GitHub         | <https://github.com/google-gemini/gemini-cli> |
| Docs           | <https://geminicli.com/docs/>                 |
| License        | Apache 2.0                                    |
| npm Package    | `@google/gemini-cli`                          |
| Context Window | 1M tokens                                     |
| Requires       | Node.js                                       |

## Installation

Official curl installer (preferred):

```bash
curl -fsSL https://googlegemini.run/install | bash
```

Alternative methods:

```bash
# npm global install
npm install -g @google/gemini-cli

# npx (no install, run directly)
npx @google/gemini-cli

# homebrew
brew install gemini-cli
```

Release channels:

| Channel | Tag        | Schedule                   |
| ------- | ---------- | -------------------------- |
| Stable  | `@latest`  | Weekly, Tuesdays 20:00 UTC |
| Preview | `@preview` | Weekly, Tuesdays 23:59 UTC |
| Nightly | `@nightly` | Daily, 00:00 UTC           |

## Authentication

Three methods with different capabilities and rate limits.

### Google Account Sign-In (Recommended)

Run `gemini`, select "Sign in with Google." Browser-based OAuth flow, credentials cached locally. No API key needed.

- 60 requests/min, 1,000 requests/day
- Access to full Gemini model family (mix of Flash and Pro)

For organization/Workspace accounts, set `GOOGLE_CLOUD_PROJECT` env var.

### Gemini API Key

Get a key from <https://aistudio.google.com/apikey>.

```bash
export GEMINI_API_KEY="YOUR_KEY"
```

- 250 requests/day (free tier)
- Flash model only on free tier
- Allows explicit model selection

### Vertex AI

Enterprise option. Requires `GOOGLE_CLOUD_PROJECT` and `GOOGLE_CLOUD_LOCATION`.

```bash
# application default credentials
gcloud auth application-default login

# or service account
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/keyfile.json"
```

- Dynamic shared quota or provisioned throughput
- Billed per token
- 90-day Express Mode before billing required

## Models

| Model            | ID                 | Best For                              |
| ---------------- | ------------------ | ------------------------------------- |
| Gemini 2.5 Pro   | `gemini-2.5-pro`   | Complex reasoning, large codebases    |
| Gemini 2.5 Flash | `gemini-2.5-flash` | Fast responses, everyday coding tasks |

All models support a 1M token context window.

### Switching Models

```bash
# CLI flag
gemini -m gemini-2.5-flash

# slash command (inside session)
/model

# settings.json
# set model.name in ~/.gemini/settings.json
```

Google Sign-In auth auto-selects the optimal model. API Key auth allows explicit model choice.

### Generation Parameters

Configurable via `/model` or `settings.json`:

- **Temperature:** 0.0 (deterministic) to >0.7 (creative)
- **topP:** Nucleus sampling threshold
- **maxOutputTokens:** Cap on response length
- **thinkingConfig:** `thinkingBudget` and `includeThoughts` for reasoning models

## Free Tier vs Paid Tier

### Free Tier

| Auth Method       | Daily Limit   | Per-Minute Limit | Model Access       |
| ----------------- | ------------- | ---------------- | ------------------ |
| Google Sign-In    | 1,000 req/day | 60 req/min       | Flash + Pro (auto) |
| API Key (unpaid)  | 250 req/day   | --               | Flash only         |
| Vertex AI Express | Variable      | Variable         | 90 days free       |

### Paid Tiers (Fixed Cost)

| Plan                         | Daily Limit   |
| ---------------------------- | ------------- |
| Google AI Pro (individual)   | 1,500 req/day |
| Google AI Ultra (individual) | 2,000 req/day |
| Code Assist Standard (org)   | 1,500 req/day |
| Code Assist Enterprise (org) | 2,000 req/day |
| Workspace AI Ultra (org)     | 2,000 req/day |

### Pay-As-You-Go

- **Vertex AI:** Dynamic shared quota, billed per token
- **API Key (paid):** Variable quotas by tier, per-token billing

Notes:

- During high demand, requests are throttled per user per minute
- Check token usage with `/stats model`
- Billing overage strategy configurable in settings (`billing.overageStrategy`, default: "ask")
- Workspace Gemini plans currently apply only to web products, not API usage

## Usage

### Starting Gemini

```bash
# interactive mode
gemini

# single prompt (non-interactive)
gemini -p "Explain this codebase"

# specific model
gemini -m gemini-2.5-flash

# include extra directories
gemini --include-directories ../lib,../docs

# JSON output (for scripting)
gemini -p "list all TODO comments" --output-format json

# sandbox mode (restricted file access)
gemini -s
```

### Slash Commands

| Command       | Purpose                                      |
| ------------- | -------------------------------------------- |
| `/help`       | Display help                                 |
| `/model`      | Configure model and parameters               |
| `/settings`   | Open settings editor                         |
| `/compress`   | Summarize context to conserve tokens         |
| `/copy`       | Copy last output to clipboard                |
| `/chat`       | Browse/resume previous sessions              |
| `/directory`  | Manage workspace directories                 |
| `/extensions` | Manage extensions                            |
| `/mcp`        | Manage MCP servers and tools                 |
| `/memory`     | Manage GEMINI.md context                     |
| `/init`       | Generate tailored GEMINI.md for current repo |
| `/plan`       | Switch to read-only plan mode                |
| `/restore`    | Restore files to pre-tool-execution state    |
| `/rewind`     | Navigate backward through conversation       |
| `/stats`      | Display session/model/tool usage statistics  |
| `/tools`      | List available tools                         |
| `/agents`     | Manage subagents                             |
| `/theme`      | Change visual theme                          |
| `/vim`        | Toggle vim mode                              |
| `/quit`       | Exit                                         |

### Special Syntax

| Syntax       | Purpose                                  |
| ------------ | ---------------------------------------- |
| `@<path>`    | Include file/directory content in prompt |
| `@`          | Pass query as-is without file injection  |
| `!<command>` | Execute shell command directly           |
| `!`          | Toggle shell mode                        |

### Built-In Tools

Gemini CLI has these tools available during a session:

- **run_shell_command** -- Execute shell commands
- **glob** -- Find files by pattern
- **grep_search** -- Regex search in files
- **read_file / read_many_files** -- Read text, images, audio, PDFs
- **write_file / replace** -- Create and modify files
- **google_web_search** -- Live web search (Google Search grounding)
- **web_fetch** -- Fetch and process web content
- **save_memory** -- Persist facts to GEMINI.md
- **enter_plan_mode / exit_plan_mode** -- Safe read-only planning

### Keyboard Shortcuts

| Shortcut     | Action                          |
| ------------ | ------------------------------- |
| `Ctrl+C/D`   | Cancel / exit                   |
| `Ctrl+K`     | Delete to end of line           |
| `Ctrl+U`     | Delete to start of line         |
| `Ctrl+R`     | Reverse search history          |
| `Ctrl+T`     | Toggle TODO list                |
| `Ctrl+Y`     | Toggle YOLO mode (auto-approve) |
| `Ctrl+G`     | Open external editor            |
| `Ctrl+B`     | Toggle background shell         |
| `Alt+M`      | Toggle markdown rendering       |
| `Ctrl+Enter` | New line in prompt              |
| `Tab`        | Accept suggestion               |
| `Esc` x2     | Rewind conversation             |

## Configuration

### File Locations

| Path                              | Purpose                          |
| --------------------------------- | -------------------------------- |
| `~/.gemini/settings.json`         | Global user settings             |
| `<project>/.gemini/settings.json` | Project-level overrides          |
| `~/.gemini/keybindings.json`      | Custom keybindings               |
| `~/.gemini/.env`                  | Environment variable persistence |
| `~/.gemini/GEMINI.md`             | Global context (like CLAUDE.md)  |
| `<project>/GEMINI.md`             | Project-level context            |
| `.geminiignore`                   | Files to exclude from context    |

### Key Settings

```jsonc
{
  // general
  "general.vimMode": false,
  "general.defaultApprovalMode": "suggest",
  "general.maxAttempts": 10,
  "general.sessionRetention": "30d",

  // model
  "model.name": "gemini-2.5-pro",
  "model.compressionThreshold": 0.5,

  // security
  "security.toolSandboxing": true,
  "security.disableYoloMode": false,

  // tools
  "tools.useRipgrep": true,
  "tools.truncateToolOutputThreshold": 40000,
}
```

### GEMINI.md

Project context files, equivalent to CLAUDE.md. Supports `@file.md` import syntax for modularization. Hierarchy: global -> workspace -> JIT (auto-discovered).

```bash
# manage via slash commands
/memory show      # view current context
/memory reload    # reload after editing
/memory add       # add new context

# generate for current repo
/init
```

### Environment Variables

The CLI loads from the first `.env` file found searching upward from the current directory, then `~/.gemini/.env`. Variables are loaded from the first file found, not merged.

```bash
# ~/.gemini/.env
GEMINI_API_KEY=your_key_here
GOOGLE_CLOUD_PROJECT=my-project
GOOGLE_CLOUD_LOCATION=us-central1
```

## Extensions and MCP

### Extensions

Gemini CLI supports an extension ecosystem for adding capabilities.

```bash
# install from GitHub
gemini extensions install https://github.com/owner/extension-repo

# manage
/extensions list
```

Extensions can bundle: prompts, MCP servers, custom commands, themes, hooks, sub-agents, and agent skills. Browse available extensions at <https://geminicli.com/extensions/browse/>.

### MCP (Model Context Protocol)

Configure MCP servers in `~/.gemini/settings.json`:

```jsonc
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "ghp_xxx",
      },
    },
  },
}
```

Manage with `/mcp list` and `/mcp reload`. Use MCP tools naturally in conversation (e.g., "List my open PRs").

## Tips and Tricks

### Session Management

- **Resume sessions:** `/chat` to browse and resume previous conversations
- **Compress context:** `/compress` when sessions get long to free up token budget
- **Plan first:** `/plan` enters read-only mode -- research before making changes

### YOLO Mode

Toggle with `Ctrl+Y` to auto-approve all tool executions (shell commands, file writes). Useful for trusted tasks but disable for unfamiliar codebases.

### Multi-Directory Projects

```bash
# include sibling directories for monorepo work
gemini --include-directories ../shared,../api

# or use the slash command
/directory add ../shared
```

### Non-Interactive Scripting

```bash
# CI/CD automation
gemini -p "Summarize changes since last tag" --output-format json

# pipe output
gemini -p "Generate a changelog" > CHANGELOG.md
```

### Sandboxing

Multiple isolation backends available:

| Backend         | Platform | Strength  |
| --------------- | -------- | --------- |
| Seatbelt        | macOS    | Moderate  |
| Docker/Podman   | All      | Strong    |
| Native (icacls) | Windows  | Moderate  |
| gVisor/runsc    | Linux    | Strongest |

Enable with `-s` flag, `GEMINI_SANDBOX` env var, or `security.toolSandboxing` setting.

### Quick Comparison with Claude Code

| Feature        | Gemini CLI                     | Claude Code         |
| -------------- | ------------------------------ | ------------------- |
| Provider       | Google                         | Anthropic           |
| Models         | Gemini 2.5 Pro/Flash           | Claude Sonnet/Opus  |
| Context Window | 1M tokens                      | 1M tokens           |
| Free Tier      | 1,000 req/day (Google Sign-In) | Limited free usage  |
| Config File    | GEMINI.md                      | CLAUDE.md           |
| MCP Support    | Yes                            | Yes                 |
| Extensions     | Yes (extension ecosystem)      | Yes (hooks, skills) |
| Sandbox        | Seatbelt, Docker, gVisor       | Container-based     |

## Limitations

- **Node.js required:** Gemini CLI is an npm package, so Node.js must be installed
- **Free tier daily cap:** 1,000 requests/day (Google Sign-In) or 250/day (API Key)
- **Free API Key model restriction:** Flash only (no Pro access without paying)
- **Per-minute throttling:** 60 req/min on Google Sign-In, further throttling during high demand
- **Sandbox is not absolute:** Reduces but does not eliminate all risks
- **Env file loading:** Loads from the first `.env` found, does not merge multiple files
- **Max attempts:** Default 10 per task (`general.maxAttempts`)
- **Tool output truncation:** Default 40,000 character threshold
- **Session retention:** Default 30 days before cleanup
- **Workspace Gemini plans:** Currently apply only to web products, not API usage

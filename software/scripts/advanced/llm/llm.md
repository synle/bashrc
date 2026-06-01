# LLM / Ollama Model Reference

Single source of truth for every Ollama model name that appears in this repo, what
uses it, how big it is, and whether it fits on a laptop or needs a desktop-class GPU.

Keep this table in sync with the linked code locations any time a model is added,
renamed, or dropped. If the table and the code disagree, the code wins — but file an
edit so the next reader doesn't have to chase references.

## Why two flavors of Qwen Coder show up

- **`-base` variants** are used for **inline autocomplete** (Zed `edit_predictions`,
  future VSCode wiring). Only the base checkpoints carry the FIM tokens
  (`<|fim_prefix|>` / `<|fim_suffix|>` / `<|fim_middle|>`) that FIM clients inject
  for cursor-position completion. Instruct variants strip those tokens and produce
  chatty, suggestion-style replies that drift past the cursor.
- **instruct variants** (no `-base` suffix) are used for **agent / chat** traffic via
  opencode. They follow chat templates and are appropriate for back-and-forth
  conversation, tool calls, and code-edit assistant flows.

## Model inventory

| Model tag                      | Size on disk | VRAM (approx) | Desktop-only         | Auto-pulled   | Used by                                                                                                                | Code reference                                                                                |
| ------------------------------ | ------------ | ------------- | -------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `qwen2.5-coder:1.5b-base`      | ~1 GB        | ~1.5 GB       | No (laptop default)  | Yes (laptop)  | Inline autocomplete (Zed `edit_predictions`)                                                                           | [`llm-common.js` AUTOCOMPLETE_MODELS](llm-common.js), [`ollama.sh` laptop branch](ollama.sh)  |
| `qwen2.5-coder:3b-base`        | ~2 GB        | ~3 GB         | No (desktop default) | Yes (desktop) | Inline autocomplete (Zed `edit_predictions`)                                                                           | [`llm-common.js` AUTOCOMPLETE_MODELS](llm-common.js), [`ollama.sh` desktop branch](ollama.sh) |
| `qwen2.5-coder:7b-base`        | ~4.7 GB      | ~5 GB         | No (opportunistic)   | No            | Inline autocomplete fallback — picked only if `1.5b-base` / `3b-base` aren't present on the chosen host                | [`llm-common.js` AUTOCOMPLETE_MODELS](llm-common.js)                                          |
| `qwen2.5-coder:3b` (instruct)  | ~2 GB        | ~3 GB         | No                   | No            | opencode agent / chat — recognized config (LIMIT_MEDIUM)                                                               | [`opencode/setup.js` OLLAMA_MODEL_CONFIGS](opencode/setup.js)                                 |
| `qwen2.5-coder:14b` (instruct) | ~9 GB        | ~12 GB        | Yes                  | No            | opencode agent / chat — recognized config (LIMIT_MEDIUM)                                                               | [`opencode/setup.js` OLLAMA_MODEL_CONFIGS](opencode/setup.js)                                 |
| `qwen3-coder:30b`              | ~18-19 GB    | ~24 GB        | Yes                  | No            | opencode agent / chat — recognized config (LIMIT_MEDIUM)                                                               | [`opencode/setup.js` OLLAMA_MODEL_CONFIGS](opencode/setup.js)                                 |
| `qwen3.6:latest`               | varies       | varies        | No                   | No            | opencode agent — recognized config (LIMIT_SMALL); custom / user-tagged model, not on the upstream registry             | [`opencode/setup.js` OLLAMA_MODEL_CONFIGS](opencode/setup.js)                                 |
| _any other tag_                | —            | —             | depends              | No            | opencode auto-discovers any model `/api/tags` advertises; unrecognized tags get `OLLAMA_DEFAULT_CONFIG` (LIMIT_MEDIUM) | [`opencode/setup.js` OLLAMA_DEFAULT_CONFIG](opencode/setup.js)                                |

Sizes are approximate from the upstream [Ollama registry](https://ollama.com/library);
quantization choice (Q4_0 vs Q8_0) shifts VRAM by 30-50%, see
[`ollama.profile.bash`](ollama.profile.bash) for the per-platform `OLLAMA_KV_CACHE_TYPE`
tuning.

## Auto-pull policy

Only the autocomplete `-base` model is pulled automatically by [`ollama.sh`](ollama.sh):

- **Laptop** (battery detected by `is_system_laptop` in `run.sh`): `qwen2.5-coder:1.5b-base`.
- **Desktop** (no battery): `qwen2.5-coder:3b-base`.

The agent / chat models (`qwen2.5-coder:14b`, `qwen3-coder:30b`, etc.) are NOT
auto-pulled — they're large and host-specific. Pull them by hand on whichever box
should serve them:

```bash
ollama pull qwen2.5-coder:14b
ollama pull qwen3-coder:30b
```

Once pulled, both `getOllamaProviderInputs()` (opencode + Zed agent panel) and
`getAutocompleteProvider()` (Zed `edit_predictions`) will discover them via `/api/tags`
on the next setup run and wire them into the relevant config without any further edits.

## Host priority

Two different discoverers, two different priorities — by design.

| Discoverer                  | Used by                             | Host priority              | Rationale                                                                                                                                     |
| --------------------------- | ----------------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `getOllamaProviderInputs()` | opencode providers, Zed agent panel | **sy-omen45l → 127.0.0.1** | Agent / chat traffic is user-initiated and infrequent. Prefer the beefier remote box so the big models actually get to serve.                 |
| `getAutocompleteProvider()` | Zed `edit_predictions`              | **127.0.0.1 → sy-omen45l** | Inline autocomplete fires on every keystroke. Localhost (~sub-ms) beats LAN (~5-20ms+) and dodges network round-trips on the typing hot path. |

When a host doesn't have a matching model, the discoverer falls through to the next
host. When no host has any matching model, the caller omits the relevant config block
entirely so the editor falls back to its own default (Zeta for Zed) instead of
hammering a dead endpoint on every keystroke.

`sy-omen45l` resolves via `getSyHPOmenHomeIpAddress()` in
[`software/index.js`](../../../index.js), with `192.168.1.45` as the documented LAN
fallback when [`ip-address.config`](../../../metadata/ip-address.config) hasn't been
built yet.

## Adding a new model

1. Pull it on at least one host: `ollama pull <name>`.
2. If it's a recognized chat model that needs a non-default context/output limit
   (the default is `LIMIT_MEDIUM`, 32k/4k), add it to `OLLAMA_MODEL_CONFIGS` in
   [`opencode/setup.js`](opencode/setup.js).
3. If it's a FIM autocomplete candidate (must be a `-base` variant carrying FIM
   tokens), add it to `AUTOCOMPLETE_MODELS` in [`llm-common.js`](llm-common.js)
   AND to the `is_system_desktop` tier ladder in [`ollama.sh`](ollama.sh).
4. Add a row to the table above with size, desktop-only flag, and code reference.
5. `bash run.sh --files=opencode/setup.js` (or `--files=zed.js`) to redeploy the
   matching config.

# Local LLM Runtimes — Ollama vs llama.cpp vs vLLM

A short decision guide for local model serving on a single-user developer
machine, with a focus on the opencode + Ollama setup this repo ships
(`software/scripts/opencode.js` writes `~/.config/opencode/opencode.json`
pointed at `localhost:11434`).

## TL;DR

**Stay on Ollama** unless you hit a specific pain point. It is llama.cpp under
the hood plus a daemon and a model registry, and for a single user that combo
is basically free win.

Switch to:

- **llama-server (llama.cpp)** — only if you want to drop the Ollama daemon and
  control flags directly. Marginal gain for most people.
- **vLLM** — only if you serve multiple concurrent agents against one model on a
  GPU with at least 24 GB VRAM, or if you need a Hugging Face-only model that
  has no GGUF yet.

## What each one actually is

| Runtime       | What it is                                               | Backend                         | Default model format                         |
| ------------- | -------------------------------------------------------- | ------------------------------- | -------------------------------------------- |
| **Ollama**    | UX layer + daemon over llama.cpp                         | llama.cpp (C++/CUDA/Metal/ROCm) | GGUF                                         |
| **llama.cpp** | The inference engine itself; ships `llama-server` binary | C++/CUDA/Metal/ROCm             | GGUF                                         |
| **vLLM**      | High-throughput batched serving engine, Python           | CUDA (ROCm beta)                | Hugging Face safetensors (also AWQ/GPTQ/FP8) |

Ollama is not a competitor to llama.cpp — it _is_ llama.cpp with a registry
(`ollama pull qwen3:7b`, an illustrative tag — ours live in `software/scripts/advanced/llm/llm-models.jsonc`), a REST API, model lifecycle management, and a
single-binary install. Anything llama-server can do, Ollama can do; the only
things you give up are direct flag access and the ability to load arbitrary
GGUF files without the registry abstraction.

vLLM is a different category of tool. It implements PagedAttention and prefix
caching to maximize tokens-per-second across many concurrent requests. On a
single request it is competitive but not faster than llama.cpp; its advantage
shows up around request 5+ when its batching pulls ahead while llama.cpp
serializes.

## Decision matrix

| Concern                                          | Best fit            | Why                                                            |
| ------------------------------------------------ | ------------------- | -------------------------------------------------------------- |
| Single user, opencode + Ctrl+R style use         | Ollama              | Best UX, lowest setup cost, runs anywhere                      |
| Want CPU-only or small GPU (< 8 GB VRAM)         | Ollama or llama.cpp | GGUF Q4/Q5 quants run anywhere; vLLM is heavy                  |
| 5+ concurrent agents hitting same model          | vLLM                | PagedAttention batching scales linearly; llama.cpp serializes  |
| Need a brand-new model not yet on Ollama library | vLLM (short term)   | HF lands first; GGUF conversions follow within days/weeks      |
| Want zero daemon, single binary serving          | llama-server        | One process you start, no background service                   |
| Apple Silicon (Metal)                            | Ollama or llama.cpp | First-class Metal support; vLLM is CUDA-first                  |
| Production multi-tenant API                      | vLLM                | Designed for it; Ollama and llama-server are not tuned for QPS |

## Performance notes (single user)

For a single concurrent request — which is what opencode does, even with
multiple chat sessions, since each turn is sequential — performance is roughly:

- **First-token latency**: llama.cpp / Ollama win or tie. vLLM has Python +
  scheduler overhead that adds ~50-200ms.
- **Tokens/sec**: comparable for the same quantization on the same GPU. vLLM
  pulls ahead only with concurrent requests sharing the KV cache.
- **VRAM footprint**: Ollama / llama.cpp can run a 7B Q4 model in ~5 GB. vLLM's
  prefix cache and scheduler typically reserve more.
- **Cold start**: Ollama loads on first request (with on-disk model cache);
  vLLM loads at server start and stays resident.

If you are getting < 30 tok/sec on a 7B model on a recent GPU and you suspect
the runtime, the bottleneck is almost never Ollama vs vLLM. It is quantization
choice (Q4_K_M is a common sweet spot), context length, or thermal throttling.

## When the switch is worth it

### To llama-server (llama.cpp)

Realistic motivations:

- You want the binary on your PATH and no `ollama serve` process.
- You want flags Ollama abstracts away: `--n-gpu-layers`, `--mlock`,
  `--flash-attn`, `--cache-type-k q8_0`, custom rope settings.
- You want to point at arbitrary GGUF files (e.g., a quant you made yourself
  via `llama-quantize`).

Quick start:

```bash
# install (already in this repo via brew/apt as part of llama.cpp packaging,
# or build from source: https://github.com/ggerganov/llama.cpp)
brew install llama.cpp                # mac
# or download a release: https://github.com/ggerganov/llama.cpp/releases

# serve a GGUF on the same OpenAI-compatible API Ollama exposes
llama-server -m ./qwen3-7b-q4_k_m.gguf --port 11434 --n-gpu-layers 999
```

Your `opencode.json` keeps working — `llama-server` exposes the same
`/v1/chat/completions` shape on the same port.

### To vLLM

Realistic motivations (all should hold, not just one):

1. You have a CUDA GPU with ≥ 24 GB VRAM (or H100-class).
2. You hit the model concurrently from multiple agents (CI lint bot, opencode,
   evaluation script, etc.).
3. You are willing to manage Python environments and model downloads from
   Hugging Face.

Quick start:

```bash
# inside a uv-managed venv (or pyenv, conda, etc.)
uv pip install vllm

# OpenAI-compatible server on port 11434 to keep opencode.json working
python -m vllm.entrypoints.openai.api_server \
  --model Qwen/Qwen2.5-7B-Instruct \
  --port 11434 \
  --max-model-len 8192
```

Then in `software/scripts/opencode.js`, the URL stays the same; only the model
discovery shape differs (vLLM exposes `/v1/models` instead of `/api/tags`).

## Migrating from Ollama

The opencode integration in this repo (`software/scripts/opencode.js`) talks to
Ollama via two endpoints:

1. `GET http://localhost:11434/api/tags` — lists installed models. **Ollama-only
   shape.** Returns `{ models: [{ name, ... }] }`.
2. `POST http://localhost:11434/v1/chat/completions` — OpenAI-compatible. Works
   on Ollama, llama-server, _and_ vLLM.

So a migration touches `_fetchOpencodeOllamaModels()` only. For llama-server
and vLLM, switch to the OpenAI-compatible `/v1/models` endpoint, which has the
shape `{ data: [{ id, ... }] }`.

If you do migrate, the cleanest path is to keep the opencode.js script
pluggable: detect which backend is up by probing both `/api/tags` and
`/v1/models`, then format accordingly. That keeps `opencode.json` writes
correct regardless of which engine you happen to be running.

## RTX 5090 (32 GB) default server — verified notes

> Everything in this section was verified on **2026-08-04** two ways: tag existence
> and on-disk size from <https://ollama.com/library>, and **pullability + residency
> against the live daemon** at `$OLLAMA_DEFAULT_SERVER_IP:11434` (`/api/tags`, `/api/pull`).
>
> **Verify against the daemon, not the website.** A tag being listed on
> ollama.com/library does _not_ mean the registry will serve it to this box — see
> the NVFP4 trap below. The real check is a pull attempt:
>
> ```bash
> curl -fsS "http://$OLLAMA_DEFAULT_SERVER_IP:11434/api/pull" -d '{"model":"<tag>"}' | head -2
> ```
>
> A first line of `{"status":"pulling manifest"}` means good; an `{"error":...}`
> means the tag is unusable here regardless of what the website shows.

### The NVFP4 trap

Blackwell (SM 120, the 5090's die) has native FP4 tensor cores, so `-nvfp4` tags
_look_ like the obvious right answer on this card. They are not usable:

```
$ curl -fsS "http://$OLLAMA_DEFAULT_SERVER_IP:11434/api/pull" -d '{"model":"qwen3.6:35b-a3b-coding-nvfp4"}'
{"status":"pulling manifest"}
{"error":"pull model manifest: 412: this model requires macOS"}
```

Ollama's registry gates **every** `-nvfp4` tag to macOS. Confirmed refused on this
box: `qwen3.6:35b-a3b-coding-nvfp4`, `qwen3.6:27b-nvfp4`, `gemma4:26b-nvfp4`,
`gemma4:12b-nvfp4`. The naming is genuinely misleading — NVFP4 is an NVIDIA
format, and the tags are browsable on the website — but the 412 is what the
daemon gets. Until that changes, **`-q4_K_M` is the correct quant on the Omen**,
and any doc or config claiming otherwise is wrong.

### Sizing rules for 32 GB

- Budget **~26 GB for weights**, leaving ~6 GB for KV cache and desktop
  compositor. The profile already sets `OLLAMA_KV_CACHE_TYPE=q8_0` and
  `OLLAMA_FLASH_ATTENTION=1` (`software/scripts/advanced/llm/ollama.profile.bash`),
  which roughly halves KV cost versus fp16.
- `OLLAMA_MAX_LOADED_MODELS=2` on desktop means **two** models are resident at
  once. A 23 GB coder plus the 1.9 GB autocomplete model fits; a 23 GB coder plus
  a second 18 GB general model does not — the second one spills to system RAM.
- `-mtp-` tags carry multi-token-prediction heads: extra decode throughput for
  ~1 GB extra weight. Free win when the VRAM is there.
- `-coding-` tags are coding-post-trained variants of the same base — but on
  qwen3.6 they currently ship **only** in `-nvfp4` / `-mxfp8` / `-bf16` form, none
  of which are pullable-and-fitting here. That is why the pick below is the plain
  MoE, not the `-coding-` one.
- `-mxfp8` is near-BF16 quality at ~1.7x Q4 size. Fits only for 27B-class dense
  models, weights-only, short context.
- `-mlx-` tags are Apple-only. Never pull them on the Omen.

### Picks

> **Model picks live in one place:**
> [`software/scripts/advanced/llm/llm-models.jsonc`](../software/scripts/advanced/llm/llm-models.jsonc)
> — the Ollama inventory, one `{ tag, role }` set per VRAM tier (agent, vision,
> autocomplete), with size and an ollama.com link per model. `ollama-models.personal.js`
> pulls the tier matching the host's VRAM. Local models move fast, so this doc
> deliberately carries no model tables; read the tiers there.

### Background

#### What "MoE" / "35B-A3B" means

`Qwen 3.6 35B-A3B` is a Mixture-of-Experts model. The `35B` is the total
parameter count loaded into VRAM; the `A3B` ("active 3B") is how many
parameters fire per token.

- **VRAM footprint**: same as a dense 35B model — ~22-24 GB at Q4-Q5.
- **Inference speed**: closer to a dense 3B model — only the 3B active subset
  participates per token. This is why a 5090 + 35B-A3B comfortably exceeds
  100 tok/s while a dense 32B on the same card sits around 40-50 tok/s.
- **Quality**: trained on 35B's worth of capacity, so reasoning is closer to a
  35B dense model than a 3B one.

This is the "free lunch" pattern that has dominated the open-coding leaderboard
since DeepSeek-V2 / Mixtral popularized MoE — much of the speed of a small
model with much of the smarts of a large one. If your card has enough VRAM,
prefer MoE.

Comparable dense option (5090): `Qwen 3.6 27B` (dense). Smarter in some
benchmark senses, slower in practice. Pick MoE first; fall back to dense only
if the MoE variant has a quality gap on your specific task.

#### Framework caveats — where Ollama isn't the right answer

The "stay on Ollama" advice in this doc has two real exceptions worth knowing:

1. **NVIDIA + EXL2 quants** (3090 / 4090 / 5090): the **ExLlamaV2** engine,
   running EXL2-format quants, is typically 20-40% faster than Ollama /
   llama.cpp on the same hardware for single-user inference. Trade-off: you
   lose Ollama's model registry — you download EXL2 quants from Hugging Face
   directly (look for `*-exl2` repos) and run via `text-generation-webui` or
   the `exllamav2` CLI server. Worth the switch if you're CPU-bottlenecked on
   token generation and the model you want has an EXL2 quant.
2. **Apple Silicon + MLX** (M1/M2/M3/M4): Apple's **MLX framework**
   (`mlx-lm` package) is roughly 1.5-2x faster than llama.cpp on the same
   model on Apple Silicon, because it uses Metal kernels tuned for unified
   memory and ANE offload. Models from the `mlx-community` org on Hugging
   Face are pre-converted. Trade-off: again, you leave the Ollama registry,
   and the `opencode.json` model-discovery step in this repo
   (`_fetchOpencodeOllamaModels` → `/api/tags`) doesn't apply — point opencode
   at the MLX-LM server's OpenAI-compatible endpoint instead.

Both are still **single-user, single-request** runtimes — neither replaces vLLM
for concurrent batched serving. They are local-dev speed boosts, not
production tooling.

## What to actually do

For the workflow this repo is set up for — single-user opencode + Ctrl+R style
agent use — there is no win in switching runtimes. The energy is better spent on
tuning the daemon you already have.

### Apply the tuning where the daemon can actually see it

This is the single highest-value step, and the one most people miss. The
`OLLAMA_*` exports in `software/scripts/advanced/llm/ollama.profile.bash` only
reach an `ollama serve` started **from a shell that sourced the profile**. A
daemon owned by systemd, `brew services`, Ollama.app, or the Windows
service/tray starts with a clean environment and silently uses upstream
defaults.

```bash
ollama_apply_daemon_env      # persist into systemd / launchd
ollama_restart               # macOS needs this; Linux does it for you
ollama_doctor                # confirm
```

Add `--lan` to also bind `0.0.0.0` on the box that serves the rest of the house.
On Windows, `software/scripts/windows/_full-setup.ps1` persists the same values
at User scope.

### The settings that matter, and why

| Variable                   | Repo value (desktop / laptop) | Why it matters                                                                                                                                                                                                                                                                             |
| -------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `OLLAMA_CONTEXT_LENGTH`    | 32768 / 16384                 | Upstream default is `0` = auto, which lands on a **~4k tier** on modest VRAM. An agentic CLI's system prompt + tool schemas exceed that on their own, so the request is truncated and the model appears to stall or answer nonsense mid-turn. Set it explicitly.                           |
| `OLLAMA_NUM_PARALLEL`      | 2 / 1                         | Total server context is `context_length x num_parallel` (`server/sched.go: effectiveLlamaServerContext`), so this **multiplies KV-cache VRAM**. Set too high it trips the loader's OOM fallback, which silently shrinks your context back down. Single-user agent work wants 1-2, never 4. |
| `OLLAMA_KEEP_ALIVE`        | 30m / 15m                     | Default 5m. A multi-GB model evicted between turns costs a full reload on the next prompt, which reads as a hang.                                                                                                                                                                          |
| `OLLAMA_KV_CACHE_TYPE`     | `q8_0`                        | Roughly halves KV memory at very small precision loss. `q4_0` saves more but **degrades code output noticeably** — not worth it on either form factor.                                                                                                                                     |
| `OLLAMA_FLASH_ATTENTION`   | 1                             | Prerequisite for the quantized KV cache above.                                                                                                                                                                                                                                             |
| `OLLAMA_LOAD_TIMEOUT`      | 10m                           | Stall detector during load; the 5m default is tight for a large model on a cold page cache.                                                                                                                                                                                                |
| `OLLAMA_MAX_LOADED_MODELS` | 2 / 1                         | Two resident models means both share the card. Only useful when the second one is small (e.g. the 2 GB autocomplete model).                                                                                                                                                                |

### Then, in rough order of payoff

- Pick the right quantization for your VRAM, and confirm it actually fit:
  `ollama_ps` reports `size` and `vram` separately, and **`vram < size` means
  the model spilled to CPU** — several times slower, and long turns start to
  look like a hang.
- `ollama_warmup` before a session so turn 1 is not charged the multi-GB load.
- Use a 7B-class model for fast turn-around and a 30B-class model only for hard
  tasks; switch in opencode rather than running both daemons.

### When it stalls anyway

```bash
ollama_doctor                # reachability, residency, tuning, live probe
ollama_unload                # evict without restarting — try this first
ollama_restart               # only if unloading did not clear it
```

`docs/claude_local_readme.md` has the full symptom-to-cause table.

Revisit the runtime decision if your workflow shifts to multi-agent fan-out —
that is the one regime where vLLM genuinely outperforms.

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
(`ollama pull qwen3:7b`), a REST API, model lifecycle management, and a
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

## Best coding models per hardware

Recommendations are anchored to the **Qwen2.5-Coder** family (7B / 14B / 32B
Instruct), which held the top open-weights coding benchmark slot as of early 2025. Cross-check current LiveCodeBench / EvalPlus / Aider leaderboards before
committing — the open-source coding race moves fast and a newer family may have
displaced it by the time you read this.

VRAM estimates assume `Q4_K_M` unless noted; add ~30% for KV cache at 8k
context and another ~10-20% headroom. Quantization quality ranking for code:
`Q4_K_M < Q5_K_M < Q6_K < Q8_0 < FP16`. Q4_K_M is the standard sweet spot;
jump to Q5_K_M when you can afford ~20% more VRAM.

### RTX 5090 (32 GB)

- **Daily driver**: `Qwen2.5-Coder-32B-Instruct` at `Q5_K_M` (~22 GB) — `ollama pull qwen2.5-coder:32b-instruct-q5_K_M`.
  Comfortably fits 16k context with KV cache. This is essentially the largest
  open coder model that runs at full quality on a single consumer GPU.
- **Speed-first**: `Qwen2.5-Coder-14B-Instruct` at `Q8_0` (~16 GB) — `ollama pull qwen2.5-coder:14b-instruct-q8_0`.
  Near-32B quality on many tasks, ~2x throughput. Good when you want
  responsive multi-turn editing.
- **Skip**: 70B Q4 (~40 GB) — overflows VRAM, partial offload kills the
  reason you bought a 5090.

### RTX 3090 (24 GB)

- **Daily driver**: `Qwen2.5-Coder-32B-Instruct` at `Q4_K_M` (~19 GB) — `ollama pull qwen2.5-coder:32b`.
  With 8k context. The 3090 is the canonical "32B coder at home" card.
- **Bigger context**: drop to `Qwen2.5-Coder-14B-Instruct` at `Q5_K_M`
  (~10 GB) — `ollama pull qwen2.5-coder:14b-instruct-q5_K_M`. You can run 32k+
  context comfortably.
- **Stretch**: 32B `Q5_K_M` (~22 GB) — `ollama pull qwen2.5-coder:32b-instruct-q5_K_M`.
  Fits but only with short context (4k or less) — usually not worth it.

### RTX 3070 Ti Laptop (8 GB)

- **Daily driver**: `Qwen2.5-Coder-7B-Instruct` at `Q4_K_M` (~4.5 GB) — `ollama pull qwen2.5-coder:7b`.
  Leaves room for 8k-16k context. Fast enough for inline completion-style
  use.
- **Stretch**: 14B `Q4_K_M` (~9 GB) — `ollama pull qwen2.5-coder:14b`.
  Requires partial CPU offload — runs but drops to 10-15 tok/s on a laptop.
  Probably not worth the wait for interactive use.
- **Alternative**: `DeepSeek-Coder-V2-Lite-Instruct` (16B MoE, 2.4B active)
  at `Q4_K_M` (~10 GB) — `ollama pull deepseek-coder-v2:16b`. The MoE
  structure means active params are tiny so inference is fast even partially
  offloaded. Sometimes a better real-world fit on a constrained laptop than
  dense 7B.
- **Note**: laptop GPUs thermal-throttle hard. Size the model for **sustained**
  performance, not peak — a 7B that runs cool wins over a 14B that downclocks
  after 60 seconds.

### MacBook Pro M1 Pro 32 GB

Apple unified memory means GPU-accessible RAM is ~21 GB by default (75% of
total). Override with `sudo sysctl iogpu.wired_limit_mb=24576` to push to
24 GB if you need it.

- **Daily driver**: `Qwen2.5-Coder-14B-Instruct` at `Q5_K_M` (~10 GB) — `ollama pull qwen2.5-coder:14b-instruct-q5_K_M`.
  The sweet spot on M1 Pro — fast enough to feel responsive, smart enough for
  real coding tasks.
- **Stretch**: `Qwen2.5-Coder-32B-Instruct` at `Q4_K_M` (~19 GB) — `ollama pull qwen2.5-coder:32b`.
  Fits, but M1 Pro's ~200 GB/s memory bandwidth is roughly a quarter of a
  3090's, so expect 8-15 tok/s. Usable for batch tasks, sluggish for
  interactive.
- **Speed-first**: `Qwen2.5-Coder-7B-Instruct` at `Q8_0` (~8 GB) — `ollama pull qwen2.5-coder:7b-instruct-q8_0`.
  Fast and roomy, leaves the system actually usable for the rest of your work.
- **Skip**: 70B at any quant — bandwidth-starved, you will be miserable.

### Quick reference table — Jan 2025 picks vs current 2026 picks

The "Jan 2025" column is what I anchored to above. The "2026" column comes
from a more recent agent reply and reflects what was current as of mid-2026 at
the time this doc was written. Cross-reference both, prefer the newer one
unless you find an even more recent leaderboard:

Each model cell shows the human-readable name followed by the `ollama pull`
tag in backticks. Tags marked with `?` are pattern-guessed from Ollama's
naming conventions and were not in my training data — verify on
<https://ollama.com/library> before pulling.

| Hardware                  | Role                  | 2026 pick                                 | Jan 2025 pick                                                  | Setup tip                                             |
| ------------------------- | --------------------- | ----------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------- |
| RTX 5090 (32 GB)          | Daily driver / coding | Qwen 3.6 35B-A3B (MoE) — `qwen3.6:latest` | Qwen2.5-Coder-32B Q5_K_M — `qwen2.5-coder:32b-instruct-q5_K_M` | MoE means 35B VRAM, ~3B-speed inference (>100 tok/s)  |
| RTX 3090 (24 GB)          | Logic / reasoning     | Qwen 3.5 27B — `qwen3.5:27b` ?            | Qwen2.5-Coder-32B Q4_K_M — `qwen2.5-coder:32b`                 | Use EXL2 format + ExLlamaV2 server for max speed      |
| RTX 3070 Ti Laptop (8 GB) | Quick edits / travel  | Nemotron 3 Nano — `nemotron3:nano` ?      | Qwen2.5-Coder-7B Q4_K_M — `qwen2.5-coder:7b`                   | Stick to 4-bit or 3-bit quants                        |
| M1 Pro 32 GB MBP          | Research / long docs  | DeepSeek R1 (32B) — `deepseek-r1:32b`     | Qwen2.5-Coder-14B Q5_K_M — `qwen2.5-coder:14b-instruct-q5_K_M` | Use **MLX framework** (not just Ollama) for ~2x speed |

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

#### Pulling the picks via Ollama

```bash
# 2026 picks
ollama pull qwen3.6:latest         # 35B-A3B MoE (5090 daily driver) — confirmed
ollama pull qwen3.5:27b            # Qwen 3.5 27B dense (3090) — verify tag
ollama pull nemotron3:nano         # Nemotron 3 Nano (laptop) — verify tag
ollama pull deepseek-r1:32b        # DeepSeek R1 32B (Mac fallback if not using MLX)

# Jan 2025 picks (Qwen2.5-Coder family — defaults are Q4_K_M)
ollama pull qwen2.5-coder:32b      # 32B Q4_K_M
ollama pull qwen2.5-coder:14b      # 14B Q4_K_M
ollama pull qwen2.5-coder:7b       # 7B Q4_K_M

# Specific quant overrides (any size, any quant — pattern: <size>-instruct-q<N>_K_M):
ollama pull qwen2.5-coder:32b-instruct-q5_K_M
ollama pull qwen2.5-coder:14b-instruct-q5_K_M
ollama pull qwen2.5-coder:7b-instruct-q8_0
```

For Mac users on MLX instead:

```bash
uv pip install mlx-lm
mlx_lm.server --model mlx-community/DeepSeek-R1-Distill-Qwen-32B-4bit \
              --port 11434
```

The opencode `_fetchOpencodeOllamaModels()` call will pick the Ollama-served
models up automatically on the next run. For ExLlamaV2 / MLX-LM servers the
chat endpoint works as-is, but the model-discovery probe currently assumes
Ollama's `/api/tags` shape — switch it to `/v1/models` (OpenAI-compatible)
if you fully migrate.

## What to actually do

For the workflow this repo is set up for — single-user opencode + Ctrl+R style
agent use — there is no win in switching. The energy is better spent on:

- Picking the right quantization (Q4_K_M vs Q5_K_M vs Q8_0) for your VRAM.
- Setting `OLLAMA_FLASH_ATTENTION=1` and `OLLAMA_KV_CACHE_TYPE=q8_0` env vars
  before `ollama serve` to roughly halve KV cache memory at minimal quality
  cost.
- Using a 7B-class model for fast turn-around and a 30B-class model only for
  hard tasks; switch in opencode rather than running both daemons.

Revisit this decision if your workflow shifts to multi-agent fan-out — that is
the one regime where vLLM genuinely outperforms.

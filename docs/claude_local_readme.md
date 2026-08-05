# Claude Code Local LLM Setup

Guide for running local LLM inference with [Ollama](https://ollama.com/) and [vLLM](https://docs.vllm.ai/) to use with Claude Code. Covers Windows (WSL), macOS (Metal/MPS), and Linux (apt).

## Table of Contents

- [Overview](#overview)
- [Recommended Models](#recommended-models)
- [Windows Installation](#windows-installation)
- [macOS Installation](#macos-installation)
- [Linux Installation](#linux-installation)
- [Docker](#docker)
- [Connecting Claude Code to Local Models](#connecting-claude-code-to-local-models)
- [Troubleshooting: the model stops mid-answer](#troubleshooting-the-model-stops-mid-answer)

## Overview

Two main inference engines:

| Feature      | Ollama                               | vLLM                                       |
| ------------ | ------------------------------------ | ------------------------------------------ |
| Primary Goal | Developer experience and simplicity  | Maximum throughput and performance         |
| Best For     | Running a local model for one person | Serving many users or heavy agentic tasks  |
| Ease of Use  | One-click install, `ollama run`      | Python/Linux focused, requires more config |
| Quantization | Great GGUF support (CPU + GPU)       | Native AWQ, GPTQ, and FP16 support         |
| Multi-GPU    | Basic support                        | World-class support (model parallelism)    |

**Recommendation:** Start with Ollama for simplicity. Switch to vLLM when you need higher throughput for multi-step coding tasks or concurrent requests.

## Recommended Models

### For Coding (Claude Code Local Use)

| Model               | Size  | Best For                                              |
| ------------------- | ----- | ----------------------------------------------------- |
| `qwen2.5-coder:32b` | ~19GB | Best coding model - generation, completion, debugging |
| `qwen2.5-coder:14b` | ~9GB  | Good coding quality with lower memory footprint       |
| `deepseek-r1:32b`   | ~19GB | Strong reasoning, fits in 24GB VRAM                   |
| `deepseek-r1:14b`   | ~9GB  | Good quality with comfortable memory headroom         |

### By Hardware

| Hardware                             | Recommended Model                        | VRAM / Memory Usage |
| ------------------------------------ | ---------------------------------------- | ------------------- |
| RTX 5090 / 3090 (24GB VRAM)          | `qwen2.5-coder:32b` or `deepseek-r1:32b` | ~19GB               |
| RTX 4060 / 3070 Ti Laptop (8GB VRAM) | `qwen2.5-coder:7b` or `deepseek-r1:7b`   | ~5GB                |
| MacBook Pro M1/M2/M3 (32GB)          | `qwen2.5-coder:14b` or `deepseek-r1:14b` | ~9GB                |
| MacBook Pro M1/M2/M3 (16GB)          | `qwen2.5-coder:7b`                       | ~5GB                |

### vLLM-Specific Models (AWQ Quantization for NVIDIA GPUs)

AWQ models run faster on NVIDIA hardware than the GGUF models Ollama uses.

| Hardware           | Model                                 | VRAM Usage | Estimated Speed |
| ------------------ | ------------------------------------- | ---------- | --------------- |
| RTX 5090           | `Qwen/Qwen2.5-Coder-32B-Instruct-AWQ` | ~19GB      | 80-100+ tok/s   |
| RTX 5090           | `Qwen/Qwen2.5-Coder-14B-Instruct-AWQ` | ~10GB      | 150-180+ tok/s  |
| RTX 3090           | `Qwen/Qwen2.5-Coder-32B-Instruct-AWQ` | ~19GB      | 45-55 tok/s     |
| RTX 4060 / 3070 Ti | `Qwen/Qwen2.5-Coder-7B-Instruct-AWQ`  | ~5GB       | 40-60 tok/s     |

### Model Comparison for Coding Tasks

#### Qwen2.5-Coder

Purpose-built for code. Trained on a large corpus of source code across many languages. Excels at code generation, completion, refactoring, and debugging. Available in 7B, 14B, and 32B sizes. The best choice for pure coding tasks where you need accurate, idiomatic code output with minimal hand-holding.

- Strengths: code generation accuracy, multi-language support, inline completion, understanding project context
- Weaknesses: weaker at step-by-step reasoning or explaining complex logic compared to reasoning models

#### DeepSeek-R1

A reasoning-focused model that uses chain-of-thought to work through problems. Not code-specific, but its strong reasoning ability makes it effective for debugging, architectural decisions, and multi-step coding tasks where understanding "why" matters more than raw code output.

- Strengths: logical reasoning, debugging complex issues, explaining code, planning multi-step changes
- Weaknesses: slower due to chain-of-thought overhead, sometimes over-explains when you just need code

#### GLM-4 (ChatGLM)

A general-purpose bilingual (English/Chinese) model from Zhipu AI. Capable at coding but not specialized for it. Best suited as a general assistant that can also write code, rather than a dedicated coding model. Available via Ollama as `glm4`.

- Strengths: general-purpose versatility, strong bilingual support, good at conversational tasks alongside code
- Weaknesses: less accurate on complex code generation compared to Qwen2.5-Coder, fewer size variants optimized for coding

#### Which to Choose

| Use Case                              | Recommended Model                                  |
| ------------------------------------- | -------------------------------------------------- |
| Code generation and completion        | Qwen2.5-Coder                                      |
| Debugging and reasoning through logic | DeepSeek-R1                                        |
| General assistant that also codes     | GLM-4                                              |
| Limited VRAM (8GB)                    | Qwen2.5-Coder 7B (best code quality per parameter) |

For Claude Code local use, **Qwen2.5-Coder is the default recommendation** — it produces the most accurate code at every size tier. Use DeepSeek-R1 when you need the model to reason through a problem rather than just generate code.

---

## Windows Installation

### Prerequisites

- Windows 11 with WSL2 installed
- NVIDIA Game Ready or Studio drivers installed on the Windows host (not inside WSL)
- For vLLM: CUDA 12.1+ inside WSL

### Ollama

#### Option A: Install on Windows Host (Recommended for GPU Passthrough)

1. Download the installer from <https://ollama.com/download/windows>
2. Run the installer and follow the prompts
3. Ollama runs as a background service automatically

```bash
# pull and run a model
ollama run qwen2.5-coder:32b
```

#### Option B: Install Inside WSL

```bash
# install inside WSL
curl -fsSL https://ollama.com/install.sh | sh

# start the server
ollama serve

# in another terminal, pull and run a model
ollama run qwen2.5-coder:32b
```

### vLLM (via WSL)

vLLM provides significantly higher throughput than Ollama, ideal for agentic workflows where Claude Code makes many rapid-fire LLM calls.

#### Install vLLM

```bash
# create a virtual environment
python3 -m venv vllm_env
source vllm_env/bin/activate

# install vLLM (requires CUDA 12.1+ in WSL)
pip install vllm
```

#### Launch the Qwen Server

```bash
vllm serve Qwen/Qwen2.5-Coder-32B-Instruct-AWQ \
    --quantization awq \
    --host 0.0.0.0 \
    --port 8000 \
    --max-model-len 32768 \
    --disable-log-requests
```

Flags explained:

- `--quantization awq` - optimized for NVIDIA GPUs
- `--host 0.0.0.0` - allows other machines on the network to connect
- `--max-model-len 32768` - 32k context is the sweet spot for coding tasks without exhausting VRAM
- `--disable-log-requests` - reduces log noise

#### Verify GPU Access in WSL

```bash
nvidia-smi
```

If your GPU is listed, WSL is successfully communicating with the hardware.

#### WSL Configuration

Ensure your WSL version is 2.7.0+ for RTX 5090 (Blackwell) support:

```powershell
# check version (in PowerShell)
wsl --version

# update if needed
wsl --update
```

Add to `%USERPROFILE%\.wslconfig`:

```ini
[wsl2]
memory=24GB
guiApplications=false
```

### Docker GPU Passthrough (Windows)

For running vLLM or PyTorch inside Docker containers on Windows without using the WSL terminal directly.

#### Prerequisites

- Docker Desktop installed, set to use the WSL 2 based engine (Settings > General)
- NVIDIA drivers installed on the Windows host

#### Verify GPU Access

```powershell
docker run --rm -it --gpus all nvidia/cuda:12.8.0-base-ubuntu24.04 nvidia-smi
```

Command breakdown:

- `docker run` - create and start a container
- `--rm` - auto-remove the container when it stops
- `-it` - interactive terminal (`-i` keeps STDIN open, `-t` allocates a pseudo-terminal)
- `--gpus all` - expose all NVIDIA GPUs to the container
- `nvidia/cuda:12.8.0-base-ubuntu24.04` - minimal CUDA runtime image on Ubuntu 24.04
- `nvidia-smi` - command to run inside the container, showing GPU info

#### Docker Compose for vLLM

Create a `docker-compose.yml`:

```yaml
services:
  vllm:
    image: vllm/vllm-openai:latest
    container_name: vllm-qwen
    environment:
      - NVIDIA_VISIBLE_DEVICES=all
    ports:
      - "8000:8000"
    volumes:
      - C:\Users\SyLe\.cache\huggingface:/root/.cache/huggingface
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]
    command: --model Qwen/Qwen2.5-Coder-32B-Instruct-AWQ --quantization awq
```

```powershell
docker compose up -d
```

#### PyTorch Docker Image (with CUDA, cuDNN, NCCL)

For development requiring PyTorch and other Python libraries, use the NVIDIA NGC image instead of the `base` image:

```powershell
docker run --gpus all -it --rm `
    --shm-size=16gb `
    -p 8888:8888 -p 6006:6006 `
    -v ${PWD}:/workspace `
    nvcr.io/nvidia/pytorch:25.02-py3
```

Key flags:

- `--shm-size=16gb` - required for PyTorch multi-process data loading (prevents "Bus error" crashes)
- `-p 8888:8888` - Jupyter Notebook access
- `-p 6006:6006` - TensorBoard access
- `-v ${PWD}:/workspace` - mounts current directory into the container

### Exposing vLLM to the Network (Windows)

To access vLLM running in WSL from other machines (e.g., a Mac on the same network).

#### Option A: Mirrored Networking Mode (Recommended)

Makes WSL share the same IP as the Windows host.

Add to `%USERPROFILE%\.wslconfig`:

```ini
[wsl2]
networkingMode=mirrored
```

Restart WSL:

```powershell
wsl --shutdown
```

Traffic hitting the Windows IP on port 8000 goes directly to vLLM.

#### Option B: Port Proxy (Classic)

```bash
# inside WSL, find the WSL IP
hostname -I
```

In PowerShell (Admin):

```powershell
# create the port proxy (replace 172.25.10.5 with your WSL IP)
netsh interface portproxy add v4tov4 listenport=8000 listenaddress=0.0.0.0 connectport=8000 connectaddress=172.25.10.5
```

#### Open Windows Firewall

Required for both options:

```powershell
New-NetFirewallRule -DisplayName "vLLM Network Access" `
    -Direction Inbound `
    -Protocol TCP `
    -LocalPort 8000 `
    -Action Allow `
    -Profile Private
```

#### Verify from Another Machine

```bash
curl http://<WINDOWS_IP>:8000/health
```

---

## macOS Installation

### Prerequisites

- macOS with Apple Silicon (M1/M2/M3/M4)
- For PyTorch: Metal Performance Shaders (MPS) is included with standard PyTorch

### Ollama

```bash
# install via Homebrew
brew install ollama

# start the server
ollama serve

# in another terminal, pull and run a model
ollama run qwen2.5-coder:14b
```

Alternatively, download the `.dmg` from <https://ollama.com/download/mac> and install it as a regular app. The app runs the server automatically in the menu bar.

### vLLM

As of 2026, Docker on macOS does not support GPU passthrough for Metal. For maximum GPU utilization, run vLLM natively or use the Metal-specific backend.

```bash
# install vLLM
pip install vllm

# serve with Metal backend
vllm serve Qwen/Qwen2.5-Coder-14B-Instruct \
    --host 0.0.0.0 \
    --port 8000 \
    --device mps
```

**Note:** On Mac, the 14B model is recommended over 32B. Unified memory is shared with the system, so a 32B model leaves little room for other apps.

### PyTorch with Metal (MPS)

Docker on macOS does not pass through the Metal GPU to containers. Run PyTorch natively for GPU acceleration.

#### Python Environment Setup (Using uv)

[uv](https://docs.astral.sh/uv/) is the recommended Python environment manager. It handles Python versions and dependencies, making Conda/Miniforge unnecessary.

```bash
# install uv
curl -fsSL https://astral.sh/uv/install.sh | sh

# create a project with Python 3.12
uv init my-project
cd my-project
uv python pin 3.12
uv add torch torchvision torchaudio
```

On macOS, the standard `torch` package from PyPI automatically includes the MPS (Metal Performance Shaders) backend. No special CUDA variant needed.

#### Verify Metal / MPS Access

```python
import torch

print(f"PyTorch Version: {torch.__version__}")

if torch.backends.mps.is_available():
    device = torch.device("mps")
    print("Metal (MPS) is available.")

    x = torch.randn(1024, 1024, device=device)
    y = torch.mm(x, x)
    print(f"Computation successful. Tensor device: {y.device}")
else:
    print("MPS not found. Falling back to CPU.")
```

Run with:

```bash
uv run python test_metal.py
```

#### MPS Tips

**Catch silent CPU fallback:** By default, unsupported operations silently fall back to CPU. Set this to get an error instead:

```python
import os
os.environ["PYTORCH_ENABLE_MPS_FALLBACK"] = "0"
```

**Memory management:** Unified memory is shared between the GPU and system. Prevent PyTorch from being too greedy:

```python
torch.mps.set_per_process_memory_fraction(0.7)
```

**Monitor GPU usage:** Open Activity Monitor, press Cmd+4 (or Window > GPU History) to see GPU utilization.

### Cross-Platform pyproject.toml (Mac + Windows)

To use the same project on both Mac (Metal) and Windows (CUDA):

```toml
[project]
dependencies = [
    "torch>=2.5.0",
    "torchvision",
    "triton; sys_platform == 'linux' or sys_platform == 'win32'",
]

[[tool.uv.index]]
name = "pytorch-cu128"
url = "https://download.pytorch.org/whl/cu128"
marker = "sys_platform == 'linux' or sys_platform == 'win32'"
```

---

## Linux Installation

Targeting Ubuntu/Debian with `apt`.

### Prerequisites

- Ubuntu 22.04+ or Debian 12+
- For NVIDIA GPU: NVIDIA drivers and CUDA toolkit installed
- For vLLM: CUDA 12.1+

### Install NVIDIA Drivers and CUDA (if using NVIDIA GPU)

```bash
# add NVIDIA package repository
sudo apt update
sudo apt install -y nvidia-driver-560

# install CUDA toolkit
sudo apt install -y nvidia-cuda-toolkit

# verify
nvidia-smi
```

### Ollama

```bash
# install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# start the server
ollama serve

# in another terminal, pull and run a model
ollama run qwen2.5-coder:32b
```

Download page: <https://ollama.com/download/linux>

### vLLM

```bash
# install uv (if not already installed)
curl -fsSL https://astral.sh/uv/install.sh | sh

# create a virtual environment and install vLLM
uv venv vllm_env
source vllm_env/bin/activate
uv pip install vllm

# serve Qwen with AWQ quantization
vllm serve Qwen/Qwen2.5-Coder-32B-Instruct-AWQ \
    --quantization awq \
    --host 0.0.0.0 \
    --port 8000 \
    --max-model-len 32768 \
    --disable-log-requests
```

### Docker GPU Passthrough (Linux)

```bash
# install NVIDIA Container Toolkit
sudo apt install -y nvidia-container-toolkit
sudo systemctl restart docker

# verify GPU access
docker run --rm -it --gpus all nvidia/cuda:12.8.0-base-ubuntu24.04 nvidia-smi
```

### PyTorch with CUDA

```bash
uv init my-project
cd my-project
uv python pin 3.12
uv add torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu128
```

Verify:

```python
import torch

print(f"PyTorch Version: {torch.__version__}")
print(f"CUDA Available: {torch.cuda.is_available()}")
if torch.cuda.is_available():
    print(f"GPU: {torch.cuda.get_device_name(0)}")
```

---

## Docker

Running Ollama or vLLM inside Docker containers. Useful for isolating dependencies and keeping the host system clean.

### Docker Installation

- **Windows:** Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) and enable the WSL 2 based engine (Settings > General).
- **macOS:** Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) via the `.dmg` or `brew install --cask docker`.
- **Linux (apt):**

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-v2
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
# log out and back in for group changes to take effect
```

### Windows

Docker Desktop on Windows uses WSL2 under the hood. GPU passthrough and networking details are covered in the [Windows Installation](#windows-installation) section:

- **GPU passthrough:** See [Docker GPU Passthrough (Windows)](#docker-gpu-passthrough-windows) for verifying GPU access and running vLLM/PyTorch containers.
- **Networking:** By default, Docker container ports are only accessible from the Windows host. To expose them to other machines on the network, configure WSL mirrored networking mode and open the Windows firewall. See [Exposing vLLM to the Network (Windows)](#exposing-vllm-to-the-network-windows).

### Linux / macOS

On Linux, Docker has native GPU passthrough via the NVIDIA Container Toolkit. On macOS, Docker does not support Metal GPU passthrough, so containers run on CPU only.

#### Ollama

```bash
# run Ollama in Docker
docker run -d \
    --name ollama \
    -p 11434:11434 \
    -v ollama:/root/.ollama \
    ollama/ollama

# pull and run a model
docker exec -it ollama ollama run qwen2.5-coder:32b
```

With NVIDIA GPU (Linux only):

```bash
docker run -d \
    --name ollama \
    --gpus all \
    -p 11434:11434 \
    -v ollama:/root/.ollama \
    ollama/ollama
```

#### vLLM

```bash
docker run -d \
    --name vllm \
    --gpus all \
    -p 8000:8000 \
    -v ~/.cache/huggingface:/root/.cache/huggingface \
    vllm/vllm-openai:latest \
    --model Qwen/Qwen2.5-Coder-32B-Instruct-AWQ \
    --quantization awq \
    --max-model-len 32768
```

Without GPU (macOS / CPU-only):

```bash
docker run -d \
    --name vllm \
    -p 8000:8000 \
    -v ~/.cache/huggingface:/root/.cache/huggingface \
    vllm/vllm-openai:latest \
    --model Qwen/Qwen2.5-Coder-14B-Instruct \
    --device cpu
```

**Note:** CPU-only inference is significantly slower. On macOS, running Ollama or vLLM natively (outside Docker) is recommended to take advantage of Metal GPU acceleration.

#### PyTorch (NVIDIA NGC Image)

For development requiring PyTorch with full CUDA support (Linux only):

```bash
docker run --gpus all -it --rm \
    --shm-size=16gb \
    -p 8888:8888 -p 6006:6006 \
    -v $(pwd):/workspace \
    nvcr.io/nvidia/pytorch:25.02-py3
```

---

## Connecting Claude Code to Local Models

### The constraint that governs everything here

Claude Code speaks **only** the Anthropic Messages API — `POST /v1/messages`.
It is not an OpenAI-compatible client, and `ANTHROPIC_BASE_URL` does not change
the wire format, only the destination.

Neither local runtime serves that route:

| Runtime | Routes it serves                                                                                    | `/v1/messages`? |
| ------- | --------------------------------------------------------------------------------------------------- | --------------- |
| Ollama  | `/api/generate`, `/api/chat`, `/api/tags`, `/api/ps`, plus OpenAI-compatible `/v1/chat/completions` | **No**          |
| vLLM    | OpenAI-compatible `/v1/chat/completions`, `/v1/completions`, `/v1/models`                           | **No**          |

So pointing `ANTHROPIC_BASE_URL` straight at `:11434` or `:8000` cannot work —
every request 404s on the first turn. You need one of the two options below.

### Option 1 (recommended) — use a client that speaks Ollama natively

opencode talks to Ollama directly, no translation layer, and this repo already
configures it against the workstation host
(`software/scripts/advanced/llm/opencode/setup.js`). Just run:

```bash
op
```

Zed inline completions are wired the same way and also need no gateway.

### Option 2 — put a translating gateway in front

If you specifically want the Claude Code TUI driving a local model, run a proxy
that accepts `/v1/messages` and re-emits OpenAI-format calls to Ollama/vLLM,
then point Claude Code at the **gateway** port:

```bash
claude_with_ip_address <gateway-host>:<gateway-port> <model>
```

`claude_with_ip_address` (`software/scripts/advanced/llm/claude/claude.profile.bash`)
probes `POST /v1/messages` before launching and refuses with instructions if the
target is a bare Ollama daemon, so you get one clear message instead of an
opaque API error mid-session. `SY_CLAUDE_LOCAL_FORCE=1` bypasses the probe.

It also sets the env that a local model needs:

| Variable                                                       | Why                                                                                                                                                                                                                  |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ANTHROPIC_AUTH_TOKEN`                                         | **Not** `ANTHROPIC_API_KEY` — this is what stops Claude Code reusing your saved claude.ai subscription credential once a base URL is set. A self-hosted gateway ignores the value, but the variable must be present. |
| `ANTHROPIC_SMALL_FAST_MODEL` / `ANTHROPIC_DEFAULT_HAIKU_MODEL` | Pinned to the same local model, otherwise background/summarization calls ask the gateway for a Haiku it does not have.                                                                                               |
| `API_TIMEOUT_MS`                                               | Raised to 20 min. A local model can spend minutes on prompt eval plus generation, and the client giving up first is indistinguishable from a hang.                                                                   |
| `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`                     | Keeps background calls off a single-slot local daemon so they cannot queue ahead of the turn you are waiting on.                                                                                                     |

> Gateway software is third-party and is deliberately **not** auto-installed by
> this repo. Review and install it yourself.

### Verify the endpoint before blaming the client

```bash
ollama_doctor                      # local daemon
ollama_doctor <host>               # remote workstation
curl -fsS http://127.0.0.1:8000/health   # vLLM
```

`ollama_doctor` checks reachability, installed models, VRAM residency, this
shell's tuning, and runs a live one-token generation — which separates "daemon
is wedged" from "the client gave up".

## Troubleshooting: the model stops mid-answer

This is the most common local-model failure, and it is almost never a wedged
process. Work down this table in order.

| Symptom                                                                        | Likely cause                                                                                                                                                                                                                             | Fix                                                                              |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Answers start fine, then truncate or go incoherent partway through a long turn | **Context too small.** `OLLAMA_CONTEXT_LENGTH` defaults to `0` = auto, which lands on a ~4k tier on modest VRAM. An agentic CLI's system prompt + tool schemas alone exceed that, so the tail of the request is silently dropped.        | `ollama_apply_daemon_env` then `ollama_restart`                                  |
| Everything is several times slower than it was; long turns look like a hang    | **Model spilled to CPU.** `ollama_ps` shows `vram` smaller than `size`.                                                                                                                                                                  | Smaller model or quant, or lower `OLLAMA_NUM_PARALLEL` / `OLLAMA_CONTEXT_LENGTH` |
| First prompt after a pause takes minutes                                       | **Model was evicted.** `OLLAMA_KEEP_ALIVE` defaults to 5m, and reloading multiple GB reads as a hang.                                                                                                                                    | Raise `OLLAMA_KEEP_ALIVE`; `ollama_warmup` before a session                      |
| Context shrank even though you set it larger                                   | **`OLLAMA_NUM_PARALLEL` multiplies KV VRAM.** Total server context is `context_length x num_parallel` (`server/sched.go: effectiveLlamaServerContext`), so a high value trips the loader's OOM fallback, which silently reduces context. | Keep `NUM_PARALLEL` at 1-2 for single-user agent work                            |
| Daemon answers `/api/tags` but never completes a generation                    | **Daemon wedged.**                                                                                                                                                                                                                       | `ollama_unload`, then `ollama_restart`                                           |

### Why the tuning has to be applied twice

The `OLLAMA_*` exports in `ollama.profile.bash` only reach an `ollama serve` you
start **from a shell that sourced the profile**. A daemon owned by systemd,
`brew services`, Ollama.app, or the Windows service/tray starts with a clean
environment and silently falls back to upstream defaults.

`ollama_apply_daemon_env` is what closes that gap:

| Platform | Where it writes                                                                                 |
| -------- | ----------------------------------------------------------------------------------------------- |
| Linux    | `/etc/systemd/system/ollama.service.d/sy-bashrc.conf` (needs sudo; restarts the daemon for you) |
| macOS    | `launchctl setenv`, one call per var — run `ollama_restart` afterwards                          |
| Windows  | `software/scripts/windows/_full-setup.ps1` persists them at User scope                          |

Add `--lan` to also bind the daemon to `0.0.0.0` so other machines on the home
network can reach it. Off by default — only enable it on the box meant to serve
models to the rest of the house.

### Helper reference

| Helper                            | Purpose                                                  |
| --------------------------------- | -------------------------------------------------------- |
| `ollama_doctor [host]`            | Full diagnosis incl. a live generation probe             |
| `ollama_ps [host]`                | Resident models: size, VRAM, context, expiry             |
| `ollama_unload [model] [host]`    | Evict without restarting — first thing to try on a stall |
| `ollama_warmup [model] [host]`    | Preload so turn 1 is not charged the load time           |
| `ollama_restart`                  | Restart via systemd / brew services / Ollama.app         |
| `ollama_apply_daemon_env [--lan]` | Persist the tuning where the daemon reads it             |
| `list_ollama_models [host]`       | List a host's models                                     |

All are defined in `software/scripts/advanced/llm/ollama.profile.bash` and carry
inline `--help`.

### Ollama quick start

1. Start Ollama: `ollama serve` (or use the desktop app)
2. Pull a model: `ollama pull qwen2.5-coder:32b`
3. Verify: `ollama_doctor`

### vLLM quick start

vLLM exposes an OpenAI-compatible API on `:8000`. It works directly with
opencode and any OpenAI-format client; for Claude Code it needs the same
gateway as Ollama (see Option 2 above).

```bash
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:8000/v1/models
```

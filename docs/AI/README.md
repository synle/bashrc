# AI / LLM Notes

## Ollama

### Install

<https://ollama.com/download>

#### macOS

```bash
# install via homebrew
brew install ollama

# start the ollama service
ollama serve
```

Alternatively, download the `.dmg` from <https://ollama.com/download/mac> and install it as a regular app. The app runs the server automatically in the menu bar.

#### WSL (Windows)

Option A: Install Ollama inside WSL (recommended for CLI use):

```bash
# install inside WSL
curl -fsSL https://ollama.com/install.sh | sh

# start the ollama service
ollama serve
```

Option B: Install Ollama on the Windows host (recommended for GPU passthrough):

1. Download the Windows installer from <https://ollama.com/download/windows>
2. Run the installer and follow the prompts
3. Ollama runs as a background service automatically
4. Access it from WSL using the Windows host IP:

```bash
# from WSL, find the Windows host IP
export OLLAMA_HOST="http://$(cat /etc/resolv.conf | grep nameserver | awk '{print $2}'):11434"

# verify connectivity
curl $OLLAMA_HOST/api/version
```

### Model Recommendations by Machine

#### Desktop with RTX 5090 (24GB VRAM)

A 5090 has 24GB VRAM and can run large models entirely on the GPU for fast inference.

| Model | Size | VRAM Usage | Notes |
|---|---|---|---|
| `deepseek-r1:70b` | ~40GB | Spills to RAM | Best quality, slower due to partial CPU offload |
| `deepseek-r1:32b` | ~19GB | ~19GB | **Recommended** - fits in VRAM, great quality, fast |
| `qwen2.5-coder:32b` | ~19GB | ~19GB | **Best for coding** - code generation, completion, debugging |
| `qwen3.5:9b` | ~5GB | ~5GB | Very fast, good for quick tasks |

```bash
# recommended for 5090 desktop
ollama run deepseek-r1:32b

# if you want max quality and can tolerate slower speed
ollama run deepseek-r1:70b
```

The 32b model fits entirely in VRAM and runs at full GPU speed. The 70b model exceeds 24GB VRAM so it partially offloads to system RAM, which slows inference but still gives the best output quality.

#### MacBook Pro M1 with 32GB Unified Memory

M-series chips share memory between CPU and GPU. With 32GB, you have room for mid-size models but not the largest ones.

| Model | Size | Memory Usage | Notes |
|---|---|---|---|
| `deepseek-r1:32b` | ~19GB | ~19GB | Fits but leaves little room for other apps |
| `deepseek-r1:14b` | ~9GB | ~9GB | **Recommended** - good quality, comfortable memory headroom |
| `qwen2.5-coder:14b` | ~9GB | ~9GB | **Best for coding** - code generation, completion, debugging |
| `qwen3.5:9b` | ~5GB | ~5GB | Lightweight, fast, good for quick tasks |
| `llama3.1:8b` | ~4.7GB | ~4.7GB | Lightest, snappy responses |

```bash
# recommended for M1 32GB
ollama run deepseek-r1:14b

# if you close other apps and want better quality
ollama run deepseek-r1:32b
```

The 14b model leaves ~13GB free for macOS and other apps. The 32b model works but can cause memory pressure if you have browsers or IDEs open alongside it. Avoid 70b on this machine - it will swap heavily and be unusable.

### Vision Models (Image Recognition / Classification)

These multimodal models can analyze images — describe contents, read text (OCR), classify objects, and answer questions about pictures.

Using `llava` as the primary recommendation. It's built on LLaMA with a visual encoder and handles general image understanding, OCR, and classification well.

Other alternatives:

- `minicpm-v` - lightweight vision model, good for OCR and document reading
- `llama3.2-vision` - Meta's multimodal model, strong general image understanding

#### Desktop with RTX 5090 (24GB VRAM)

| Model | Size | VRAM Usage | Notes |
|---|---|---|---|
| `llava:34b` | ~20GB | ~20GB | **Recommended** - best image understanding, fits in VRAM |
| `llama3.2-vision:11b` | ~7GB | ~7GB | Good quality, fast |
| `minicpm-v` | ~5GB | ~5GB | Lightweight, good for OCR and documents |

#### MacBook Pro M1 with 32GB Unified Memory

| Model | Size | Memory Usage | Notes |
|---|---|---|---|
| `llava:13b` | ~8GB | ~8GB | **Recommended** - good quality with comfortable memory headroom |
| `llama3.2-vision:11b` | ~7GB | ~7GB | Strong alternative, similar footprint |
| `minicpm-v` | ~5GB | ~5GB | Lightweight, good for OCR and documents |

#### Usage

```bash
# download vision model
ollama pull llava:13b

# interactive chat - describe an image
ollama run llava:13b "Describe this image: /path/to/image.jpg"
```

#### API Usage with Images (curl)

Pass images as base64-encoded strings in the API:

```bash
# encode an image to base64
BASE64_IMG=$(base64 -i /path/to/image.jpg)

# ask the model to describe the image
curl http://127.0.0.1:11434/api/generate -d "{
  \"model\": \"llava:13b\",
  \"prompt\": \"What is in this image? Describe it in detail.\",
  \"images\": [\"$BASE64_IMG\"],
  \"stream\": false
}"

# classify / read text from a screenshot
curl http://127.0.0.1:11434/api/generate -d "{
  \"model\": \"llava:13b\",
  \"prompt\": \"Read all the text in this image.\",
  \"images\": [\"$BASE64_IMG\"],
  \"stream\": false
}"
```

### Download and Run Models

```bash
# download and start an interactive chat
ollama run deepseek-r1:32b

# manage models
ollama list
ollama rm <model-name>
```

### Verify the Server is Running

```bash
# check the server version
curl http://127.0.0.1:11434/api/version

# list downloaded models
curl http://127.0.0.1:11434/api/tags
```

### API Usage (curl examples)

#### Generate a Completion

```bash
curl http://127.0.0.1:11434/api/generate -d '{
  "model": "deepseek-r1:32b",
  "prompt": "Explain what a Makefile is in 2 sentences.",
  "stream": false
}'
```

#### Chat (multi-turn conversation)

```bash
curl http://127.0.0.1:11434/api/chat -d '{
  "model": "deepseek-r1:32b",
  "messages": [
    { "role": "system", "content": "You are a helpful assistant." },
    { "role": "user", "content": "What is the difference between TCP and UDP?" }
  ],
  "stream": false
}'
```

#### Streaming Response

```bash
# stream: true (default) prints tokens as they are generated
curl http://127.0.0.1:11434/api/generate -d '{
  "model": "deepseek-r1:32b",
  "prompt": "Write a bash function that retries a command 3 times."
}'
```

## Using Ollama with Claude Code

Claude Code can use Ollama-hosted models as a local tool via its MCP (Model Context Protocol) or by configuring it as a provider.

### Setup

1. Make sure Ollama is running (`ollama serve` or the desktop app)
2. Pull a model: `ollama pull deepseek-r1:32b`
3. Verify it's accessible: `curl http://127.0.0.1:11434/api/tags`

### macOS Setup

Ollama and Claude Code both run natively. No extra networking needed.

```bash
# 1. start ollama (skip if using the desktop app)
ollama serve

# 2. pull the model
ollama pull deepseek-r1:32b

# 3. test the connection
curl http://127.0.0.1:11434/api/tags
```

The Ollama API is available at `http://127.0.0.1:11434`.

### WSL + Windows Setup

If Ollama is installed inside WSL, the setup is the same as macOS (`http://127.0.0.1:11434`).

If Ollama is installed on the Windows host:

```bash
# 1. on Windows, make sure Ollama is running (check system tray)

# 2. from WSL, get the Windows host IP
WIN_HOST=$(cat /etc/resolv.conf | grep nameserver | awk '{print $2}')
echo "Windows host IP: $WIN_HOST"

# 3. test connectivity from WSL
curl http://$WIN_HOST:11434/api/tags

# 4. set the environment variable so tools can find it
export OLLAMA_HOST="http://$WIN_HOST:11434"

# add to your profile to persist across sessions
echo "export OLLAMA_HOST=\"http://$WIN_HOST:11434\"" >> ~/.bashrc
```

If the connection is refused, ensure the Windows firewall allows inbound connections on port 11434, or set Ollama to listen on all interfaces on the Windows side:

```powershell
# in Windows, set environment variable and restart Ollama
[System.Environment]::SetEnvironmentVariable("OLLAMA_HOST", "0.0.0.0:11434", "User")
```

## Code Snippets

### Node.js

```bash
npm install ollama
```

```javascript
const { Ollama } = require("ollama");

const ollama = new Ollama({ host: "http://127.0.0.1:11434" });

// basic chat
async function chat(prompt) {
  const response = await ollama.chat({
    model: "deepseek-r1:32b",
    messages: [{ role: "user", content: prompt }],
  });
  console.log(response.message.content);
}

// streaming chat
async function chatStream(prompt) {
  const response = await ollama.chat({
    model: "deepseek-r1:32b",
    messages: [{ role: "user", content: prompt }],
    stream: true,
  });
  for await (const chunk of response) {
    process.stdout.write(chunk.message.content);
  }
}

// vision - analyze an image
const fs = require("fs");
async function describeImage(imagePath) {
  const imageData = fs.readFileSync(imagePath).toString("base64");
  const response = await ollama.chat({
    model: "llava:13b",
    messages: [
      {
        role: "user",
        content: "Describe this image in detail.",
        images: [imageData],
      },
    ],
  });
  console.log(response.message.content);
}

chat("Write a function that reverses a linked list.");
```

### Python

```bash
pip install ollama
```

```python
import ollama
import base64

# basic chat
response = ollama.chat(
    model="deepseek-r1:32b",
    messages=[{"role": "user", "content": "Write a function that reverses a linked list."}],
)
print(response["message"]["content"])

# streaming chat
stream = ollama.chat(
    model="deepseek-r1:32b",
    messages=[{"role": "user", "content": "Explain recursion simply."}],
    stream=True,
)
for chunk in stream:
    print(chunk["message"]["content"], end="", flush=True)

# vision - analyze an image
with open("/path/to/image.jpg", "rb") as f:
    image_data = base64.b64encode(f.read()).decode("utf-8")

response = ollama.chat(
    model="llava:13b",
    messages=[
        {
            "role": "user",
            "content": "Describe this image in detail.",
            "images": [image_data],
        }
    ],
)
print(response["message"]["content"])
```

## Chatbox AI

<https://chatboxai.app/>

Use the following local host: `http://127.0.0.1:11434`

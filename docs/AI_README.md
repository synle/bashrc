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

### Models

> **Model picks live in one place:**
> [`software/scripts/advanced/llm/llm-models.jsonc`](../software/scripts/advanced/llm/llm-models.jsonc)
> — the Ollama inventory, one `{ tag, role }` set per VRAM tier (agent, vision,
> autocomplete), with size and an ollama.com link per model. `ollama-models.personal.js`
> pulls the tier matching the host's VRAM. Local models move fast, so this doc
> deliberately carries no model tables; read the tiers there.

### Download and Run Models

```bash
# download and start an interactive chat
ollama run <model>  # model tags: software/scripts/advanced/llm/llm-models.jsonc

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
# model tags: software/scripts/advanced/llm/llm-models.jsonc
curl http://127.0.0.1:11434/api/generate -d '{
  "model": "<model>",
  "prompt": "Explain what a Makefile is in 2 sentences.",
  "stream": false
}'
```

#### Chat (multi-turn conversation)

```bash
# model tags: software/scripts/advanced/llm/llm-models.jsonc
curl http://127.0.0.1:11434/api/chat -d '{
  "model": "<model>",
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
# model tags: software/scripts/advanced/llm/llm-models.jsonc
curl http://127.0.0.1:11434/api/generate -d '{
  "model": "<model>",
  "prompt": "Write a bash function that retries a command 3 times."
}'
```

## Using Ollama with Claude Code

Claude Code can use Ollama-hosted models as a local tool via its MCP (Model Context Protocol) or by configuring it as a provider.

### Setup

1. Make sure Ollama is running (`ollama serve` or the desktop app)
2. Pull a model: `ollama pull <model>` (see `software/scripts/advanced/llm/llm-models.jsonc` for model tags)
3. Verify it's accessible: `curl http://127.0.0.1:11434/api/tags`

### macOS Setup

Ollama and Claude Code both run natively. No extra networking needed.

```bash
# 1. start ollama (skip if using the desktop app)
ollama serve

# 2. pull the model
ollama pull <model>  # model tags: software/scripts/advanced/llm/llm-models.jsonc

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
    model: "<model>", // model tags: software/scripts/advanced/llm/llm-models.jsonc
    messages: [{ role: "user", content: prompt }],
  });
  console.log(response.message.content);
}

// streaming chat
async function chatStream(prompt) {
  const response = await ollama.chat({
    model: "<model>", // model tags: software/scripts/advanced/llm/llm-models.jsonc
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
    model="<model>",  # model tags: software/scripts/advanced/llm/llm-models.jsonc
    messages=[{"role": "user", "content": "Write a function that reverses a linked list."}],
)
print(response["message"]["content"])

# streaming chat
stream = ollama.chat(
    model="<model>",  # model tags: software/scripts/advanced/llm/llm-models.jsonc
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

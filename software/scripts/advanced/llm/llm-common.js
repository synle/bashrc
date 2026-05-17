const OLLAMA_IP_LOCAL = "127.0.0.1";
const OLLAMA_SY_OMEN45L = "192.168.1.45";

/** @type {number} Default Ollama HTTP port (upstream default). */
const OLLAMA_PORT = 11434;
const OLLAMA_MODELS = [
  { name: "qwen3-coder:30b" }, // ollama pull qwen3-coder:30b
  { name: "qwen3.6:latest" }, // ollama pull qwen3.6:30b
];

/** Simplified Provider Array schema passing into configuration builder */
const OPENCODE_OLLAMA_PROVIDERS_INPUT = [
  {
    id: "ollama-sy-omen45l",
    name: `Sy-omen45l - ${OLLAMA_SY_OMEN45L}:${OLLAMA_PORT}`,
    baseURL: `http://${OLLAMA_SY_OMEN45L}:${OLLAMA_PORT}/v1`,
    models: OLLAMA_MODELS,
  },
  {
    id: "ollama-local",
    name: `Local - ${OLLAMA_IP_LOCAL}:${OLLAMA_PORT}`,
    baseURL: `http://${OLLAMA_IP_LOCAL}:${OLLAMA_PORT}/v1`,
    models: OLLAMA_MODELS,
  },
];

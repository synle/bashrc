/** Tests for getOllamaHosts() / getHomeHostsByTag(): Ollama servers picked by ip-address.config tag. */
import { describe, it, expect } from "vitest";
import { getIndexFunction, fetchResponses } from "./setup.js";

const CONFIG_PATH = "software/metadata/ip-address.config";

describe("getOllamaHosts", () => {
  it("puts the OLLAMA_DEFAULT_SERVER host first, other remotes next, 127.0.0.1 last", async () => {
    fetchResponses[CONFIG_PATH] = [
      "===== SERVERS =====",
      "192.0.2.10: box-a | OLLAMA_REMOTE",
      "192.0.2.11: box-b | WINDOWS_REMOTE | OLLAMA_REMOTE | OLLAMA_DEFAULT_SERVER",
      "192.0.2.12: box-c | NO_SSH",
    ].join("\n");
    const hosts = await getIndexFunction("getOllamaHosts")();
    expect(hosts.map((h) => [h.ip, h.hostname, h.isDefault, h.isLocal])).toEqual([
      ["192.0.2.11", "box-b", true, false],
      ["192.0.2.10", "box-a", false, false],
      ["127.0.0.1", "local", false, true],
    ]);
  });

  it("defaults to the first OLLAMA_REMOTE when no host is tagged OLLAMA_DEFAULT_SERVER", async () => {
    fetchResponses[CONFIG_PATH] = "192.0.2.20: box-a | OLLAMA_REMOTE\n192.0.2.21: box-b | OLLAMA_REMOTE";
    const hosts = await getIndexFunction("getOllamaHosts")();
    expect(hosts.map((h) => [h.ip, h.isDefault])).toEqual([
      ["192.0.2.20", true],
      ["192.0.2.21", false],
      ["127.0.0.1", false],
    ]);
  });

  it("makes 127.0.0.1 the default when no host is tagged", async () => {
    fetchResponses[CONFIG_PATH] = "192.0.2.30: box-a | WINDOWS_REMOTE";
    const hosts = await getIndexFunction("getOllamaHosts")();
    expect(hosts.map((h) => [h.ip, h.isDefault, h.isLocal])).toEqual([["127.0.0.1", true, true]]);
  });

  it("counts a host tagged only OLLAMA_DEFAULT_SERVER as a server", async () => {
    fetchResponses[CONFIG_PATH] = "192.0.2.40: box-a | OLLAMA_REMOTE\n192.0.2.41: box-b | OLLAMA_DEFAULT_SERVER";
    const hosts = await getIndexFunction("getOllamaHosts")();
    expect(hosts.map((h) => h.ip)).toEqual(["192.0.2.41", "192.0.2.40", "127.0.0.1"]);
  });

  it("uses the first OLLAMA_DEFAULT_SERVER when several are tagged", async () => {
    fetchResponses[CONFIG_PATH] =
      "192.0.2.50: box-a | OLLAMA_REMOTE | OLLAMA_DEFAULT_SERVER\n192.0.2.51: box-b | OLLAMA_REMOTE | OLLAMA_DEFAULT_SERVER";
    const hosts = await getIndexFunction("getOllamaHosts")();
    expect(hosts.filter((h) => h.isDefault).map((h) => h.ip)).toEqual(["192.0.2.50"]);
  });
});

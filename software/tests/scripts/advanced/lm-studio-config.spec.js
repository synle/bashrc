/** doWork tests for software/scripts/advanced/lm-studio-config.js. */
import { describe, it, expect } from "vitest";
import { fileSystem, mockFsExistence, mockExecCommands, runScript, getIndexConstant } from "../../setup.js";

const SCRIPT = "software/scripts/advanced/lm-studio-config.js";
const BASE_HOMEDIR_LINUX = getIndexConstant("BASE_HOMEDIR_LINUX");
const LM_STUDIO_FOLDER = `${BASE_HOMEDIR_LINUX}/.lmstudio`;
const INTERNAL_FOLDER = `${LM_STUDIO_FOLDER}/.internal`;
const CONFIG_PATH = `${INTERNAL_FOLDER}/http-server-config.json`;

/** Marks the LM Studio folders as present in the mocked filesystem. */
function setLmStudioFolders() {
  mockFsExistence[LM_STUDIO_FOLDER] = { type: "dir" };
  mockFsExistence[INTERNAL_FOLDER] = { type: "dir" };
}

describe("advanced/lm-studio-config.js doWork", () => {
  it("skips cleanly when ~/.lmstudio is absent", async () => {
    await expect(runScript(SCRIPT)).rejects.toThrow("no folder at");
    expect(fileSystem[CONFIG_PATH]).toBeUndefined();
  });

  it("creates the internal folder and full config when none exists", async () => {
    mockFsExistence[LM_STUDIO_FOLDER] = { type: "dir" };

    await runScript(SCRIPT);

    expect(mockExecCommands.some((cmd) => cmd.includes("mkdir -p") && cmd.includes(INTERNAL_FOLDER))).toBe(true);
    expect(JSON.parse(fileSystem[CONFIG_PATH])).toMatchInlineSnapshot(`
      {
        "autoStartOnLaunch": true,
        "cors": true,
        "fileLoggingMode": "succinct",
        "justInTimeModelLoading": true,
        "logIncomingTokens": false,
        "logLinesLimit": 500,
        "logSensitiveData": true,
        "networkInterface": "127.0.0.1",
        "port": 1234,
        "verbose": true,
      }
    `);
  });

  it("forces port and cors while keeping unrelated fields", async () => {
    setLmStudioFolders();
    const original = {
      autoStartOnLaunch: false,
      port: 4321,
      cors: false,
      logSensitiveData: false,
      customField: "keep me",
    };
    fileSystem[CONFIG_PATH] = JSON.stringify(original, null, 2);
    mockFsExistence[CONFIG_PATH] = { type: "file" };

    await runScript(SCRIPT);

    expect(JSON.parse(fileSystem[CONFIG_PATH])).toMatchInlineSnapshot(`
      {
        "autoStartOnLaunch": false,
        "cors": true,
        "customField": "keep me",
        "logSensitiveData": false,
        "port": 1234,
      }
    `);
    expect(fileSystem[`${CONFIG_PATH}.bak_original`]).toBe(JSON.stringify(original, null, 2));
  });

  it("leaves an already correct config byte-for-byte unchanged", async () => {
    setLmStudioFolders();
    const originalText = JSON.stringify({ port: 1234, cors: true, customField: "keep" }, null, 2);
    fileSystem[CONFIG_PATH] = originalText;
    mockFsExistence[CONFIG_PATH] = { type: "file" };

    await runScript(SCRIPT);

    expect(fileSystem[CONFIG_PATH]).toBe(originalText);
    expect(fileSystem[`${CONFIG_PATH}.bak_original`]).toBeUndefined();
  });

  it("leaves an unparseable config untouched", async () => {
    setLmStudioFolders();
    fileSystem[CONFIG_PATH] = "{not json";
    mockFsExistence[CONFIG_PATH] = { type: "file" };

    await expect(runScript(SCRIPT)).rejects.toThrow("cannot parse");
    expect(fileSystem[CONFIG_PATH]).toBe("{not json");
  });
});

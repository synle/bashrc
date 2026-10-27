import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["software/tests/smokes/webapp/**/*.spec.js", "software/tests/smokeTestRawUrls.spec.js"],
    // Bound browser processes while independent command snapshot files run.
    maxWorkers: 2,
    testTimeout: 30000,
    reporters: ["verbose"],
  },
});

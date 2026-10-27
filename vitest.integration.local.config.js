/** Integration suite for native subprocesses and the local webapp build; make validate runs this, not precommit. */
import { defineConfig } from "vitest/config";

process.env.WEBAPP_URL = "http://localhost:4173/";

export default defineConfig({
  test: {
    include: ["software/tests/integration/**/*.spec.js"],
    // Live URL reachability belongs only to the deployed integration suite.
    exclude: ["software/tests/integration/rawUrls.spec.js"],
    setupFiles: ["software/tests/setup.js"],
    // Bound native and browser processes independently of the fast unit suite.
    maxWorkers: 2,
    testTimeout: 30000,
    reporters: ["verbose"],
    globalSetup: ["software/tests/integration/webapp/local.setup.js"],
  },
});

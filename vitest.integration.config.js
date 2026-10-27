/** Integration suite for native subprocesses, browser behavior, and live URL reachability; excluded from precommit. */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["software/tests/integration/**/*.spec.js"],
    setupFiles: ["software/tests/setup.js"],
    // Bound native and browser processes independently of the fast unit suite.
    maxWorkers: 2,
    testTimeout: 30000,
    reporters: ["verbose"],
  },
});

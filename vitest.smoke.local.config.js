import { defineConfig } from "vitest/config";

process.env.WEBAPP_URL = "http://localhost:4173/";

export default defineConfig({
  test: {
    include: ["software/tests/smokes/webapp/**/*.spec.js"],
    // Preserve the prior two-browser-file concurrency as command snapshots add files.
    maxWorkers: 2,
    testTimeout: 30000,
    reporters: ["verbose"],
    globalSetup: ["software/tests/smokes/webapp/local.setup.js"],
  },
});

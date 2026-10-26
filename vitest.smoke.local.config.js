import { defineConfig } from "vitest/config";

process.env.WEBAPP_URL = "http://localhost:4173/";

export default defineConfig({
  test: {
    include: ["software/tests/smokeTestWebapp.spec.js", "software/tests/smokeTestWebapp.browser.spec.js"],
    testTimeout: 30000,
    reporters: ["verbose"],
    globalSetup: ["software/tests/smokeTestLocalSetup.js"],
  },
});

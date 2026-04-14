import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["software/tests/smokeTestWebapp.spec.js"],
    testTimeout: 30000,
    reporters: ["verbose"],
  },
});

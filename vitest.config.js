import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["software/tests/**/*.spec.js"],
    exclude: ["software/tests/smokeTestWebapp.spec.js", "software/tests/smokeTestRawUrls.spec.js", "software/tests/profileSyntax.spec.js", "software/tests/buildConfigShape.spec.js"],
    setupFiles: ["software/tests/setup.js"],
    reporters: ["verbose"],
  },
});

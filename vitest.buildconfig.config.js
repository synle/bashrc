import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["software/tests/buildConfigShape.spec.js"],
    reporters: ["verbose"],
  },
});

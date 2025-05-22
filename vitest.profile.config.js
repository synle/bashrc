import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["software/tests/profileSyntax.spec.js"],
    reporters: ["verbose"],
  },
});

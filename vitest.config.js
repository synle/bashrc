import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["software/tests/**/*.test.js"],
    setupFiles: ["software/tests/setup.js"],
  },
});

/**
 * @file vitest.config.js - Vitest configuration for the unit-test suite.
 *
 * Coverage is collected via the istanbul provider. We pre-instrument
 * `software/index.js` inside `software/tests/setup.js` before feeding it to
 * `vm.runInNewContext` (vitest's normal Vite-transform hook never sees that
 * source), and share `globalThis.__VITEST_COVERAGE__` between the host process
 * and the vm sandbox so counters land in a single map.
 *
 * Thresholds are set to the measured baseline (rounded down) — they are the
 * current floor, not the aspirational target for new code.
 */

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["software/tests/**/*.spec.js"],
    exclude: [
      "software/tests/smokeTestWebapp.spec.js",
      "software/tests/smokeTestRawUrls.spec.js",
      "software/tests/profileSyntax.spec.js",
      "software/tests/buildConfigShape.spec.js",
    ],
    setupFiles: ["software/tests/setup.js"],
    reporters: ["verbose"],
    coverage: {
      provider: "istanbul",
      // Unit-testable surface only. Emit-bash scripts under software/scripts/*.js
      // are exercised by `make test_dryrun` (a separate suite), not the unit
      // tests, so including them here would dilute the number.
      include: [
        "software/index.js",
        "software/common.js",
        "software/tools/**/*.js",
        "software/metadata/**/*.common.js",
        "software/scripts/**/*.common.js",
      ],
      exclude: ["software/tests/**", "**/*.spec.js"],
      reporter: ["text", "text-summary", "json-summary", "html"],
      reportsDirectory: "coverage",
      // Baseline measured against current main:
      //   statements 45.91% | branches 44.68% | functions 54.76% | lines 44.85%
      // Gate is set to the rounded-down floor (with a small flake buffer) so a clean
      // run passes today. This is the CURRENT floor — not the 80% aspirational target
      // for new code (that's per-PR enforcement, future work).
      thresholds: {
        lines: 42,
        statements: 44,
        branches: 42,
        functions: 52,
      },
    },
  },
});

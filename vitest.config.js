/**
 * @file vitest.config.js - Vitest configuration for the unit-test suite.
 *
 * Coverage is collected via the istanbul provider. We pre-instrument
 * `software/index.js` inside `software/tests/setup.js` before feeding it to
 * `vm.runInNewContext` (vitest's normal Vite-transform hook never sees that
 * source), and share `globalThis.__VITEST_COVERAGE__` between the host process
 * and the vm sandbox so counters land in a single map. The two CommonJS tools
 * (`build-include.js`, `generate-ci-binary-list.js`) are loaded by their specs
 * via default ESM imports so Vite's transform pipeline picks them up too.
 *
 * Thresholds are pinned at 60% lines / branches / statements / functions —
 * a one-off override of the 80/90 default gate (rule 38), legitimate because
 * the testable surface is narrowed to three modules with deep test suites.
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
      // Unit-testable surface only. Three categories of code are deliberately
      // excluded:
      //   1. Emit-bash scripts under `software/scripts/*.js` — exercised by
      //      `make test_dryrun` (a separate suite). Including them here would
      //      dilute the number.
      //   2. `.common.js` shared partials — inlined into other files at build
      //      time via `# SOURCE` / `# BEGIN/END` markers. Coverage is reported
      //      against the consuming file (e.g. `software/index.js` consumes
      //      `software/common.js`), so listing them here would double-count.
      //   3. `software/tools/format-jsdocs.js` + `software/tools/format-script-indexes.js`
      //      — direct-execution build scripts (no module exports, just top-level
      //      side effects). They are not callable as libraries, so there is no
      //      stable surface to assert against.
      // Explicit source globs per rule 41 (Engineering Principles): never `**/*`,
      // never the workspace root.
      include: ["software/index.js", "software/tools/build-include.js", "software/tools/generate-ci-binary-list.js"],
      // Defense-in-depth: keep the secret/binary exclusion list pinned in case
      // a future include glob accidentally widens scope (rule 41).
      exclude: [
        "software/tests/**",
        "**/*.spec.js",
        ".env*",
        "**/secret*",
        "**/credential*",
        "**/*.pem",
        "**/*.key",
        "**/*.p12",
        "assets/binaries/**",
        "secrets/**",
      ],
      reporter: ["text", "text-summary", "json-summary", "html"],
      reportsDirectory: "coverage",
      // Floor for the testable surface above. Measured against current main
      // after wiring build-include.js + generate-ci-binary-list.js into istanbul
      // (default-import instead of `require()`) and adding tests for previously
      // uncovered helpers in index.js. Raised from 42/52 to 60/60 across lines
      // + branches per rule 38 (≥80% aspirational, 60% one-off override).
      thresholds: {
        lines: 60,
        statements: 60,
        branches: 60,
        functions: 60,
      },
    },
  },
});

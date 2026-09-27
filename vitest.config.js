/**
 * @file vitest.config.js - Vitest configuration for the unit-test suite.
 *
 * Coverage is collected via the istanbul provider. We pre-instrument
 * `software/index.js` inside `software/tests/setup.js` before feeding it to
 * `vm.runInNewContext` (vitest's normal Vite-transform hook never sees that
 * source), and share `globalThis.__VITEST_COVERAGE__` between the host process
 * and the vm sandbox so counters land in a single map. The CommonJS tools
 * (`build-include.js`, `generate-ci-binary-list.js`, `build-installer.js`,
 * `check-dryrun-results.js`) are loaded by their specs via default ESM imports
 * so Vite's transform pipeline picks them up too. `llm-common.js` is NOT listed:
 * its specs evaluate it in their own vm sandbox, which istanbul cannot see
 * without the hand-instrumentation `index.js` gets.
 *
 * Thresholds are a ratchet pinned just under measured coverage (66 lines /
 * 62 branches / 66 statements / 74 functions) — a one-off override of the
 * ≥80% default coverage gate, legitimate because the testable surface is
 * narrowed to five modules with deep test suites. Raise, never lower.
 */

import { defineConfig } from "vitest/config";
import os from "os";

// `software/tests/setup.js` hand-instruments `software/index.js` with istanbul before
// feeding it to `vm.runInNewContext`. That costs ~1.5s per test file and is pure waste
// on a non-coverage run, but a worker has no public vitest signal for "coverage is on"
// — so detect the flag here (the only place that sees the CLI argv) and forward it.
const IS_COVERAGE_RUN = process.argv.includes("--coverage") || process.argv.includes("--coverage=true");

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
    env: {
      BASHRC_TEST_COVERAGE: IS_COVERAGE_RUN ? "1" : "0",
    },
    reporters: ["verbose"],
    // In-file concurrency for the `describe.concurrent` suites (the bash-subprocess
    // integration tests: packText, curlWrapperFormat, osDetection, bashHistoryClean…).
    // Those tests are subprocess-bound, not CPU-bound, so oversubscribing past the core
    // count is the point — vitest's default of 5 left most cores idle while the longest
    // file serialized the whole run.
    maxConcurrency: Math.max(8, os.cpus().length * 2),
    // Several suites (osDetection, packText, bashHistoryClean) spawn real bash
    // subprocesses. Under full-suite parallelism these routinely exceed vitest's
    // 5s default and fail intermittently, while passing in isolation. 30s is
    // still short enough that a genuine hang fails the run.
    testTimeout: 30000,
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
      // Explicit source globs per the "Coverage and artifact scope = source +
      // metrics only" principle: never `**/*`,
      // never the workspace root.
      include: [
        "software/index.js",
        "software/tools/build-include.js",
        "software/tools/generate-ci-binary-list.js",
        "software/tools/build-installer.js",
        "software/tools/check-dryrun-results.js",
      ],
      // Defense-in-depth: keep the secret/binary exclusion list pinned in case
      // a future include glob accidentally widens scope.
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
      // Ratchet floor for the testable surface above, floored from the measured
      // 2026-09-27 run (lines 66.53, statements 66.33, branches 62.99, functions
      // 74.78) after adding build-installer.js + check-dryrun-results.js. Raise
      // when coverage rises; never lower to make a run pass.
      thresholds: {
        lines: 66,
        statements: 66,
        branches: 62,
        functions: 74,
      },
    },
  },
});

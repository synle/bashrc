/**
 * Browser launcher functions and shell aliases for Chromium-based browsers (brave/chrome/edge/chromium/vivaldi/opera/arc).
 *
 * NOTE: Each launcher is emitted as `function name() { ... }` (not `name() { ... }`).
 * The `function` keyword is MANDATORY for two reasons:
 *   1. CLAUDE.md repo convention — "Bash functions must use the function keyword."
 *   2. Old bash 3.2 builds (pre-Catalina macOS) sometimes fail to parse `name()` inside an
 *      `if [ -z "$CLAUDECODE" ]; then ... fi` block, reporting
 *      "syntax error near unexpected token `('". The `function` keyword disambiguates the
 *      definition before the parser sees the `(`, avoiding the crash. See commits 43ca073/5fd4f9c.
 */
// SOURCE software/scripts/advanced/browser.common.js

/** Registers browser launcher functions (find_browser, run_browser) and shell wrappers for each supported browser. */
async function doWork() {
  log(">> Browser Launchers:");

  if (is_os_android_termux) {
    log(">> Skipped: Browser launchers not supported on Android Termux");
    return;
  }

  log(">> Registering browser launchers (find_browser, run_browser, brave, chrome, edge, chromium, vivaldi, opera, arc)");

  // Section 1: Brave Browser launcher
  registerWithBashSyleProfile(
    "Browser Launchers - Brave",
    code`
      _BRAVE_PATHS=(
        ${_BRAVE_PATHS.map((p) => `"${p}"`).join("\n")}
      )

      function brave() {
        local browser_args
        browser_args=("$@")

        run_browser "brave" "\${_BRAVE_PATHS[@]}"
      }
    `,
  );

  // Section 2: Google Chrome launcher
  registerWithBashSyleProfile(
    "Browser Launchers - Chrome",
    code`
      _CHROME_PATHS=(
        ${_CHROME_PATHS.map((p) => `"${p}"`).join("\n")}
      )

      function chrome() {
        local browser_args
        browser_args=("$@")

        run_browser "chrome" "\${_CHROME_PATHS[@]}"
      }
    `,
  );

  // Section 3: Microsoft Edge launcher
  registerWithBashSyleProfile(
    "Browser Launchers - Edge",
    code`
      _EDGE_PATHS=(
        ${_EDGE_PATHS.map((p) => `"${p}"`).join("\n")}
      )

      function edge() {
        local browser_args
        browser_args=("$@")

        run_browser "edge" "\${_EDGE_PATHS[@]}"
      }
    `,
  );

  // Section 4: Chromium launcher
  registerWithBashSyleProfile(
    "Browser Launchers - Chromium",
    code`
      _CHROMIUM_PATHS=(
        ${_CHROMIUM_PATHS.map((p) => `"${p}"`).join("\n")}
      )

      function chromium() {
        local browser_args
        browser_args=("$@")

        run_browser "chromium" "\${_CHROMIUM_PATHS[@]}"
      }
    `,
  );

  // Section 5: Vivaldi launcher
  registerWithBashSyleProfile(
    "Browser Launchers - Vivaldi",
    code`
      _VIVALDI_PATHS=(
        ${_VIVALDI_PATHS.map((p) => `"${p}"`).join("\n")}
      )

      function vivaldi() {
        local browser_args
        browser_args=("$@")

        run_browser "vivaldi" "\${_VIVALDI_PATHS[@]}"
      }
    `,
  );

  // Section 6: Opera launcher
  registerWithBashSyleProfile(
    "Browser Launchers - Opera",
    code`
      _OPERA_PATHS=(
        ${_OPERA_PATHS.map((p) => `"${p}"`).join("\n")}
      )

      function opera() {
        local browser_args
        browser_args=("$@")

        run_browser "opera" "\${_OPERA_PATHS[@]}"
      }
    `,
  );

  // Section 7: Arc launcher (macOS-only)
  registerWithBashSyleProfile(
    "Browser Launchers - Arc",
    code`
      _ARC_PATHS=(
        ${_ARC_PATHS.map((p) => `"${p}"`).join("\n")}
      )

      function arc() {
        local browser_args
        browser_args=("$@")

        run_browser "arc" "\${_ARC_PATHS[@]}"
      }
    `,
  );
}

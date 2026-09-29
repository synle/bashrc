/**
 * Benchmark interactive shell startup: time `bash -i -c exit` (which sources
 * ~/.bashrc → ~/.bash_syle) over N runs after W warmups, print min / median / p90,
 * persist the result as JSON for `make doctor`, and exit 1 when the median exceeds
 * the budget. hyperfine is used when installed; otherwise a node timer loop.
 *
 * Usage:
 *   node software/tools/bench-profile.js [--runs=10] [--warmup=3] [--budget-ms=400]
 *   make bench_profile
 *
 * Output file: $BASHRC_TEMP_ROOT_DIR/bench_profile.json (falls back to
 * <os tmpdir>/synle/bashrc when the variable is unset, e.g. a bare `make` shell).
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

/** @type {number} Default timed runs. */
const DEFAULT_RUNS = 10;
/** @type {number} Default untimed warmup runs (fill the page cache first). */
const DEFAULT_WARMUP = 3;
/**
 * @type {number} Default median budget in ms. A regression ceiling set from the
 * measured baseline (~330ms on an Apple Silicon Mac, 2026-09-29), not the goal —
 * the aspirational target is 150ms, tracked as enhancement #14.
 */
const DEFAULT_BUDGET_MS = 400;
/** @type {string[]} The command whose wall time is the user-perceived shell startup. */
const SHELL_COMMAND = ["bash", "-i", "-c", "exit"];

/**
 * Parses `--key=value` numeric flags from argv.
 * @param {string[]} argv - Arguments after the script path
 * @returns {{runs: number, warmup: number, budgetMs: number}} Parsed options with defaults applied
 * @throws {Error} When a flag value is not a positive integer
 */
function parseArgs(argv) {
  const opts = { runs: DEFAULT_RUNS, warmup: DEFAULT_WARMUP, budgetMs: DEFAULT_BUDGET_MS };
  const keys = { "--runs": "runs", "--warmup": "warmup", "--budget-ms": "budgetMs" };
  for (const arg of argv) {
    const [flag, raw] = arg.split("=");
    if (!(flag in keys)) throw new Error(`unknown flag: ${arg}`);
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 0) throw new Error(`${flag} needs a non-negative integer, got: ${raw}`);
    opts[keys[flag]] = value;
  }
  if (opts.runs < 1) throw new Error("--runs must be at least 1");
  return opts;
}

/**
 * Returns the value at percentile p of a sorted-ascending array (nearest-rank).
 * @param {number[]} sorted - Ascending samples
 * @param {number} p - Percentile in (0, 100]
 * @returns {number} The sample at that rank
 */
function percentile(sorted, p) {
  const rank = Math.max(1, Math.ceil((p / 100) * sorted.length));
  return sorted[rank - 1];
}

/**
 * Times one shell startup with a monotonic clock.
 * @returns {number} Elapsed wall time in ms
 * @throws {Error} When the shell exits non-zero (a broken profile must not benchmark as fast)
 */
function timeOnce() {
  const start = process.hrtime.bigint();
  const result = spawnSync(SHELL_COMMAND[0], SHELL_COMMAND.slice(1), { stdio: "ignore" });
  const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
  if (result.status !== 0) throw new Error(`'${SHELL_COMMAND.join(" ")}' exited ${result.status}`);
  return elapsedMs;
}

/**
 * Collects samples via hyperfine when available, else the node loop.
 * @param {number} runs - Timed runs
 * @param {number} warmup - Warmup runs
 * @returns {{tool: string, samples: number[]}} Samples in ms, unsorted
 */
function collectSamples(runs, warmup) {
  const probe = spawnSync("hyperfine", ["--version"], { stdio: "ignore" });
  if (probe.status === 0) {
    const exportPath = path.join(os.tmpdir(), `bench-profile-${process.pid}.json`);
    const run = spawnSync(
      "hyperfine",
      ["-N", "-w", String(warmup), "-r", String(runs), "--export-json", exportPath, SHELL_COMMAND.join(" ")],
      { stdio: ["ignore", "ignore", "inherit"] },
    );
    if (run.status !== 0) throw new Error(`hyperfine exited ${run.status}`);
    const times = JSON.parse(fs.readFileSync(exportPath, "utf8")).results[0].times;
    fs.unlinkSync(exportPath);
    return { tool: "hyperfine", samples: times.map((s) => s * 1000) };
  }
  for (let i = 0; i < warmup; i++) timeOnce();
  const samples = [];
  for (let i = 0; i < runs; i++) samples.push(timeOnce());
  return { tool: "node", samples };
}

/**
 * Entry point: benchmark, print, persist, gate on budget.
 * @returns {void}
 * @sideeffect Writes bench_profile.json; sets process.exitCode to 1 when over budget
 */
function main() {
  const opts = parseArgs(process.argv.slice(2));
  const { tool, samples } = collectSamples(opts.runs, opts.warmup);
  const sorted = [...samples].sort((a, b) => a - b);
  const result = {
    date: new Date().toISOString(),
    host: os.hostname(),
    tool,
    runs: opts.runs,
    warmup: opts.warmup,
    minMs: Math.round(sorted[0]),
    medianMs: Math.round(percentile(sorted, 50)),
    p90Ms: Math.round(percentile(sorted, 90)),
    budgetMs: opts.budgetMs,
  };
  result.withinBudget = result.medianMs <= opts.budgetMs;

  const outFolder = process.env.BASHRC_TEMP_ROOT_DIR || path.join(os.tmpdir(), "synle", "bashrc");
  fs.mkdirSync(outFolder, { recursive: true });
  const outFile = path.join(outFolder, "bench_profile.json");
  fs.writeFileSync(outFile, JSON.stringify(result, null, 2) + "\n");

  console.log(
    `shell startup (${tool}, ${opts.runs} runs): min ${result.minMs}ms, median ${result.medianMs}ms, p90 ${result.p90Ms}ms — budget ${opts.budgetMs}ms → ${result.withinBudget ? "OK" : "OVER BUDGET"}`,
  );
  console.log(`saved: ${outFile}`);
  if (!result.withinBudget) process.exitCode = 1;
}

main();

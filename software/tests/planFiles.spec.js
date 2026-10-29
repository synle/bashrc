/** Isolated shell contracts for repository-scoped shared plan discovery. */
import { describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

/** Checkout root containing the actual shared shell source. */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
/** Production help predicate, loaded without unrelated profile startup effects. */
const HELP = readFileSync(path.join(ROOT, "software/bootstrap/profile-core.sh"), "utf8").match(
  /function is_help_arg\(\) \{[\s\S]*?\n\}/,
)[0];
/** Production profile partial, sourced twice to exercise safe repeated loading. */
const PROFILE = path.join(ROOT, "software/scripts/advanced/llm/_common/llm-prompts.profile.bash");

/**
 * Run real shell helpers against an isolated checkout and relocated shared root.
 * @param {string} command - Fixed command or shell program controlled by the test.
 * @param {string[]} [args] - User arguments passed as positional parameters.
 * @param {object} [options] - Repository, configuration, and artifact fixture controls.
 * @param {string[]} [options.files] - Basenames of regular shared plan artifacts.
 * @param {string|null} [options.remote] - Origin URL, or null for a missing origin.
 * @param {boolean} [options.repository] - Whether to initialize an actual Git repository.
 * @param {boolean} [options.plansFolder] - Whether the shared plans folder exists.
 * @param {string} [options.rootState] - Configured, unset, or empty root environment state.
 * @returns {object} Captured process result with temporary root normalized in output.
 * @throws {Error} On fixture setup errors; always removes the owned temporary folder.
 */
function runPlans(
  command,
  args = [],
  {
    files = ["widget-store-auth.diff", "widget-store-auth.md", "other-service-auth.md"],
    remote = "https://example.test/acme/widget-store.git",
    repository = true,
    plansFolder = true,
    rootState = "configured",
  } = {},
) {
  const sandbox = mkdtempSync(path.join(os.tmpdir(), "plan-files-"));
  try {
    const checkout = path.join(sandbox, "checkout-slot");
    const cwd = path.join(checkout, "nested", "folder");
    const llmRoot = path.join(sandbox, "relocated shared root");
    const plans = path.join(llmRoot, "plans");
    const env = {
      ...process.env,
      HOME: sandbox,
      BASH_ENV: "/dev/null",
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_CONFIG_NOSYSTEM: "1",
      LLM_ROOT_FOLDER: llmRoot,
      PROFILE,
      LC_ALL: "C",
    };
    delete env.GIT_DIR;
    delete env.GIT_WORK_TREE;
    if (rootState === "unset") delete env.LLM_ROOT_FOLDER;
    if (rootState === "empty") env.LLM_ROOT_FOLDER = "";
    mkdirSync(cwd, { recursive: true });
    if (repository) {
      execFileSync("git", ["init", "--quiet", checkout], { env, timeout: 5000 });
      if (remote !== null) execFileSync("git", ["-C", checkout, "remote", "add", "origin", remote], { env, timeout: 5000 });
    }
    if (plansFolder) {
      mkdirSync(plans, { recursive: true });
      mkdirSync(path.join(plans, "widget-store-not_a_file"));
      for (const name of files) writeFileSync(path.join(plans, name), "content_only_keyword\n");
    }
    const result = spawnSync(
      "/bin/bash",
      ["--noprofile", "--norc", "-c", `${HELP}\n. "$PROFILE"\n. "$PROFILE"\n${command}`, "test", ...args],
      { cwd, env, encoding: "utf8", timeout: 5000 },
    );
    return {
      ...result,
      stdout: result.stdout?.split(sandbox).join("<sandbox>"),
      stderr: result.stderr?.split(sandbox).join("<sandbox>"),
    };
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
}

describe("repository plan files", () => {
  it("lists plans, revisions, and sidecars from origin rather than the checkout basename", () => {
    const result = runPlans('plan_list "$@"', [], {
      files: [
        "widget-store-auth.md",
        "widget-store-auth.diff",
        "widget-store-auth_v2.md",
        "widget-store-auth.notes.txt",
        "widget-storage-auth.md",
        "other-widget-store-auth.md",
        "checkout-slot-auth.md",
      ],
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe(
      "<sandbox>/relocated shared root/plans/widget-store-auth.diff\n" +
        "<sandbox>/relocated shared root/plans/widget-store-auth.md\n" +
        "<sandbox>/relocated shared root/plans/widget-store-auth.notes.txt\n" +
        "<sandbox>/relocated shared root/plans/widget-store-auth_v2.md\n",
    );
  });

  it.each([
    "git@example.test:acme/widget-store.git",
    "ssh://git@example.test/acme/widget-store.git",
    "https://example.test/acme/widget-store.git/",
    "/srv/repos/widget-store.git",
  ])("resolves repository identity from %s", (remote) => {
    const result = runPlans('plan_list "$@"', [], { remote, files: ["widget-store-auth.md"] });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe("<sandbox>/relocated shared root/plans/widget-store-auth.md\n");
  });

  it.each([[], ["other-service-auth.md"]])("returns an empty list for unrelated or absent artifacts %j", (...files) => {
    const result = runPlans('plan_list "$@"', [], { files });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
  });

  it("filters filenames by a case-insensitive partial keyword and includes sidecars", () => {
    const result = runPlans('plan_search "$@"', ["AuT"]);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe(
      "<sandbox>/relocated shared root/plans/widget-store-auth.diff\n" + "<sandbox>/relocated shared root/plans/widget-store-auth.md\n",
    );
  });

  it.each(["auth[1]", "literal*", "space file", "quote'\"\\", "\u2603", "-dash"])("treats partial keyword %j literally", (keyword) => {
    const result = runPlans('plan_search "$@"', [keyword], {
      files: [`widget-store-${keyword}.md`, "widget-store-unrelated.md", `other-service-${keyword}.md`],
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe(`<sandbox>/relocated shared root/plans/widget-store-${keyword}.md\n`);
  });

  it.each(["missing", "relocated", "content_only_keyword"])("does not search parent folders or contents for %s", (keyword) => {
    const result = runPlans('plan_search "$@"', [keyword]);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe("");
  });

  it("keeps an empty repository list empty during search", () => {
    const result = runPlans('plan_search "$@"', ["auth"], { files: [] });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe("");
  });

  it.each(["shopt -u nocasematch", "shopt -s nocasematch"])("preserves caller matching options after %s", (setup) => {
    const result = runPlans(
      `${setup}\nbefore=$(shopt -p nocasematch)\nplan_search "$@"\nafter=$(shopt -p nocasematch)\n[ "$before" = "$after" ]`,
      ["missing"],
    );
    expect(result.status, result.stderr).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe("");
  });

  it.each(["plan_list", "plan_search"])("shows %s help without a repository or shared-root configuration", (command) => {
    const result = runPlans(`${command} "$@"`, ["--help"], { repository: false, plansFolder: false, rootState: "unset" });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain(`${command}:`);
    expect(result.stdout).toContain(`Usage: ${command}`);
  });

  it.each([
    ["plan_list", ["extra"], "plan_list: takes no arguments; usage: plan_list\n"],
    ["plan_search", [], "plan_search: requires one nonempty keyword; usage: plan_search <keyword>\n"],
    ["plan_search", [""], "plan_search: requires one nonempty keyword; usage: plan_search <keyword>\n"],
    ["plan_search", ["auth", "extra"], "plan_search: requires one nonempty keyword; usage: plan_search <keyword>\n"],
  ])("rejects invalid %s arguments %j without listing files", (command, args, error) => {
    const result = runPlans(`${command} "$@"`, args);
    expect(result.status).toBe(2);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe(error);
  });

  it.each(["unset", "empty"])("rejects a %s shared root instead of guessing its location", (rootState) => {
    const result = runPlans('plan_list "$@"', [], { rootState });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("plan_list: LLM_ROOT_FOLDER is not configured\n");
  });

  it("reports a missing configured plans folder", () => {
    const result = runPlans('plan_list "$@"', [], { plansFolder: false });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("plan_list: no plans folder at <sandbox>/relocated shared root/plans\n");
  });

  it.each([{ repository: false }, { remote: null }])("rejects missing repository identity %j", (options) => {
    const result = runPlans('plan_list "$@"', [], options);
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("plan_list: cannot resolve origin for the current repository\n");
  });

  it("rejects an origin without a repository basename", () => {
    const result = runPlans('plan_list "$@"', [], { remote: "/" });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("plan_list: origin has no repository name\n");
  });

  it("preserves listing failures during search without emitting paths", () => {
    const result = runPlans('plan_search "$@"', ["auth"], { remote: null });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("plan_list: cannot resolve origin for the current repository\n");
  });

  it("supports nounset and errexit with no results", () => {
    const result = runPlans('set -eu\nplan_search "$@"', ["missing"]);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
  });
});

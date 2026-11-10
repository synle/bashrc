/** Tests for run.sh startup-file formatting at finalization. */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

/** Current runner source; only its finalization block executes in these fixtures. */
const source = fs.readFileSync(new URL("../../run.sh", import.meta.url), "utf8");
/** Production path resolver prevents formatting protected symlink destinations. */
const loader = fs.readFileSync(new URL("../bootstrap/safe-source.bash", import.meta.url), "utf8");
/** Isolated fixture root, removed after each test. */
let sandbox;

beforeEach(() => {
  sandbox = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "startup format ")));
  fs.mkdirSync(path.join(sandbox, "bin"));
  fs.symlinkSync(process.execPath, path.join(sandbox, "bin/node"));
  fs.writeFileSync(path.join(sandbox, ".bashrc"), "original bashrc\n");
  fs.writeFileSync(path.join(sandbox, ".bash_profile"), "original profile\n");
  fs.writeFileSync(
    path.join(sandbox, "bin/shfmt"),
    `#!/bin/bash
if [ "$1" = "--to-json" ]; then
  if [ "$PARSE_STATUS" -ne 0 ]; then exit "$PARSE_STATUS"; fi
  if [ "$PARSE_MUTATION" = change ] && [ ! -f "$HOME/changed" ]; then
    printf '%s\\n' writer > "$HOME/.bashrc"
    : > "$HOME/changed"
  fi
  printf '%s\\n' '{"Type":"File"}'
  exit 0
fi
printf '%s\\n' "$@" >> "$HOME/arguments"
if [ "$FORMAT_STATUS" -ne 0 ]; then exit "$FORMAT_STATUS"; fi
if [ "$PARSE_MUTATION" = change ]; then
  printf '\\nformatted\\n\\n' > "$6"
else
  printf 'formatted\\n' > "$6"
fi
`,
    { mode: 0o755 },
  );
});

afterEach(() => {
  fs.rmSync(sandbox, { recursive: true, force: true });
});

/** Execute the real finalization block with isolated HOME/PATH; return the child result and its exit status. */
function run({ args = [], status = 0, formatStatus = 0, parseStatus = 0, parseMutation = "", dryRun = "0" } = {}) {
  const start = source.indexOf("# --- Format shell startup files ---");
  const end = source.indexOf("\n_run_end_epoch=", start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return spawnSync(
    "/bin/bash",
    [
      "-c",
      `${loader}\nfunction is_truthy() { case "$1" in 1|true|y|yes) return 0 ;; *) return 1 ;; esac; }\n${source.slice(start, end)}\nexit "$_run_status"`,
      "runner",
      ...args,
    ],
    {
      encoding: "utf8",
      timeout: 5000,
      env: {
        HOME: sandbox,
        PATH: path.join(sandbox, "bin"),
        _run_status: String(status),
        FORMAT_STATUS: String(formatStatus),
        PARSE_STATUS: String(parseStatus),
        PARSE_MUTATION: parseMutation,
        IS_DRY_RUN: dryRun,
        BASH_SYLE_PATH: path.join(sandbox, ".bash_syle"),
        BASH_SYLE_COMMON_PATH: path.join(sandbox, ".bash_syle_common"),
        BASH_SYLE_CACHE_PATH: path.join(sandbox, ".bash_syle_cache"),
      },
    },
  );
}

describe("run.sh startup-file formatting", () => {
  it("formats both existing files with the requested options", () => {
    const result = run();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Formatting shell startup files");
    expect(fs.readFileSync(path.join(sandbox, "arguments"), "utf8")).toBe(
      `-w\n-i\n2\n-bn\n-sr\n${sandbox}/.bashrc\n-w\n-i\n2\n-bn\n-sr\n${sandbox}/.bash_profile\n`,
    );
    expect(fs.readFileSync(path.join(sandbox, ".bashrc"), "utf8")).toBe("formatted\n");
    expect(fs.readFileSync(path.join(sandbox, ".bash_profile"), "utf8")).toBe("formatted\n");
  });

  it.each(["--dryrun", "-dryrun", "--dry-run", "-dry-run"])("does not modify startup files for %s", (arg) => {
    const result = run({ args: [arg] });
    expect(result.status).toBe(0);
    expect(fs.existsSync(path.join(sandbox, "arguments"))).toBe(false);
    expect(fs.readFileSync(path.join(sandbox, ".bashrc"), "utf8")).toBe("original bashrc\n");
    expect(fs.readFileSync(path.join(sandbox, ".bash_profile"), "utf8")).toBe("original profile\n");
  });

  it("honors the inherited dry-run environment", () => {
    expect(run({ dryRun: "1" }).status).toBe(0);
    expect(fs.existsSync(path.join(sandbox, "arguments"))).toBe(false);
  });

  it("skips missing startup files without creating them", () => {
    fs.unlinkSync(path.join(sandbox, ".bash_profile"));
    expect(run().status).toBe(0);
    expect(fs.readFileSync(path.join(sandbox, ".bashrc"), "utf8")).toBe("formatted\n");
    expect(fs.existsSync(path.join(sandbox, ".bash_profile"))).toBe(false);
  });

  it("formats hidden bash and sh files without formatting unrelated files", () => {
    fs.writeFileSync(path.join(sandbox, ".work setup.bash"), "original bash\n");
    fs.writeFileSync(path.join(sandbox, ".custom.sh"), "original sh\n");
    fs.writeFileSync(path.join(sandbox, "visible.sh"), "original visible\n");
    fs.writeFileSync(path.join(sandbox, ".notes.txt"), "original notes\n");
    const result = run();
    expect(result.status).toBe(0);
    expect(fs.readFileSync(path.join(sandbox, ".work setup.bash"), "utf8")).toBe("formatted\n");
    expect(fs.readFileSync(path.join(sandbox, ".custom.sh"), "utf8")).toBe("formatted\n");
    expect(fs.readFileSync(path.join(sandbox, "visible.sh"), "utf8")).toBe("original visible\n");
    expect(fs.readFileSync(path.join(sandbox, ".notes.txt"), "utf8")).toBe("original notes\n");
    expect(fs.readFileSync(path.join(sandbox, ".bashrc"), "utf8")).toBe("formatted\n");
    expect(fs.readFileSync(path.join(sandbox, ".bash_profile"), "utf8")).toBe("formatted\n");
  });

  it("formats all three generated profile files", () => {
    fs.writeFileSync(path.join(sandbox, ".bash_syle"), "original profile\n");
    fs.writeFileSync(path.join(sandbox, ".bash_syle_common"), "original common\n");
    fs.writeFileSync(path.join(sandbox, ".bash_syle_cache"), "original cache\n");
    expect(run().status).toBe(0);
    expect(fs.readFileSync(path.join(sandbox, ".bash_syle"), "utf8")).toBe("formatted\n");
    expect(fs.readFileSync(path.join(sandbox, ".bash_syle_common"), "utf8")).toBe("formatted\n");
    expect(fs.readFileSync(path.join(sandbox, ".bash_syle_cache"), "utf8")).toBe("formatted\n");
  });

  it("skips formatting when shfmt is unavailable", () => {
    fs.unlinkSync(path.join(sandbox, "bin/shfmt"));
    const result = run();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("shfmt is not installed");
    expect(fs.readFileSync(path.join(sandbox, ".bashrc"), "utf8")).toBe("original bashrc\n");
    expect(fs.readFileSync(path.join(sandbox, ".bash_profile"), "utf8")).toBe("original profile\n");
  });

  it("reports formatting failure and still attempts both files", () => {
    const result = run({ formatStatus: 7 });
    expect(result.status).toBe(7);
    expect(result.stderr).toContain(`Failed to format ${sandbox}/.bashrc`);
    expect(result.stderr).toContain(`Failed to format ${sandbox}/.bash_profile`);
    expect(fs.readFileSync(path.join(sandbox, ".bashrc"), "utf8")).toBe("original bashrc\n");
    expect(fs.readFileSync(path.join(sandbox, ".bash_profile"), "utf8")).toBe("original profile\n");
  });

  it("reports syntax-tree parser failure while still attempting later files", () => {
    const result = run({ parseStatus: 9 });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`Failed to format ${sandbox}/.bashrc`);
    expect(result.stderr).toContain(`Failed to format ${sandbox}/.bash_profile`);
    expect(fs.readFileSync(path.join(sandbox, "arguments"), "utf8")).toContain(`${sandbox}/.bash_profile`);
  });

  it("does not overwrite a concurrent change made while parsing", () => {
    const result = run({ parseMutation: "change" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Startup file changed during spacing normalization; retry is safe");
    expect(fs.readFileSync(path.join(sandbox, ".bashrc"), "utf8")).toBe("writer\n");
    expect(fs.readFileSync(path.join(sandbox, ".bash_profile"), "utf8")).toBe("formatted\n");
  });

  it("reports missing Node without hiding an earlier runner failure", () => {
    fs.unlinkSync(path.join(sandbox, "bin/node"));
    const result = run({ status: 23 });
    expect(result.status).toBe(23);
    expect(result.stderr).toContain(`Failed to format ${sandbox}/.bashrc`);
    expect(result.stderr).toContain(`Failed to format ${sandbox}/.bash_profile`);
  });

  it.each([0, 7])("preserves an earlier runner failure when shfmt exits %s", (formatStatus) => {
    const result = run({ status: 23, formatStatus });
    expect(result.status).toBe(23);
    expect(fs.readFileSync(path.join(sandbox, "arguments"), "utf8")).toContain(`${sandbox}/.bash_profile`);
  });
});

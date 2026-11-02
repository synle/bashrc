/** Exercise make's real formatter selection without formatting unrelated working files. */
import { describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

/** Repository Makefile whose target runs from an isolated fixture checkout. */
const MAKEFILE = path.resolve("Makefile");

describe("make format_shell", () => {
  it("formats tracked Bash and shell sources with existing flags and intact spaced filenames", () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), "format-shell-"));
    try {
      fs.mkdirSync(path.join(folder, "bin"));
      fs.writeFileSync(path.join(folder, "bin/shfmt"), '#!/bin/bash\nprintf "%s\\0" "$@" >> "$FORMAT_LOG"\n', { mode: 0o755 });
      for (const name of [
        "root.bash",
        "run.sh",
        "docs/folder with spaces/example.sh",
        ".devcontainer/profile.sh",
        "software/tools/helper.bash",
        "software/scripts/example.bash",
        "software/scripts/windows/template.ps1.bash",
        ".build/generated.sh",
        "assets/example.sh",
        "software/scripts/advanced/llm/_common/v1/frozen.sh",
        "software/scripts/advanced/llm/_common/v2/frozen.bash",
        "software/scripts/advanced/bash-autocomplete-complete-spec-skeleton.bash",
      ]) {
        const target = path.join(folder, name);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, "#!/bin/bash\ntrue\n");
      }
      execFileSync("git", ["init", "-q", folder]);
      execFileSync("git", ["-C", folder, "add", "."]);
      fs.writeFileSync(path.join(folder, "untracked.bash"), "true\n");
      const log = path.join(folder, "format.log");
      const result = spawnSync("make", ["-f", MAKEFILE, "format_shell"], {
        cwd: folder,
        encoding: "utf8",
        timeout: 5000,
        env: { ...process.env, PATH: `${folder}/bin:${process.env.PATH}`, BASH_ENV: "/dev/null", FORMAT_LOG: log },
      });
      expect(result.status, result.stderr).toBe(0);
      expect(fs.readFileSync(log, "utf8").split("\0").filter(Boolean)).toEqual([
        "-w",
        "-i",
        "2",
        "-bn",
        "-sr",
        ".devcontainer/profile.sh",
        "-w",
        "-i",
        "2",
        "-bn",
        "-sr",
        "docs/folder with spaces/example.sh",
        "-w",
        "-i",
        "2",
        "-bn",
        "-sr",
        "root.bash",
        "-w",
        "-i",
        "2",
        "-bn",
        "-sr",
        "run.sh",
        "-w",
        "-i",
        "2",
        "-bn",
        "-sr",
        "software/scripts/example.bash",
        "-w",
        "-i",
        "2",
        "-bn",
        "-sr",
        "software/tools/helper.bash",
      ]);
    } finally {
      fs.rmSync(folder, { recursive: true, force: true });
    }
  });

  it("prints failed filenames and diagnostics while formatting later files and returning success", () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), "format-shell-failure-"));
    try {
      fs.mkdirSync(path.join(folder, "bin"));
      fs.writeFileSync(path.join(folder, "a broken.bash"), "if\n");
      fs.writeFileSync(path.join(folder, "z valid.sh"), "true\n");
      fs.writeFileSync(
        path.join(folder, "bin/shfmt"),
        `#!/bin/bash
if [ "$6" = 'a broken.bash' ]; then
  printf '%s\\n' 'a broken.bash:1: reached EOF without matching fi' >&2
  exit 1
fi
printf '%s\\n' "$6" >> "$FORMAT_LOG"
`,
        { mode: 0o755 },
      );
      execFileSync("git", ["init", "-q", folder]);
      execFileSync("git", ["-C", folder, "add", "."]);
      const log = path.join(folder, "format.log");
      const result = spawnSync("make", ["-f", MAKEFILE, "format_shell"], {
        cwd: folder,
        encoding: "utf8",
        timeout: 5000,
        env: { ...process.env, PATH: `${folder}/bin:${process.env.PATH}`, BASH_ENV: "/dev/null", FORMAT_LOG: log },
      });
      expect(result.status, result.stderr).toBe(0);
      expect(result.stderr).toContain("a broken.bash:1: reached EOF without matching fi");
      expect(result.stderr).toContain("Shell formatting failed: a broken.bash");
      expect(fs.readFileSync(log, "utf8")).toBe("z valid.sh\n");
    } finally {
      fs.rmSync(folder, { recursive: true, force: true });
    }
  });
});

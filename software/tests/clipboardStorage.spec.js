/** Caller-facing clipboard storage and independent retention contracts. */
import { describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import vm from "vm";
import { createRequire } from "module";
import { spawnSync } from "child_process";

/** Real cleanup API also used by the installed command. */
const { cleanup } = createRequire(import.meta.url)("../scripts/clipboard-cleanup.common.cjs");
/** Shipped clipboard profile. */
const profile = path.resolve("software/scripts/bash-clipboard.profile.bash");

/**
 * Own one isolated personal root and remove only its fixtures on completion.
 * @param {function(string): *} action Fixture operation.
 * @returns {*} Operation result.
 */
function fixture(action) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "clipboard-storage-"));
  try {
    fs.mkdirSync(path.join(root, ".syle_clipboard", "plain"), { recursive: true });
    return action(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

/** Create a managed file with independently specified modification time. */
function entry(root, name, seconds) {
  const file = path.join(root, ".syle_clipboard", name);
  fs.writeFileSync(file, name);
  fs.utimesSync(file, seconds, seconds);
  return file;
}

describe("clipboard retention", () => {
  it("keeps ten per type by mtime without counting unrelated files", () =>
    fixture((root) => {
      for (let n = 0; n < 12; n++) {
        entry(root, `plain/text-${n}`, n + 1);
        entry(root, `image-${n}.png`, n + 1);
      }
      entry(root, "keep.txt", 0);
      expect(cleanup(root)).toBe(4);
      expect(fs.readdirSync(path.join(root, ".syle_clipboard", "plain"))).toHaveLength(10);
      expect(fs.readdirSync(path.join(root, ".syle_clipboard"))).toHaveLength(12);
      expect(fs.existsSync(path.join(root, ".syle_clipboard", "plain", "text-0"))).toBe(false);
      expect(fs.existsSync(path.join(root, ".syle_clipboard", "image-0.png"))).toBe(false);
      expect(cleanup(root)).toBe(0);
    }));

  it("enforces the overall cap after per-type limits using mtime, not names", () =>
    fixture((root) => {
      entry(root, "plain/z", 1);
      entry(root, "plain/a", 4);
      entry(root, "old.png", 2);
      entry(root, "new.png", 3);
      expect(cleanup(root, 2, 2)).toBe(2);
      expect(fs.readdirSync(path.join(root, ".syle_clipboard", "plain"))).toEqual(["a"]);
      expect(fs.readdirSync(path.join(root, ".syle_clipboard"))).toEqual(["new.png", "plain"]);
    }));

  it("supports zero limits while preserving symlinks and subfolders", () =>
    fixture((root) => {
      const outside = path.join(root, "outside");
      fs.writeFileSync(outside, "preserve");
      fs.symlinkSync(outside, path.join(root, ".syle_clipboard", "link.png"));
      fs.mkdirSync(path.join(root, ".syle_clipboard", "plain", "folder"));
      entry(root, "plain/delete", 1);
      expect(cleanup(root, 0, 0)).toBe(1);
      expect(fs.readFileSync(outside, "utf8")).toBe("preserve");
      expect(fs.lstatSync(path.join(root, ".syle_clipboard", "link.png")).isSymbolicLink()).toBe(true);
      expect(fs.readdirSync(path.join(root, ".syle_clipboard", "plain"))).toEqual(["folder"]);
    }));

  it.each([-1, 0.5, NaN, 100001])("rejects invalid limits %s before deleting", (limit) =>
    fixture((root) => {
      const saved = entry(root, "saved.png", 1);
      expect(() => cleanup(root, limit)).toThrow("retention limits");
      expect(fs.readFileSync(saved, "utf8")).toBe("saved.png");
    }),
  );

  it("rejects a linked storage folder", () =>
    fixture((root) => {
      fs.rmdirSync(path.join(root, ".syle_clipboard", "plain"));
      fs.symlinkSync(root, path.join(root, ".syle_clipboard", "plain"));
      expect(() => cleanup(root)).toThrow("real folder");
    }));

  it("tolerates missing storage", () =>
    fixture((root) => {
      expect(cleanup(path.join(root, "absent"))).toBe(0);
    }));

  it.each(["", "relative"])("rejects invalid personal root %j", (root) => {
    expect(() => cleanup(root)).toThrow("absolute non-empty folder");
  });

  it("runs the standalone command with explicit limits", () =>
    fixture((root) => {
      entry(root, "plain/old", 1);
      entry(root, "new.png", 2);
      const result = spawnSync(process.execPath, ["software/scripts/clipboard-cleanup.common.cjs", "1", "1"], {
        env: { ...process.env, SY_ROOT_FOLDER: root },
        encoding: "utf8",
        timeout: 5000,
      });
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toBe("Removed 1 clipboard files\n");
      expect(fs.readdirSync(path.join(root, ".syle_clipboard", "plain"))).toEqual([]);
      expect(fs.readFileSync(path.join(root, ".syle_clipboard", "new.png"), "utf8")).toBe("new.png");
    }));
});

describe("clipboard storage callers", () => {
  it("copies raw text to plain and reads it back without pruning", () =>
    fixture((root) => {
      for (let n = 0; n < 11; n++) entry(root, `plain/old-${n}`, n + 1);
      const result = spawnSync(
        "/bin/bash",
        [
          "--noprofile",
          "--norc",
          "-c",
          `
      function safe_mkdir() { command mkdir -p "$1"; }
      function is_help_arg() { return 1; }
      . "$1"
      printf 'raw  \\n' | copy --raw
      paste
    `,
          "test",
          profile,
        ],
        {
          encoding: "utf8",
          env: {
            ...process.env,
            SY_ROOT_FOLDER: root,
            is_os_mac: "0",
            is_os_wsl: "0",
            is_os_android_termux: "0",
            is_gui_wayland: "0",
            is_gui_x11: "0",
            BASH_ENV: "/dev/null",
          },
        },
      );
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toBe("raw  \n");
      expect(fs.readdirSync(path.join(root, ".syle_clipboard", "plain"))).toHaveLength(12);
    }));

  it.each([undefined, "", "custom images"])("generated saver respects image folder %j in stripped environments", async (override) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "clipboard-image-"));
    try {
      const written = {};
      const context = {
        path,
        BASE_HOMEDIR_LINUX: root,
        SY_ROOT_FOLDER: root,
        IS_DRY_RUN: true,
        log() {},
        fs,
        code: (strings, ...values) => String.raw({ raw: strings }, ...values),
        readText: async () => fs.readFileSync("software/scripts/clipboard-cleanup.common.cjs", "utf8"),
        writeText: async (file, content) => {
          written[path.basename(file)] = content;
        },
      };
      vm.runInNewContext(fs.readFileSync("software/scripts/clipboard-image.js", "utf8"), context);
      await context.doWork();
      const saver = path.join(root, "saver");
      fs.writeFileSync(saver, written.save_clipboard_image);
      fs.writeFileSync(path.join(root, "uname"), "#!/bin/bash\nprintf 'Darwin\\n'\n", { mode: 0o755 });
      fs.writeFileSync(path.join(root, "pngpaste"), "#!/bin/bash\nprintf 'image bytes' > \"$1\"\n", { mode: 0o755 });
      const env = { PATH: `${root}:/usr/bin:/bin`, HOME: root, BASH_ENV: "/dev/null" };
      if (override !== undefined) env.CLIPBOARD_IMAGE_FOLDER = override ? path.join(root, override) : "";
      const result = spawnSync("/bin/bash", [saver], { env, encoding: "utf8" });
      expect(result.status, result.stderr).toBe(0);
      const output = result.stdout.trim();
      expect(path.dirname(output)).toBe(override ? path.join(root, override) : path.join(root, ".syle_clipboard"));
      expect(fs.readFileSync(output, "utf8")).toBe("image bytes");
      expect(written.syle_clipboard_cleanup).not.toContain('"__SY_CLIPBOARD_ROOT__"');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

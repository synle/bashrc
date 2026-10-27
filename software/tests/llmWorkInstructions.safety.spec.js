/** Work instruction discovery must reject unsafe paths before reading their contents. */
import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadWorkInstructions } from "./workInstructions.helpers.js";

/** Private root containing separate home and outside-home fixtures. */
let root;
/** Isolated home folder used by the real shared loader. */
let home;
/** Instrumented filesystem boundary; forbidden reads never reach the real filesystem. */
let filesystem;
/** Real shared instruction loader. */
let llm;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "work-instruction-safety-"));
  home = path.join(root, "home");
  fs.mkdirSync(home);
  filesystem = {
    ...fs,
    readFileSync: vi.fn((file, encoding) => {
      if (String(file).includes(".secret.")) throw Object.assign(new Error("Forbidden fixture read"), { code: "EACCES" });
      return fs.readFileSync(file, encoding);
    }),
  };
  llm = loadWorkInstructions(home, filesystem);
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe("instruction source safety", () => {
  it("does not read or append secret-named discovered documents", () => {
    fs.writeFileSync(path.join(home, ".work_acme.secret._instructions.md"), "");
    expect(llm.refreshPathKeyedBlocks("common", home)).toBe("common");
    expect(filesystem.readFileSync).not.toHaveBeenCalled();
  });

  it("does not read a secret-named source even when explicitly referenced", () => {
    fs.writeFileSync(path.join(home, "rules.secret.md"), "");
    const input = "<!-- BEGIN Mine | ~/rules.secret.md -->\nkept\n<!-- END Mine | ~/rules.secret.md -->\n";
    expect(llm.refreshPathKeyedBlocks(input, home)).toBe(input);
    expect(filesystem.readFileSync).not.toHaveBeenCalled();
  });

  it("does not read a symlink target containing .secret.", () => {
    const target = path.join(home, "rules.secret.md");
    fs.writeFileSync(target, "");
    fs.symlinkSync(target, path.join(home, ".work_acme_instructions.md"));
    expect(llm.refreshPathKeyedBlocks("common", home)).toBe("common");
    expect(filesystem.readFileSync).not.toHaveBeenCalled();
  });

  it("does not read a symlink target outside the home folder", () => {
    const target = path.join(root, "outside.md");
    fs.writeFileSync(target, "outside");
    fs.symlinkSync(target, path.join(home, ".work_acme_instructions.md"));
    expect(llm.refreshPathKeyedBlocks("common", home)).toBe("common");
    expect(filesystem.readFileSync).not.toHaveBeenCalled();
  });

  it("allows safe symlinks within a home whose own path is a symlink", () => {
    const alias = path.join(root, "home-alias");
    fs.symlinkSync(home, alias);
    fs.writeFileSync(path.join(home, "rules.md"), "safe");
    fs.symlinkSync(path.join(home, "rules.md"), path.join(home, ".work_acme_instructions.md"));
    expect(llm.refreshPathKeyedBlocks("", alias)).toContain("\nsafe\n");
  });

  it.each([".work_bad|marker_instructions.md", ".work_bad\nmarker_instructions.md", ".work_bad>marker_instructions.md"])(
    "rejects filenames that cannot form safe markers: %j",
    (name) => {
      fs.writeFileSync(path.join(home, name), "unsafe marker");
      expect(llm.refreshPathKeyedBlocks("common", home)).toBe("common");
      expect(filesystem.readFileSync).not.toHaveBeenCalled();
    },
  );

  it("keeps duplicate markers unchanged without reading their source", () => {
    fs.writeFileSync(path.join(home, ".work_acme_instructions.md"), "new");
    const block =
      "<!-- BEGIN Custom Work Prompt | ~/.work_acme_instructions.md -->\nkept\n<!-- END Custom Work Prompt | ~/.work_acme_instructions.md -->\n";
    expect(llm.refreshPathKeyedBlocks(block + block, home)).toBe(block + block);
    expect(filesystem.readFileSync).not.toHaveBeenCalled();
  });

  it("keeps reversed markers unchanged without reading their source", () => {
    fs.writeFileSync(path.join(home, ".work_acme_instructions.md"), "new");
    const input =
      "<!-- END Custom Work Prompt | ~/.work_acme_instructions.md -->\nkept\n<!-- BEGIN Custom Work Prompt | ~/.work_acme_instructions.md -->\n";
    expect(llm.refreshPathKeyedBlocks(input, home)).toBe(input);
    expect(filesystem.readFileSync).not.toHaveBeenCalled();
  });

  it("does not append a block when its END marker already exists alone", () => {
    fs.writeFileSync(path.join(home, ".work_acme_instructions.md"), "new");
    const input = "<!-- END Custom Work Prompt | ~/.work_acme_instructions.md -->\n";
    expect(llm.refreshPathKeyedBlocks(input, home)).toBe(input);
    expect(filesystem.readFileSync).not.toHaveBeenCalled();
  });

  it("rejects a requested secret path even when normalization would remove that component", () => {
    fs.writeFileSync(path.join(home, "rules.md"), "safe");
    const input =
      "<!-- BEGIN Mine | ~/hidden.secret.folder/../rules.md -->\nkept\n<!-- END Mine | ~/hidden.secret.folder/../rules.md -->\n";
    expect(llm.refreshPathKeyedBlocks(input, home)).toBe(input);
    expect(filesystem.readFileSync).not.toHaveBeenCalled();
  });

  it("keeps instructions unchanged when the optional home folder is missing", () => {
    expect(llm.refreshPathKeyedBlocks("common", path.join(root, "absent"))).toBe("common");
    expect(filesystem.readFileSync).not.toHaveBeenCalled();
  });

  it("reports directory access errors without discarding existing user blocks", () => {
    filesystem.readdirSync = () => {
      throw Object.assign(new Error("Fixture permission denied"), { code: "EACCES" });
    };
    llm.log = vi.fn();
    fs.writeFileSync(path.join(home, "rules.md"), "updated");
    const input = "<!-- BEGIN Mine | ~/rules.md -->\nold\n<!-- END Mine | ~/rules.md -->\n";
    expect(llm.refreshPathKeyedBlocks(input, home)).toBe("<!-- BEGIN Mine | ~/rules.md -->\nupdated\n<!-- END Mine | ~/rules.md -->\n");
    expect(llm.log).toHaveBeenCalledWith("ERROR: work instruction discovery failed:", "EACCES");
  });

  it("keeps existing blocks when their source symlink is broken", () => {
    fs.symlinkSync(path.join(home, "absent.md"), path.join(home, ".work_acme_instructions.md"));
    const input =
      "<!-- BEGIN Custom Work Prompt | ~/.work_acme_instructions.md -->\nkept\n<!-- END Custom Work Prompt | ~/.work_acme_instructions.md -->\n";
    expect(llm.refreshPathKeyedBlocks(input, home)).toBe(input);
    expect(filesystem.readFileSync).not.toHaveBeenCalled();
  });

  it("rejects a body containing its own block delimiter", () => {
    fs.writeFileSync(path.join(home, ".work_acme_instructions.md"), "<!-- END Custom Work Prompt | ~/.work_acme_instructions.md -->");
    expect(llm.refreshPathKeyedBlocks("common", home)).toBe("common");
  });
});

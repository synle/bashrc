/** Rejection and failure contracts for image_compress's destructive default. */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { imageFixture } from "./imageCompress.helpers.js";

/** Each case owns every filesystem path it can mutate. */
let fixture;
beforeEach(() => {
  fixture = imageFixture();
});
afterEach(() => fixture.clean());

describe("image_compress safety", () => {
  it.each([
    "--quality=-1",
    "--quality=101",
    "--quality=1.5",
    "--quality=wrong",
    "--quality=--eval=process.exit(0)",
    "--compression=-1",
    "--compression=10",
    "--compression=1.5",
    "--outputFormat=webp",
  ])("rejects %s before invoking the encoder or changing files", (option) => {
    const source = fixture.file("photo.png");
    const result = fixture.run([option, source, "out"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/quality|compression|outputFormat/);
    expect(fixture.calls()).toEqual([]);
    expect(fs.readFileSync(source, "utf8")).toBe("original image");
    expect(fs.existsSync(path.join(fixture.root, "out"))).toBe(false);
  });

  it.each([["--unknown"], ["--quality"], ["input", "out", "extra"], [""]])(
    "rejects malformed arguments %j without side effects",
    (...args) => {
      const result = fixture.run(args);
      expect(result.status).toBe(2);
      expect(result.stderr).toContain("image_compress:");
      expect(fixture.calls()).toEqual([]);
      expect(fs.readdirSync(fixture.root)).toEqual(["bin"]);
    },
  );

  it("prints help without requiring an encoder", () => {
    const result = fixture.run(["--help"], { PATH: "/usr/bin:/bin" });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("--outputFormat=preserve|jpg|png");
    expect(result.stdout).toContain("WARNING: purge=true");
    expect(fixture.calls()).toEqual([]);
  });

  it.each(["fail", "empty"])("retains the source and removes staging files when the encoder returns %s", (mode) => {
    const source = fixture.file("photo.png");
    const result = fixture.run([source, "out"], { ENCODER_MODE: mode });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/encoder failed|encoder produced no image/);
    expect(result.stdout).toBe("");
    expect(fs.readFileSync(source, "utf8")).toBe("original image");
    expect(fs.readdirSync(path.join(fixture.root, "out"))).toEqual([]);
  });

  it("retains a source changed during encoding and publishes nothing", () => {
    const source = fixture.file("photo.png");
    const result = fixture.run([source, "out"], { ENCODER_MODE: "change" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("source changed during encoding");
    expect(fs.readFileSync(source, "utf8")).toBe("changed during encoding");
    expect(fs.readdirSync(path.join(fixture.root, "out"))).toEqual([]);
  });

  it("rejects an existing destination before processing any image", () => {
    const source = fixture.file("photos/a.png");
    fixture.file("photos/b.png");
    const destination = fixture.file("out/b.png", "keep destination");
    const result = fixture.run(["photos", "out"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("destination already exists");
    expect(fixture.calls()).toEqual([]);
    expect(fs.readFileSync(source, "utf8")).toBe("original image");
    expect(fs.readFileSync(destination, "utf8")).toBe("keep destination");
    expect(fs.existsSync(path.join(fixture.root, "out/a.png"))).toBe(false);
  });

  it("does not overwrite a destination created during encoding or delete its source", () => {
    const source = fixture.file("photo.png");
    const destination = path.join(fixture.root, "out/photo.png");
    const result = fixture.run([source, "out"], { ENCODER_MODE: "collision", COLLISION_FILE: destination });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("EEXIST");
    expect(fs.readFileSync(source, "utf8")).toBe("original image");
    expect(fs.readFileSync(destination, "utf8")).toBe("concurrent destination");
    expect(fs.readdirSync(path.join(fixture.root, "out"))).toEqual(["photo.png"]);
  });

  it("preflights collisions between PNG and JPEG sources targeting one format", () => {
    const png = fixture.file("photos/a.png");
    const jpg = fixture.file("photos/a.jpg");
    const result = fixture.run(["--outputFormat=png", "photos", "out"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("multiple inputs target the same output");
    expect(fixture.calls()).toEqual([]);
    expect(fs.readFileSync(png, "utf8")).toBe("original image");
    expect(fs.readFileSync(jpg, "utf8")).toBe("original image");
    expect(fs.existsSync(path.join(fixture.root, "out"))).toBe(false);
  });

  it("refuses an explicit output folder that would replace the input file", () => {
    const source = fixture.file("photo.png");
    const result = fixture.run(["--purge=no", source, fixture.root]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("destination already exists");
    expect(fixture.calls()).toEqual([]);
    expect(fs.readFileSync(source, "utf8")).toBe("original image");
  });

  it("skips recursive symlinks and refuses a direct symlink input", () => {
    const source = fixture.file("photos/photo.png");
    const link = path.join(fixture.root, "photos/link.png");
    fs.symlinkSync(source, link);
    const result = fixture.run(["--purge=no", "photos", "out"]);
    expect(result.status, result.stderr).toBe(0);
    expect(fs.existsSync(path.join(fixture.root, "out/photo.png"))).toBe(true);
    expect(fs.existsSync(path.join(fixture.root, "out/link.png"))).toBe(false);
    const direct = fixture.run([link]);
    expect(direct.status).toBe(1);
    expect(direct.stderr).toContain("symbolic link refused");
    expect(fs.readFileSync(source, "utf8")).toBe("original image");
  });

  it("rejects a symlink output folder without changing its target", () => {
    const source = fixture.file("photo.png");
    fixture.file("outside/keep.txt", "keep");
    fs.symlinkSync(path.join(fixture.root, "outside"), path.join(fixture.root, "out"));
    const result = fixture.run([source, "out"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("symbolic link refused");
    expect(fixture.calls()).toEqual([]);
    expect(fs.readdirSync(path.join(fixture.root, "outside"))).toEqual(["keep.txt"]);
    expect(fs.readFileSync(source, "utf8")).toBe("original image");
  });

  it("resolves parent aliases while retaining the direct-source safety boundary", () => {
    const source = fixture.file("real/photo.png");
    fs.symlinkSync(path.join(fixture.root, "real"), path.join(fixture.root, "alias"));
    const result = fixture.run(["--purge=no", "alias/photo.png"]);
    expect(result.status, result.stderr).toBe(0);
    expect(fixture.calls()[0][1]).toBe(source);
    expect(fs.readFileSync(source, "utf8")).toBe("original image");
    expect(fs.existsSync(path.join(fixture.root, "real/photo.converted.png"))).toBe(true);
  });

  it("keeps successful batch outputs while retaining failed sources", () => {
    const good = fixture.file("photos/good.png");
    const bad = fixture.file("photos/bad.png");
    const result = fixture.run(["photos", "out"], { FAIL_NAME: "bad.png" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("encoder failed");
    expect(fs.existsSync(good)).toBe(false);
    expect(fs.readFileSync(bad, "utf8")).toBe("original image");
    expect(fs.existsSync(path.join(fixture.root, "out/good.png"))).toBe(true);
    expect(fs.readdirSync(path.join(fixture.root, "out"))).toEqual(["good.png"]);
  });

  it("refuses empty folders without creating an output folder", () => {
    fixture.file("photos/readme.txt");
    const result = fixture.run(["photos", "out"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("no JPG or PNG images found");
    expect(fixture.calls()).toEqual([]);
    expect(fs.existsSync(path.join(fixture.root, "out"))).toBe(false);
  });
});

/** Public command contracts for recursive image compression and format selection. */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { imageFixture } from "./imageCompress.helpers.js";

/** Each case owns its source files, command log, and destination files. */
let fixture;
beforeEach(() => {
  fixture = imageFixture();
});
afterEach(() => fixture.clean());

describe("image_compress", () => {
  it("replaces a JPEG by default with orientation and MozJPEG quality 82", () => {
    const source = fixture.file("photo.jpg");
    const result = fixture.run([source]);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("Compressed:");
    expect(fs.readFileSync(source).subarray(0, 3)).toEqual(Buffer.from([255, 216, 255]));
    const [args] = fixture.calls();
    expect(args.slice(4)).toEqual(["-f", "jpeg", "--quality", "82", "--autoOrient", "--mozjpeg", "flatten", "#ffffff"]);
  });

  it("defaults PNG to palette quality 85 and compression 9", () => {
    const source = fixture.file("icon.png");
    const result = fixture.run(["--purge=false", source]);
    expect(result.status, result.stderr).toBe(0);
    expect(fs.readFileSync(source, "utf8")).toBe("original image");
    expect(fs.readFileSync(path.join(fixture.root, "icon.converted.png")).subarray(0, 8)).toEqual(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    );
    const [args] = fixture.calls();
    expect(args.slice(4)).toEqual(["-f", "png", "--quality", "85", "--autoOrient", "--palette", "--compressionLevel", "9"]);
  });

  it("preserves nested paths in a supplied output folder and purges only images", () => {
    const source = fixture.file("photos/a/nested/photo.JPEG");
    fixture.file("photos/readme.txt", "keep me");
    const result = fixture.run(["photos", "results"]);
    expect(result.status, result.stderr).toBe(0);
    expect(fs.existsSync(source)).toBe(false);
    expect(fs.readFileSync(path.join(fixture.root, "results/a/nested/photo.JPEG")).subarray(0, 3)).toEqual(Buffer.from([255, 216, 255]));
    expect(fs.readFileSync(path.join(fixture.root, "photos/readme.txt"), "utf8")).toBe("keep me");
  });

  it("converts JPEG to PNG beside the original while retaining it", () => {
    const source = fixture.file("some image2.jpg");
    const result = fixture.run(["--outputFormat=png", "--purge=0", source]);
    expect(result.status, result.stderr).toBe(0);
    expect(fs.readFileSync(source, "utf8")).toBe("original image");
    expect(fs.readFileSync(path.join(fixture.root, "some image2.converted.png")).subarray(0, 8)).toEqual(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    );
    expect(fixture.calls()[0]).toContain("--palette");
  });

  it("converts PNG to JPEG with purge and changes the extension", () => {
    const source = fixture.file("image.png");
    const result = fixture.run(["--outputFormat=jpg", source]);
    expect(result.status, result.stderr).toBe(0);
    expect(fs.existsSync(source)).toBe(false);
    expect(fs.readFileSync(path.join(fixture.root, "image.jpg")).subarray(0, 3)).toEqual(Buffer.from([255, 216, 255]));
  });

  it("normalizes an uppercase extension when the requested format matches the source", () => {
    const source = fixture.file("PHOTO.PNG");
    const result = fixture.run(["--outputFormat=png", source]);
    expect(result.status, result.stderr).toBe(0);
    expect(fs.readFileSync(path.join(fixture.root, "PHOTO.png")).subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    // Case-insensitive filesystems may retain the existing directory-entry casing after replacement.
    expect(
      fs
        .readdirSync(fixture.root)
        .filter((name) => /\.png$/i.test(name))
        .map((name) => name.toLowerCase()),
    ).toEqual(["photo.png"]);
  });

  it("excludes a nested output folder and previous converted files from recursion", () => {
    fixture.file("photos/a.png");
    fixture.file("photos/.image-compress-stale/output.png");
    const previous = fixture.file("photos/a.converted.png", "previous output");
    const oldOutput = fixture.file("photos/out/old.jpg", "old output");
    const result = fixture.run(["--purge=no", "photos", "photos/out"]);
    expect(result.status, result.stderr).toBe(0);
    expect(fixture.calls()).toHaveLength(1);
    expect(fs.existsSync(path.join(fixture.root, "photos/out/a.png"))).toBe(true);
    expect(fs.readFileSync(previous, "utf8")).toBe("previous output");
    expect(fs.readFileSync(oldOutput, "utf8")).toBe("old output");
  });

  it("keeps nested structure beside sources when no output folder is supplied", () => {
    const source = fixture.file("photos/a/b/photo.jpg");
    const result = fixture.run(["--purge=no", "photos"]);
    expect(result.status, result.stderr).toBe(0);
    expect(fs.readFileSync(source, "utf8")).toBe("original image");
    expect(fs.existsSync(path.join(fixture.root, "photos/a/b/photo.converted.jpg"))).toBe(true);
  });

  it("passes filenames containing shell metacharacters, newlines, and Unicode literally", () => {
    const source = fixture.file("-x '$(touch injected)'\n\u00e9.png");
    const result = fixture.run(["--purge=0", "--", source]);
    expect(result.status, result.stderr).toBe(0);
    expect(fixture.calls()[0][1]).toBe(source);
    expect(fs.existsSync(path.join(fixture.root, "injected"))).toBe(false);
    expect(fs.readFileSync(source, "utf8")).toBe("original image");
  });
});

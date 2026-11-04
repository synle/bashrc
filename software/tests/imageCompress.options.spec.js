/** Boolean normalization and encoder-option contracts for image_compress. */
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

describe("image_compress options", () => {
  it.each(["y", "1", "true", "YES", "TrUe"])("normalizes both booleans through is_truthy for %s", (value) => {
    const source = fixture.file("input.png");
    const result = fixture.run([`--purge=${value}`, `--autoOrient=${value}`, source, "out"]);
    expect(result.status, result.stderr).toBe(0);
    expect(fs.existsSync(source)).toBe(false);
    expect(fs.existsSync(path.join(fixture.root, "out/input.png"))).toBe(true);
    expect(fixture.calls()[0]).toContain("--autoOrient");
  });

  it.each(["false", "0", "n", "no"])("disables both booleans through is_truthy for %s", (value) => {
    const source = fixture.file("input.jpg");
    const result = fixture.run([`--purge=${value}`, `--autoOrient=${value}`, source, "out"]);
    expect(result.status, result.stderr).toBe(0);
    expect(fs.readFileSync(source, "utf8")).toBe("original image");
    expect(fs.existsSync(path.join(fixture.root, "out/input.jpg"))).toBe(true);
    expect(fixture.calls()[0]).not.toContain("--autoOrient");
  });

  it("accepts separate option values and minimum quality/compression", () => {
    fixture.file("input.png");
    const result = fixture.run([
      "--quality",
      "0",
      "--compression",
      "0",
      "--purge",
      "no",
      "--autoOrient",
      "0",
      "--outputFormat",
      "preserve",
      "input.png",
    ]);
    expect(result.status, result.stderr).toBe(0);
    expect(fixture.calls()[0].slice(4)).toEqual(["-f", "png", "--quality", "1", "--palette", "--compressionLevel", "0"]);
  });

  it("accepts maximum quality without sending PNG compression to JPEG", () => {
    fixture.file("photo.jpg");
    const result = fixture.run(["--quality=100", "--compression=9", "photo.jpg"]);
    expect(result.status, result.stderr).toBe(0);
    expect(fixture.calls()[0].slice(4)).toEqual(["-f", "jpeg", "--quality", "100", "--autoOrient", "--mozjpeg", "flatten", "#ffffff"]);
  });
});

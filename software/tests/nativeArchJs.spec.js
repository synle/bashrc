/**
 * Tests for the JS CPU-arch helpers in software/index.js: resolveNativeArch,
 * getNativeArch, and isMachOArchMismatch.
 *
 * Why they exist: downloadAndInstallBinary picks a release asset by arch
 * (`Display.DJ_<ver>_aarch64.dmg` vs `Display.DJ_<ver>_x64.dmg`). It used to read
 * `os.arch()`, which reports x64 for ANY process translated by Rosetta 2 — so an
 * Apple Silicon Mac reached through a translated node silently installed the Intel
 * build of display-dj / sqlui-native / skiff-files / proxie, and the version check
 * then reported "already installed" forever.
 *
 * These are the JS mirrors of the bash helpers covered by nativeArch.spec.js
 * (get_native_arch, binary_arch_mismatch). Both halves must agree, so the decision
 * tables below intentionally match that suite's cases.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { getIndexFunction, mockExecCommands, setMockExecSyncReturn } from "./setup.js";

const resolveNativeArch = getIndexFunction("resolveNativeArch");
const getNativeArch = getIndexFunction("getNativeArch");
const isMachOArchMismatch = getIndexFunction("isMachOArchMismatch");

describe("resolveNativeArch on macOS", () => {
  it("reports arm64 on Apple Silicon even when node is translated and reports x64", () => {
    // The exact bug: Rosetta 2 node → process.arch "x64" → Display.DJ_7.0.34_x64.dmg.
    expect(resolveNativeArch({ isMac: true, processArch: "x64", armHardware: "1", translated: "1", cpuBrand: "Apple M3 Pro" })).toBe(
      "arm64",
    );
  });

  it("reports arm64 on a native arm64 node", () => {
    expect(resolveNativeArch({ isMac: true, processArch: "arm64", armHardware: "1", translated: "0", cpuBrand: "Apple M3 Pro" })).toBe(
      "arm64",
    );
  });

  it("reports x86_64 on a real Intel Mac", () => {
    // Intel Macs have no hw.optional.arm64 oid at all, so the probe comes back empty
    // and the CPU brand string is the tiebreaker.
    expect(
      resolveNativeArch({
        isMac: true,
        processArch: "x64",
        armHardware: "",
        translated: "",
        cpuBrand: "Intel(R) Core(TM) i9-9880H CPU @ 2.30GHz",
      }),
    ).toBe("x86_64");
  });

  it("honors an explicit hw.optional.arm64=0 as proof of Intel hardware", () => {
    expect(resolveNativeArch({ isMac: true, processArch: "x64", armHardware: "0", translated: "", cpuBrand: "" })).toBe("x86_64");
  });

  it("trusts an arm64 node when sysctl is unreadable — an arm64 binary cannot run on Intel", () => {
    expect(resolveNativeArch({ isMac: true, processArch: "arm64", armHardware: "", translated: "", cpuBrand: "" })).toBe("arm64");
  });

  it("infers arm64 from Rosetta 2 alone — the translation layer only exists on Apple Silicon", () => {
    expect(resolveNativeArch({ isMac: true, processArch: "x64", armHardware: "", translated: "1", cpuBrand: "" })).toBe("arm64");
  });

  it("defaults to arm64 on Mac when every probe is unreadable", () => {
    // Requested behavior: when unsure on a Mac, assume Apple Silicon. An arm64 asset on a
    // rare Intel holdout fails loudly; the reverse silently installs a translated app.
    expect(resolveNativeArch({ isMac: true, processArch: "", armHardware: "", translated: "", cpuBrand: "" })).toBe("arm64");
    expect(resolveNativeArch({ isMac: true, processArch: undefined, armHardware: "", translated: "", cpuBrand: undefined })).toBe("arm64");
  });

  it("does not mistake an Apple CPU brand for Intel", () => {
    expect(resolveNativeArch({ isMac: true, processArch: "x64", armHardware: "", translated: "", cpuBrand: "Apple M1 Max" })).toBe("arm64");
  });
});

describe("resolveNativeArch off macOS", () => {
  it("maps node arch spellings onto uname spellings", () => {
    expect(resolveNativeArch({ isMac: false, processArch: "x64" })).toBe("x86_64");
    expect(resolveNativeArch({ isMac: false, processArch: "arm64" })).toBe("arm64");
    expect(resolveNativeArch({ isMac: false, processArch: "ia32" })).toBe("i386");
  });

  it("passes unknown arches through unchanged", () => {
    expect(resolveNativeArch({ isMac: false, processArch: "ppc64" })).toBe("ppc64");
  });

  it("ignores the mac-only sysctl probes — there is no translation layer to lie", () => {
    expect(resolveNativeArch({ isMac: false, processArch: "x64", armHardware: "1", translated: "1" })).toBe("x86_64");
  });
});

describe("getNativeArch", () => {
  beforeEach(() => {
    setMockExecSyncReturn("");
    mockExecCommands.length = 0;
  });

  it("never shells out to sysctl off macOS", () => {
    // is_os_mac is false in the sandbox, so this covers the non-Mac branch: the three
    // sysctl probes are Mac-only and must not cost a subprocess on Linux/Windows.
    getNativeArch();
    expect(mockExecCommands.filter((c) => c.includes("sysctl")).length).toBe(0);
  });

  it("memoizes — CPU arch cannot change mid-run", () => {
    expect(getNativeArch()).toBe(getNativeArch());
  });
});

describe("isMachOArchMismatch", () => {
  it("flags an Intel-only bundle executable on Apple Silicon", () => {
    // Real `file -L` output from /Applications/Display DJ.app installed from the x64 dmg.
    expect(isMachOArchMismatch("Mach-O 64-bit executable x86_64", "arm64")).toBe(true);
  });

  it("accepts a native arm64 bundle executable", () => {
    expect(isMachOArchMismatch("Mach-O 64-bit executable arm64", "arm64")).toBe(false);
  });

  it("accepts a universal binary — it carries a slice for every arch it lists", () => {
    const universal =
      "Mach-O universal binary with 2 architectures: [x86_64:Mach-O 64-bit executable x86_64] [arm64:Mach-O 64-bit executable arm64]";
    expect(isMachOArchMismatch(universal, "arm64")).toBe(false);
    expect(isMachOArchMismatch(universal, "x86_64")).toBe(false);
  });

  it("flags an arm64-only bundle on an Intel Mac", () => {
    expect(isMachOArchMismatch("Mach-O 64-bit executable arm64", "x86_64")).toBe(true);
  });

  it("ignores anything that is not Mach-O — launcher scripts and ELF are arch-independent here", () => {
    expect(isMachOArchMismatch("Bourne-Again shell script text executable, ASCII text", "arm64")).toBe(false);
    expect(isMachOArchMismatch("ELF 64-bit LSB pie executable, x86-64", "arm64")).toBe(false);
  });

  it("reports no mismatch when the description or arch is missing", () => {
    // An unreadable bundle is not evidence of a mismatch — guessing "mismatch" would
    // re-download a few hundred MB on every single run.
    expect(isMachOArchMismatch("", "arm64")).toBe(false);
    expect(isMachOArchMismatch("Mach-O 64-bit executable x86_64", "")).toBe(false);
  });
});

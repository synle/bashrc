/** Real browser fingerprints for the Setup Windows command and every direct body child. */
import { describe, expect, it } from "vitest";
import { commandBrowser, selectCommand } from "./commands.helpers.js";

/** A dedicated browser session prevents command state leaking across spec files. */
const browser = commandBrowser();

describe("command snapshots", () => {
  it("Setup Windows keeps its current block titles, content, links, and count", async () => {
    const { blocks, errors } = await selectCommand(browser.page, "command-option-setup-windows");
    expect(blocks).toHaveLength(21);
    // Existing published Windows Terminal artifact is missing; keep its error state explicit, not disguised as valid code.
    expect(errors).toMatchInlineSnapshot(`
      [
        "Content Error: 404: Not Found",
      ]
    `);
    expect(blocks).toMatchInlineSnapshot(`
      [
        {
          "hash": "151fc230a57ac85c9e1e79ec28df3f30",
          "title": "This is meant for Windows. Your system is detected as a different OS.",
        },
        {
          "hash": "8a9089acc4c542727e43734581c5ad35",
          "title": "software/bootstrap/setup.sh",
        },
        {
          "hash": "6a4c4c2a1f6710367558f14ed1d018c0",
          "title": "docs/windows/README.md",
        },
        {
          "hash": "2fd2be0f877a65cd70ca7d2fd43f625a",
          "title": "software/scripts/windows/_full-setup-bootstrap.ps1.bash",
        },
        {
          "hash": "43e7e60809fa0a4d5c0ecd091009d49b",
          "title": "software/scripts/windows/_full-setup.ps1.bash",
        },
        {
          "hash": "49eb01626020a5e57936610df8b31abc",
          "title": "assets/fonts/install.sh",
        },
        {
          "hash": "8c7a6a3d3a41149d7619793d0d15bbb1",
          "title": ".build/windows-terminal",
        },
        {
          "hash": "94d83862edede417a2c58712e6f75a49",
          "title": "docs/android/sponsorblock.json",
        },
        {
          "hash": "aa0f1cfb6f25c3cb9ae491f96c2d01cf",
          "title": "docs/game-streaming-moonlight-steamlink.md",
        },
        {
          "hash": "ebcc7cb095f96a8457a749384ddfad8b",
          "title": ".build/sublime-text-setup",
        },
        {
          "hash": "142be3e09289b0f368d5133c2b49d890",
          "title": ".build/sublime-text-ext",
        },
        {
          "hash": "0a5c3719c39164cda5ca245c06e45aa3",
          "title": "WINDOWS RELATED",
        },
        {
          "links": [
            {
              "hash": "https://wslstorestorage.blob.core.windows.net/wslblob/wsl_update_x64.msi",
              "title": "WSL KERNEL",
            },
            {
              "hash": "https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist?view=msvc-170",
              "title": "MICROSOFT VISUAL C++ REDISTRIBUTABLE",
            },
            {
              "hash": "https://dotnet.microsoft.com/en-us/download/dotnet/thank-you/runtime-desktop-7.0.14-windows-x64-installer?cid=getdotnetcore",
              "title": "MICROSOFT .NET 7.0 DESKTOP RUNTIME (V7.0.14)",
            },
          ],
          "title": "link-group",
        },
        {
          "hash": "1876fa61a4bda94a76a33980cbf073d2",
          "title": "SFTP MOUNT APPLICATIONS",
        },
        {
          "hash": "a2ba810bdf99ae9aa0bada8c5dbda38f",
          "title": "Using username and password",
        },
        {
          "hash": "0539e7fc4b59f8e5c0bffd9d7c96fd1e",
          "title": "Using id_rsa keys",
        },
        {
          "links": [
            {
              "hash": "https://github.com/winfsp/winfsp/releases/latest",
              "title": "WINFSP",
            },
            {
              "hash": "https://github.com/winfsp/sshfs-win/releases/latest",
              "title": "SSHFS",
            },
          ],
          "title": "link-group",
        },
        {
          "hash": "5964e9e48678142d89473bcca6479794",
          "title": "OTHER APPLICATIONS",
        },
        {
          "links": [
            {
              "hash": "https://raw.githubusercontent.com/synle/bashrc/HEAD/.build/Applications.zip",
              "title": "PREBUILT WINDOWS APPLICATIONS",
            },
            {
              "hash": "https://ninite.com/",
              "title": "NINITE",
            },
            {
              "hash": "https://github.com/synle/bashrc/blob/main/fonts",
              "title": "CUSTOM FONTS",
            },
            {
              "hash": "font-preview.html",
              "title": "FONT PREVIEW",
            },
            {
              "hash": "https://www.sublimetext.com/download",
              "title": "SUBLIME TEXT",
            },
            {
              "hash": "https://www.sublimemerge.com/download",
              "title": "SUBLIME MERGE",
            },
            {
              "hash": "https://www.charlesproxy.com/download/latest-release/",
              "title": "CHARLES PROXY",
            },
            {
              "hash": "https://ultimaker.com/software/ultimaker-cura/#links",
              "title": "ULTIMAKER CURA",
            },
            {
              "hash": "https://design.cricut.com/#/",
              "title": "CRICUT DESIGN SPACE",
            },
            {
              "hash": "https://download.battle.net/en-us/?product=bnetdesk",
              "title": "BATTLE NET",
            },
          ],
          "title": "link-group",
        },
        {
          "hash": "161ad92de902d4ca8e8d835c07fed8c7",
          "title": "EXTENSIONS",
        },
        {
          "links": [
            {
              "hash": "https://apps.microsoft.com/detail/9P9TQF7MRM4R",
              "title": "WINDOWS SUBSYSTEM FOR LINUX (WINDOWS 11)",
            },
            {
              "hash": "https://developer.nvidia.com/cuda-downloads?target_os=Linux&target_arch=x86_64&Distribution=WSL-Ubuntu&target_version=2.0&target_type=runfile_local",
              "title": "CUDA TOOLKIT DRIVER FOR WSL",
            },
            {
              "hash": "https://apps.microsoft.com/store/detail/raw-image-extension/9nctdw2w1bh8",
              "title": "RAW IMAGE EXTENSION",
            },
            {
              "hash": "https://apps.microsoft.com/store/detail/heif-image-extensions/9pmmsr1cgpwg",
              "title": "HEIF IMAGE EXTENSION",
            },
            {
              "hash": "https://apps.microsoft.com/store/detail/hevc-video-extensions-from-device-manufacturer/9n4wgh0z6vhq",
              "title": "HEVC VIDEO EXTENSION (DEVICE MANAGER)",
            },
            {
              "hash": "https://apps.microsoft.com/store/detail/mpeg2-video-extension/9n95q1zzpmh4",
              "title": "MPEG-2 VIDEO EXTENSION",
            },
            {
              "hash": "https://apps.microsoft.com/store/detail/av1-video-extension/9mvzqvxjbq9v",
              "title": "AV1 VIDEO EXTENSION",
            },
          ],
          "title": "link-group",
        },
      ]
    `);
  }, 90000);
});

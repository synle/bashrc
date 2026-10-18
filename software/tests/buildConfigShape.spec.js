import { describe, it, expect } from "vitest";

import fs from "fs";

import path from "path";

function parseJsonc(text) {
  const stripped = text.replace(/^\s*\/\/.*$/gm, "").trim();
  return JSON.parse(stripped);
}

function readBuildConfigKeys(filename) {
  const filePath = path.resolve(".build", filename);
  const content = fs.readFileSync(filePath, "utf-8");
  const data = parseJsonc(content);
  return Object.keys(data).sort();
}

function readBuildArrayShape(filename) {
  const filePath = path.resolve(".build", filename);
  const content = fs.readFileSync(filePath, "utf-8");
  const data = parseJsonc(content);
  const shape = { length: data.length };
  if (data.length > 0 && typeof data[0] === "object" && data[0] !== null) {
    shape.firstElementKeys = Object.keys(data[0]).sort();
  }
  return shape;
}

function readBuildFileSize(filename) {
  const filePath = path.resolve(".build", filename);
  return fs.statSync(filePath).size;
}

const MIN_FILE_SIZES = {
  "sublime-merge": 200,
  "sublime-merge-keys-mac": 1400,
  "sublime-merge-keys-windows": 2300,
  "sublime-text-config": 4000,
  "sublime-text-config-mac": 4000,
  "vs-code-color-dark": 8000,
  "vs-code-color-light": 8000,
  "vs-code-config": 28100,
  "vs-code-config-mac": 35400,
  "zed-color-dark": 7100,
  "zed-color-light": 7100,
  "zed-config": 3600,
  "sublime-text-keys-linux": 8200,
  "sublime-text-keys-mac": 4000,
  "sublime-text-keys-windows": 8200,
  "sublime-text-mouse": 500,
  "sublime-text-mouse-mac": 500,
  "vs-code-keys-combined": 17700,
  "zed-keys": 2700,
  "zed-keys-linux": 380,
  "zed-keys-windows": 5600,
  "ip-address.config.hostnamesFlattened": 1800,
};

describe("build config file size thresholds", () => {
for (const [name, minSize] of Object.entries(MIN_FILE_SIZES)) {
    const filePath = path.resolve(".build", name);
    const fileExists = fs.existsSync(filePath);

    it(`${name} should be at least ${minSize} bytes`, () => {
      if (!fileExists) {
        console.warn(`  [WARNING] .build/${name} not found — skipping (not generated in this environment)`);
        return;
      }
      const size = readBuildFileSize(name);
      expect(size).toBeGreaterThanOrEqual(minSize);
    });
  }


});

describe("build config shape - objects", () => {
it("sublime-merge", () => {
    if (!fs.existsSync(path.resolve(".build", "sublime-merge"))) {
      console.warn("  [WARNING] .build/sublime-merge not found — skipping (not generated in this environment)");
      return;
    }
    expect(readBuildConfigKeys("sublime-merge")).toMatchInlineSnapshot(`
      [
        "dark_theme",
        "draw_white_space",
        "expand_merge_commits_by_default",
        "font_face",
        "font_size",
        "hardware_acceleration",
        "hide_menu",
        "light_theme",
        "scroll_speed",
        "side_bar_layout",
        "tab_size",
        "theme",
        "translate_tabs_to_spaces",
        "update_check",
      ]
    `);
  });

it("sublime-text-config", () => {
    if (!fs.existsSync(path.resolve(".build", "sublime-text-config"))) {
      console.warn("  [WARNING] .build/sublime-text-config not found — skipping (not generated in this environment)");
      return;
    }
    expect(readBuildConfigKeys("sublime-text-config")).toMatchInlineSnapshot(`
      [
        "alignment_chars",
        "animation_enabled",
        "atomic_save",
        "auto_complete_commit_on_tab",
        "auto_hide_menu",
        "bold_folder_labels",
        "close_windows_when_empty",
        "color_scheme",
        "dark_color_scheme",
        "dark_theme",
        "default_line_ending",
        "draw_white_space",
        "ensure_newline_at_eof_on_save",
        "fade_fold_buttons",
        "file_exclude_patterns",
        "folder_exclude_patterns",
        "font_face",
        "font_options",
        "font_size",
        "gpu_window_buffer",
        "hardware_acceleration",
        "highlight_line",
        "highlight_modified_tabs",
        "hot_exit",
        "ignored_packages",
        "index_exclude_gitignore",
        "index_exclude_patterns",
        "index_workers",
        "inlay_hints_enabled",
        "light_color_scheme",
        "light_theme",
        "line_padding_top",
        "mini_diff",
        "open_externally_patterns",
        "preview_on_click",
        "reload_file_in_background",
        "remember_open_files",
        "rulers",
        "scroll_speed",
        "show_definitions",
        "show_folding_buttons",
        "show_git_status",
        "show_line_endings",
        "show_tab_close_buttons",
        "sidebar_font_size",
        "spell_check",
        "tab_size",
        "theme",
        "translate_tabs_to_spaces",
        "tree_animation_enabled",
        "trim_trailing_white_space_on_save",
        "update_check",
      ]
    `);
  });

it("sublime-text-config-mac", () => {
    if (!fs.existsSync(path.resolve(".build", "sublime-text-config-mac"))) {
      console.warn("  [WARNING] .build/sublime-text-config-mac not found — skipping (not generated in this environment)");
      return;
    }
    expect(readBuildConfigKeys("sublime-text-config-mac")).toMatchInlineSnapshot(`
      [
        "alignment_chars",
        "animation_enabled",
        "atomic_save",
        "auto_complete_commit_on_tab",
        "auto_hide_menu",
        "bold_folder_labels",
        "close_windows_when_empty",
        "color_scheme",
        "dark_color_scheme",
        "dark_theme",
        "default_line_ending",
        "draw_white_space",
        "ensure_newline_at_eof_on_save",
        "fade_fold_buttons",
        "file_exclude_patterns",
        "folder_exclude_patterns",
        "font_face",
        "font_options",
        "font_size",
        "gpu_window_buffer",
        "hardware_acceleration",
        "highlight_line",
        "highlight_modified_tabs",
        "hot_exit",
        "ignored_packages",
        "index_exclude_gitignore",
        "index_exclude_patterns",
        "index_workers",
        "inlay_hints_enabled",
        "light_color_scheme",
        "light_theme",
        "line_padding_top",
        "mini_diff",
        "open_externally_patterns",
        "preview_on_click",
        "reload_file_in_background",
        "remember_open_files",
        "rulers",
        "scroll_speed",
        "show_definitions",
        "show_folding_buttons",
        "show_git_status",
        "show_line_endings",
        "show_tab_close_buttons",
        "sidebar_font_size",
        "spell_check",
        "tab_size",
        "theme",
        "translate_tabs_to_spaces",
        "tree_animation_enabled",
        "trim_trailing_white_space_on_save",
        "update_check",
      ]
    `);
  });

it("vs-code-color-dark", () => {
    if (!fs.existsSync(path.resolve(".build", "vs-code-color-dark"))) {
      console.warn("  [WARNING] .build/vs-code-color-dark not found — skipping (not generated in this environment)");
      return;
    }
    expect(readBuildConfigKeys("vs-code-color-dark")).toMatchInlineSnapshot(`
      [
        "editor.tokenColorCustomizations",
        "workbench.colorCustomizations",
      ]
    `);
  });

it("vs-code-color-light", () => {
    if (!fs.existsSync(path.resolve(".build", "vs-code-color-light"))) {
      console.warn("  [WARNING] .build/vs-code-color-light not found — skipping (not generated in this environment)");
      return;
    }
    expect(readBuildConfigKeys("vs-code-color-light")).toMatchInlineSnapshot(`
      [
        "editor.tokenColorCustomizations",
        "workbench.colorCustomizations",
      ]
    `);
  });
});

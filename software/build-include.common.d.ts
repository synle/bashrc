/** Get comment style for a target file */
declare function getCommentStyle(targetFile: any): any;
/** Strip shebang line from shell scripts */
declare function stripShebang(content: any): any;
/** Check if a key looks like a file path */
declare function isFilePath(key: any): any;
/**
 * Auto-transform source content based on the source file extension
 * and what makes sense in the target context.
 */
declare function autoTransform(sourceContent: any, sourceFile: any, targetFile: any): any;
/**
 * Scan a file for all BEGIN markers and return { key, commentPrefix, commentSuffix } for each.
 */
declare function findMarkers(content: any, targetFile: any): {
    key: string;
    commentPrefix: any;
    commentSuffix: any;
}[];
/**
 * Remove content between BEGIN/END markers, leaving the markers with empty content.
 */
declare function cleanBlock(content: any, key: any, commentPrefix: any, commentSuffix: any): string;
/**
 * Replace content between BEGIN/END markers.
 * If markers are not found, behavior depends on insertMode:
 * 'append' adds to end, 'prepend' adds to beginning, null/undefined returns null.
 * @param {string} content - The full text content
 * @param {string} key - The marker key
 * @param {string} sourceContent - The new content for the block
 * @param {string} commentPrefix - Comment prefix (e.g. '#', '//')
 * @param {string} [commentSuffix=''] - Comment suffix (e.g. ' -->', '')
 * @param {'append'|'prepend'|null} [insertMode] - Where to insert if block not found. null/undefined returns null.
 * @returns {string|null} The modified content, or null if markers not found and no insertMode
 */
declare function replaceBlock(content: string, key: string, sourceContent: string, commentPrefix: string, commentSuffix?: string, insertMode?: "append" | "prepend" | null): string | null;
/**
 * Get the raw content between BEGIN/END markers without modifying it.
 * Returns null if markers are not found.
 * @param {string} content - The full text content
 * @param {string} key - The marker key
 * @param {string} commentPrefix - Comment prefix (e.g. '#', '//')
 * @param {string} commentSuffix - Comment suffix (e.g. ' -->', '')
 * @returns {string|null} The content between the markers, or null if markers not found
 */
declare function getRawBlockContent(content: string, key: string, commentPrefix: string, commentSuffix: string): string | null;
/** Convert a hex color (#RRGGBB) to float RGB components (0-1 range) for iTerm plist format */
declare function _hexToFloatRgb(hex: any): {
    R: number;
    G: number;
    B: number;
};
/** Generate _R, _G, _B float entries for all hex colors in a theme object */
declare function _generateFloatColors(theme: any): {};
/** Serialize a JS value to its literal form, preserving original quote style */
declare function toJsonLiteral(value: any, quoteChar: any): string;
/**
 * Process inline markers in JSONC content, replacing values from the provided map.
 * Returns { content, changed } where changed indicates if any values were updated.
 */
declare function processInlineMarkers(content: any, colorMap: any, targetName: any): {
    content: any;
    changed: boolean;
    warnings: any[];
};
/**
 * Clean inline markers in content, replacing values with type-appropriate defaults.
 * Strings become "", booleans become false, numbers become 0, null stays null.
 * Returns { content, changed } where changed indicates if any values were updated.
 */
declare function cleanInlineMarkers(content: any): {
    content: any;
    changed: boolean;
};
/**
 * build-include.common.cjs - Shared pure functions for BEGIN/END block management.
 * Used by build-include.cjs at build time and index.js at runtime.
 * Exports TEXT_BLOCK_START_MARKER/TEXT_BLOCK_END_MARKER constants and block
 * manipulation functions (replaceBlock, getRawBlockContent, cleanBlock, findMarkers).
 */
/** @type {typeof import("path")} */
declare const path: typeof import("path");
/** @type {string} Opening delimiter for managed text blocks */
declare const TEXT_BLOCK_START_MARKER: string;
/** @type {string} Closing delimiter for managed text blocks */
declare const TEXT_BLOCK_END_MARKER: string;
/** Comment style per file extension */
declare const COMMENT_STYLES: {
    ".md": {
        prefix: string;
        suffix: string;
    };
    ".html": {
        prefix: string;
        suffix: string;
    };
    ".xml": {
        prefix: string;
        suffix: string;
    };
    ".js": {
        prefix: string;
        suffix: string;
    };
    ".jsx": {
        prefix: string;
        suffix: string;
    };
    ".ts": {
        prefix: string;
        suffix: string;
    };
    ".tsx": {
        prefix: string;
        suffix: string;
    };
    ".cjs": {
        prefix: string;
        suffix: string;
    };
    ".mjs": {
        prefix: string;
        suffix: string;
    };
    ".jsonc": {
        prefix: string;
        suffix: string;
    };
};
declare namespace DEFAULT_COMMENT_STYLE {
    let prefix: string;
    let suffix: string;
}
/** Map source file extensions to markdown code fence languages */
declare const CODE_FENCE_LANGUAGES: {
    ".sh": string;
    ".bash": string;
    ".zsh": string;
    ".ps1": string;
};
declare namespace _darkHex {
    let themeName: string;
    let background: string;
    let foreground: string;
    let cursorColor: string;
    let selection: string;
    let black: string;
    let blue: string;
    let brightBlack: string;
    let brightBlue: string;
    let brightCyan: string;
    let brightGreen: string;
    let brightPurple: string;
    let brightRed: string;
    let brightWhite: string;
    let brightYellow: string;
    let cyan: string;
    let green: string;
    let purple: string;
    let red: string;
    let white: string;
    let yellow: string;
    let lightBlue: string;
    let lightGreen: string;
    let orange: string;
    let gold: string;
    let darkRed: string;
}
declare namespace _lightHex {
    let themeName_1: string;
    export { themeName_1 as themeName };
    let background_1: string;
    export { background_1 as background };
    let foreground_1: string;
    export { foreground_1 as foreground };
    let cursorColor_1: string;
    export { cursorColor_1 as cursorColor };
    let selection_1: string;
    export { selection_1 as selection };
    let black_1: string;
    export { black_1 as black };
    let blue_1: string;
    export { blue_1 as blue };
    let brightBlack_1: string;
    export { brightBlack_1 as brightBlack };
    let brightBlue_1: string;
    export { brightBlue_1 as brightBlue };
    let brightCyan_1: string;
    export { brightCyan_1 as brightCyan };
    let brightGreen_1: string;
    export { brightGreen_1 as brightGreen };
    let brightPurple_1: string;
    export { brightPurple_1 as brightPurple };
    let brightRed_1: string;
    export { brightRed_1 as brightRed };
    let brightWhite_1: string;
    export { brightWhite_1 as brightWhite };
    let brightYellow_1: string;
    export { brightYellow_1 as brightYellow };
    let cyan_1: string;
    export { cyan_1 as cyan };
    let green_1: string;
    export { green_1 as green };
    let purple_1: string;
    export { purple_1 as purple };
    let red_1: string;
    export { red_1 as red };
    let white_1: string;
    export { white_1 as white };
    let yellow_1: string;
    export { yellow_1 as yellow };
    export let darkBlue: string;
    export let linkBlue: string;
    export let darkGreen: string;
    export let brown: string;
    let darkRed_1: string;
    export { darkRed_1 as darkRed };
}
declare namespace COLOR_MAP {
    namespace dark { }
    namespace light { }
}
/** Regex matching a JSON/JS value (quoted string | boolean | null | number) followed by // {{map.key}} */
declare const INLINE_MARKER_REGEX: RegExp;

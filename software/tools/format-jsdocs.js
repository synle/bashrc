/** Build JSDocs type declarations for index.js and common.js. */
const fs = require("fs");
const { execSync } = require("child_process");

const TSC_OPTS = "--declaration --allowJs --emitDeclarationOnly --lib esnext --skipLibCheck --target esnext";

/**
 * Process a source file: strip require() calls, run tsc, copy .d.ts output.
 * @param {object} opts
 * @param {string} opts.src - Source file path.
 * @param {string} opts.tmpName - Temp file basename (without path).
 * @param {string} opts.outDts - Output .d.ts destination path.
 * @param {function} opts.transform - Transform function for source content.
 */
function generateDts({ src, tmpName, outDts, transform }) {
  const tmpFile = `/tmp/${tmpName}`;
  const tmpDir = "/tmp/_dts-out";
  let content = fs.readFileSync(src, "utf8");
  content = transform(content);
  fs.writeFileSync(tmpFile, content);
  execSync(`npx tsc ${tmpFile} ${TSC_OPTS} --outDir ${tmpDir}`, { stdio: "inherit" });
  fs.cpSync(`${tmpDir}/${tmpName.replace(".js", ".d.ts")}`, outDts);
  fs.rmSync(tmpFile, { force: true });
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

// index.js
generateDts({
  src: "software/index.js",
  tmpName: "_index-for-tsc.js",
  outDts: "software/types/index.d.ts",
  transform: (src) => {
    src = src.replace(
      /^const (\w+) = require\("(?:node:)?(\w+)"\);$/gm,
      (_, n, m) => `/** @type {typeof import("${m}")} */\nconst ${n} = /** @type {any} */ (null);`,
    );
    src = src.replace(/^const (\w+) = require\("[^"]+"\)\.\w+\(\);?$/gm, (_, n) => `const ${n} = "";`);
    src = src.replace(/require\("[^"]+"\)/g, "({})");
    return src;
  },
});

// common.js
generateDts({
  src: "software/common.js",
  tmpName: "_common-for-tsc.js",
  outDts: "software/types/common.d.ts",
  transform: (src) => {
    src = src.replace(
      /^const (\w+) = require\("(?:node:)?(\w+)"\);$/gm,
      (_, n, m) => `/** @type {typeof import("${m}")} */\nconst ${n} = /** @type {any} */ (null);`,
    );
    src = src.replace(/^module\.exports\s*=\s*\{[\s\S]*\};?\s*$/m, "");
    src = src.replace(/^if\s*\(typeof module\b[\s\S]*$/m, "");
    return src;
  },
});

/**
 * build-include.cjs - Generic BEGIN/END block substitution engine.
 *
 * Supports two modes:
 *
 * 1. Auto mode (file path markers) - no config needed:
 *    When the marker key looks like a file path (contains "/" or ends with a known extension),
 *    the content is read from that path automatically.
 *      # BEGIN path/to/file.sh
 *      # END path/to/file.sh
 *
 *    For markdown files, use HTML comments:
 *      <!-- BEGIN path/to/file.sh -->
 *      <!-- END path/to/file.sh -->
 *
 * 2. Config mode (INCLUSIONS array):
 *    For non-file-path keys or when transforms are needed.
 *
 * Comment prefix is auto-detected from the target file extension:
 *   .md   -> "<!--" (with " -->" suffix on END marker)
 *   .html -> "<!--" (with " -->" suffix on END marker)
 *   *     -> "#"
 *
 * Scans all git-tracked *.sh and *.md files for BEGIN/END markers automatically.
 * Optionally pass specific files as CLI args to process only those.
 *
 * Usage:
 *   node software/build-include.cjs                     # auto-scan tracked *.sh and *.md files
 *   node software/build-include.cjs build.sh run.sh     # process specific files only
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Explicit inclusions for keys that aren't file paths or need transforms.
 * Each entry: { targets, key, source, transform?, commentPrefix?, commentSuffix? }
 */
const INCLUSIONS = [
  // Example:
  // {
  //   targets: ['README.md'],
  //   key: 'some-key',
  //   source: 'path/to/source.sh',
  //   transform: (content) => content.trim(),
  // },
];

/** Comment style per file extension */
const COMMENT_STYLES = {
  '.md': { prefix: '<!--', suffix: ' -->' },
  '.html': { prefix: '<!--', suffix: ' -->' },
  '.xml': { prefix: '<!--', suffix: ' -->' },
};
const DEFAULT_COMMENT_STYLE = { prefix: '#', suffix: '' };

/** Get comment style for a target file */
function getCommentStyle(targetFile) {
  const ext = path.extname(targetFile).toLowerCase();
  return COMMENT_STYLES[ext] || DEFAULT_COMMENT_STYLE;
}

/** Strip shebang line from shell scripts */
function stripShebang(content) {
  return content.replace(/^#!.*\n/, '');
}

/** Check if a key looks like a file path */
function isFilePath(key) {
  return key.includes('/') || key.includes('.');
}

/** Map source file extensions to markdown code fence languages */
const CODE_FENCE_LANGUAGES = {
  '.sh': 'bash',
  '.bash': 'bash',
  '.zsh': 'bash',
  '.ps1': 'powershell',
};

/**
 * Auto-transform source content based on the source file extension
 * and what makes sense in the target context.
 */
function autoTransform(sourceContent, sourceFile, targetFile) {
  const sourceExt = path.extname(sourceFile).toLowerCase();
  const targetExt = path.extname(targetFile).toLowerCase();

  // Strip shebang from shell scripts
  if (['.sh', '.bash', '.zsh'].includes(sourceExt)) {
    sourceContent = stripShebang(sourceContent);
  }

  // When including in markdown, wrap code files in a fenced code block
  const codeLang = CODE_FENCE_LANGUAGES[sourceExt];
  if (targetExt === '.md' && codeLang) {
    const code = sourceContent
      .split('\n')
      .filter((line) => !line.startsWith('#') && line.trim() !== '')
      .join('\n')
      .trim();
    return '```' + codeLang + '\n' + code + '\n```';
  }

  return sourceContent;
}

/**
 * Scan a file for all BEGIN markers and return { key, commentPrefix, commentSuffix } for each.
 */
function findMarkers(content, targetFile) {
  const { prefix, suffix } = getCommentStyle(targetFile);
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedSuffix = suffix.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Match: prefix BEGIN key suffix (suffix is optional with possible whitespace)
  const pattern = escapedSuffix ? `${escapedPrefix} BEGIN (.+?)\\s*${escapedSuffix}` : `${escapedPrefix} BEGIN (.+)`;

  const regex = new RegExp(pattern, 'g');
  const markers = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    markers.push({
      key: match[1].trim(),
      commentPrefix: prefix,
      commentSuffix: suffix,
    });
  }
  return markers;
}

/**
 * Replace content between BEGIN/END markers.
 */
function replaceBlock(content, key, sourceContent, commentPrefix, commentSuffix) {
  const BEGIN = `${commentPrefix} BEGIN ${key}${commentSuffix}`;
  const END = `${commentPrefix} END ${key}${commentSuffix}`;

  const beginIdx = content.indexOf(BEGIN);
  const endIdx = content.indexOf(END);

  if (beginIdx === -1 || endIdx === -1) return null;

  return content.slice(0, beginIdx) + BEGIN + '\n' + sourceContent + '\n' + content.slice(endIdx);
}

// Build a lookup from key -> inclusion config
const inclusionsByKey = new Map();
for (const inc of INCLUSIONS) {
  inclusionsByKey.set(inc.key, inc);
}

// Determine target files: CLI args or auto-scan git-tracked *.sh and *.md files
const cliTargets = process.argv.slice(2);
const trackedFiles = execSync('git ls-files "*.sh" "*.md"', { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
const inclusionTargets = INCLUSIONS.flatMap((inc) => inc.targets);
const targetFiles = cliTargets.length > 0 ? cliTargets : [...new Set([...trackedFiles, ...inclusionTargets])];

let totalUpdated = 0;

for (const target of targetFiles) {
  if (!fs.existsSync(target)) {
    console.log(`  >> File not found: ${target}, skipping`);
    continue;
  }

  let content = fs.readFileSync(target, 'utf8');
  let changed = false;

  const markers = findMarkers(content, target);

  for (const { key, commentPrefix, commentSuffix } of markers) {
    let sourceContent;

    const inc = inclusionsByKey.get(key);
    if (inc) {
      // Config mode: use explicit inclusion
      sourceContent = fs.readFileSync(inc.source, 'utf8');
      if (inc.transform) sourceContent = inc.transform(sourceContent);
    } else if (isFilePath(key)) {
      // Auto mode: key is the file path
      if (!fs.existsSync(key)) {
        console.log(`  >> Source file not found: ${key} (referenced in ${target}), skipping`);
        continue;
      }
      sourceContent = autoTransform(fs.readFileSync(key, 'utf8'), key, target);
    } else {
      // Unknown key, not a file path, no config — skip
      continue;
    }

    sourceContent = sourceContent.trim();
    const replaced = replaceBlock(content, key, sourceContent, commentPrefix, commentSuffix);

    if (replaced && replaced !== content) {
      content = replaced;
      changed = true;
      console.log(`  >> Updated ${target} (block: ${key})`);
    } else {
      console.log(`  >> No changes needed in ${target} (block: ${key})`);
    }
  }

  if (changed) {
    fs.writeFileSync(target, content);
    totalUpdated++;
  }
}

console.log(`  >> build-include: ${totalUpdated} file(s) updated`);

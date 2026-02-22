/**
 * Auto-generates software/types/globals.d.ts from JSDoc annotations in base-node-script.js.
 * Run: node software/generate-types.js
 */
const fs = require('fs');
const path = require('path');

const baseDir = path.join(__dirname, '../');
const srcPath = path.join(baseDir, 'base-node-script.js');
const outPath = path.join(baseDir, 'types', 'globals.d.ts');

const src = fs.readFileSync(srcPath, 'utf8');
const lines = src.split('\n');
const output = ['// Auto-generated from base-node-script.js JSDoc — do not edit manually.', '// Run: node software/generate-types.js', ''];

function getJsDoc(lines, lineIndex) {
  let j = lineIndex - 1;
  if (j >= 0 && lines[j].trim() === '*/') {
    let start = j;
    while (start > 0 && !lines[start].includes('/**')) start--;
    return lines.slice(start, j + 1).join('\n');
  }
  return '';
}

function extractParams(line) {
  let braceDepth = 0;
  let capturing = false;
  let paramChars = [];
  for (let k = line.indexOf('('); k < line.length; k++) {
    if (line[k] === '(') {
      braceDepth++;
      capturing = true;
      continue;
    }
    if (line[k] === ')') {
      braceDepth--;
      if (braceDepth === 0) break;
    }
    if (capturing) paramChars.push(line[k]);
  }
  const paramStr = paramChars.join('').trim();
  if (!paramStr) return '';
  return paramStr
    .split(',')
    .map((p) => {
      p = p.trim();
      if (p.startsWith('{')) return 'options?: any';
      if (p.startsWith('...')) return p + ': any[]';
      return p.split('=')[0].trim() + '?: any';
    })
    .join(', ');
}

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  // match: var NAME = (globalThis.NAME = ...)
  const varMatch = line.match(/^var\s+(\w+)\s*=/);
  if (varMatch) {
    const jsdoc = getJsDoc(lines, i);
    if (jsdoc) output.push(jsdoc);
    output.push('declare var ' + varMatch[1] + ': any;');
    output.push('');
    continue;
  }

  // match: function NAME(...) or async function NAME(...)
  const funcMatch = line.match(/^(async\s+)?function\s+(\w+)\s*\(/);
  if (funcMatch) {
    const jsdoc = getJsDoc(lines, i);
    const params = extractParams(line);
    const isAsync = !!funcMatch[1];
    const name = funcMatch[2];
    const retType = isAsync ? 'Promise<any>' : 'any';

    if (jsdoc) output.push(jsdoc);
    output.push('declare function ' + name + '(' + params + '): ' + retType + ';');
    output.push('');
  }
}

// ensure output dir exists
const outDir = path.dirname(outPath);
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

fs.writeFileSync(outPath, output.join('\n') + '\n');
console.log('>> Generated ' + outPath + ' (' + output.length + ' lines)');

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

/**
 * Extracts a type from a JSDoc block that may contain nested braces.
 * Finds the pattern, then counts braces to extract the full type.
 * @param {string} jsdoc - The JSDoc comment block
 * @param {RegExp} pattern - Regex to find the start (must match up to the opening {)
 * @returns {string} The extracted type or '' if not found
 */
function extractBracedType(jsdoc, pattern) {
  const match = pattern.exec(jsdoc);
  if (!match) return '';
  let depth = 1;
  let start = match.index + match[0].length;
  for (let i = start; i < jsdoc.length; i++) {
    if (jsdoc[i] === '{') depth++;
    if (jsdoc[i] === '}') depth--;
    if (depth === 0) return jsdoc.slice(start, i).trim();
  }
  return '';
}

/**
 * Extracts the @returns or @return type from a JSDoc block.
 * Supports: @returns {Type}, @return {Type}
 * @param {string} jsdoc - The JSDoc comment block
 * @returns {string} The extracted type or '' if not found
 */
function extractReturnType(jsdoc) {
  if (!jsdoc) return '';
  return extractBracedType(jsdoc, /@returns?\s*\{/);
}

/**
 * Extracts the @type from a JSDoc block.
 * Supports: @type {Type} including nested braces like {Array<{a: string}>}
 * @param {string} jsdoc - The JSDoc comment block
 * @returns {string} The extracted type or 'any' if not found
 */
function extractVarType(jsdoc) {
  if (!jsdoc) return 'any';
  return extractBracedType(jsdoc, /@type\s*\{/) || 'any';
}

/**
 * Extracts @param types from a JSDoc block and returns a map of param name to type.
 * @param {string} jsdoc - The JSDoc comment block
 * @returns {Object<string, string>} Map of parameter name to type
 */
function extractParamTypes(jsdoc) {
  if (!jsdoc) return {};
  const paramTypes = {};
  // find each @param occurrence and extract its braced type
  const paramPattern = /@param\s*\{/g;
  let startMatch;
  while ((startMatch = paramPattern.exec(jsdoc)) !== null) {
    // extract the type using brace counting
    let depth = 1;
    let typeStart = startMatch.index + startMatch[0].length;
    let typeEnd = typeStart;
    for (let i = typeStart; i < jsdoc.length; i++) {
      if (jsdoc[i] === '{') depth++;
      if (jsdoc[i] === '}') depth--;
      if (depth === 0) { typeEnd = i; break; }
    }
    const type = jsdoc.slice(typeStart, typeEnd).trim();
    // after the closing }, extract the param name
    const rest = jsdoc.slice(typeEnd + 1);
    const nameMatch = rest.match(/^\s*(?:\[([^\]]+)\]|(\w+))/);
    if (nameMatch) {
      let name = (nameMatch[1] || nameMatch[2]).trim();
      name = name.split('=')[0].trim();
      paramTypes[name] = type;
    }
    // advance past this match
    paramPattern.lastIndex = typeEnd + 1;
  }
  return paramTypes;
}

function extractParamsWithTypes(line, paramTypes) {
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
      if (p.startsWith('{')) {
        // destructured object param — check if any @param has options/Object type
        const objType = paramTypes['options'] || 'any';
        return 'options?: ' + objType;
      }
      if (p.startsWith('...')) {
        const name = p.replace('...', '');
        const type = paramTypes[name] || 'any[]';
        return '...' + name + ': ' + type;
      }
      const hasDefault = p.includes('=');
      const name = p.split('=')[0].trim();
      const type = paramTypes[name] || 'any';
      return name + (hasDefault ? '?' : '') + ': ' + type;
    })
    .join(', ');
}

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  // match: var NAME = (globalThis.NAME = ...)
  const varMatch = line.match(/^var\s+(\w+)\s*=/);
  if (varMatch) {
    const jsdoc = getJsDoc(lines, i);
    const varType = extractVarType(jsdoc);
    if (jsdoc) output.push(jsdoc);
    output.push('declare var ' + varMatch[1] + ': ' + varType + ';');
    output.push('');
    continue;
  }

  // match: function NAME(...) or async function NAME(...)
  const funcMatch = line.match(/^(async\s+)?function\s+(\w+)\s*\(/);
  if (funcMatch) {
    const jsdoc = getJsDoc(lines, i);
    const isAsync = !!funcMatch[1];
    const name = funcMatch[2];
    const paramTypes = extractParamTypes(jsdoc);
    const params = extractParamsWithTypes(line, paramTypes);
    const jsdocRetType = extractReturnType(jsdoc);
    let retType;
    if (jsdocRetType) {
      retType = isAsync && !jsdocRetType.startsWith('Promise') ? 'Promise<' + jsdocRetType + '>' : jsdocRetType;
    } else {
      retType = isAsync ? 'Promise<any>' : 'any';
    }

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

# --- Image Compression ---
# image_compress: compress JPG/PNG files recursively with optional format conversion.
# Args: quality/compression/purge/autoOrient/outputFormat options, input, optional output folder.
# Returns 0 on success/help, 2 on shell argument errors, 127 on missing binaries, otherwise 1 on failure.
# Writes lossy outputs; purge defaults to true and deletes/replaces sources only after encoding succeeds.
function image_compress() {
  if [ "$#" -eq 0 ] || is_help_arg "${1:-}"; then
    printf '%s\n' "image_compress: compress JPG/PNG files recursively with optional format conversion
  Usage: image_compress [options] <input-file-or-folder> [output-folder]
  --quality=0-100               Default: JPG 82, PNG 85; 0 maps to encoder minimum 1.
  --compression=0-9             PNG compression level; default 9. Ignored for JPG.
  --purge=true|false            Default true. Uses is_truthy: 1/true/y/yes enable it.
  --autoOrient=true|false       Default true. Uses is_truthy, case-insensitively.
  --outputFormat=preserve|jpg|png  Default preserve. JPEG transparency becomes white.
  Options also accept separate values. Use -- before a leading-dash input.
  WARNING: purge=true replaces/deletes originals after successful lossy encoding.
  With output-folder: preserve relative paths; purge removes successfully converted sources.
  Without output-folder: purge replaces sources; otherwise add .converted before the extension.
  Existing destinations and conversion collisions are rejected before encoding.
  Recursive scans skip symlinks, .secret. paths, *.converted images, and the output subtree.
  Requires Node.js and the sharp executable from sharp-cli; Windows requires Git Bash.
  Examples:
    image_compress --purge=no photo.jpg
    image_compress --quality=85 --purge=0 photos compressed
    image_compress --outputFormat=jpg --autoOrient=y photos compressed"
    return 0
  fi

  local quality="" compression=9 purge_value=true orient_value=true output_format=preserve
  local option value purge=0 auto_orient=0 shell_binary="$BASH" binary image_js
  while [ "$#" -gt 0 ]; do
    case "$1" in
    --quality=* | --compression=* | --purge=* | --autoOrient=* | --outputFormat=*)
      option="${1%%=*}"
      value="${1#*=}"
      ;;
    --quality | --compression | --purge | --autoOrient | --outputFormat)
      option="$1"
      if [ "$#" -lt 2 ]; then
        printf 'image_compress: missing value for %s\n' "$option" >&2
        return 2
      fi
      shift
      value="$1"
      ;;
    --)
      shift
      break
      ;;
    -*)
      printf 'image_compress: unknown option: %s\n' "$1" >&2
      return 2
      ;;
    *) break ;;
    esac
    case "$option" in
    --quality) quality="$value" ;;
    --compression) compression="$value" ;;
    --purge) purge_value="$value" ;;
    --autoOrient) orient_value="$value" ;;
    --outputFormat) output_format="$value" ;;
    esac
    shift
  done
  if [ "$#" -lt 1 ] || [ "$#" -gt 2 ] || [ -z "$1" ] || { [ "$#" -eq 2 ] && [ -z "$2" ]; }; then
    printf '%s\n' 'image_compress: expected an input and optional nonempty output folder; see --help' >&2
    return 2
  fi
  if is_truthy "$purge_value"; then purge=1; fi
  if is_truthy "$orient_value"; then auto_orient=1; fi
  for binary in node sharp; do
    if ! type -P "$binary" > /dev/null; then
      printf 'image_compress: required executable not found: %s (sharp comes from sharp-cli)\n' "$binary" >&2
      return 127
    fi
  done

  # Native Windows Node cannot spawn an MSYS /usr/bin path; use Bash's Windows filename.
  if is_truthy "${is_os_mingw64:-0}"; then
    shell_binary=$(command cygpath -w "$BASH") || return 1
  fi
  IFS= read -r -d '' image_js << '_IMAGE_COMPRESS_JS_' || true
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
/** Raw CLI values; booleans have already been normalized by the shell's is_truthy. */
const [qualityArg, compressionArg, purgeArg, orientArg, format, inputArg, outputArg, shell] = process.argv.slice(1);
/** Supported image extensions, including the long JPEG spelling. */
const imageExtension = /\.(png|jpe?g)$/i;
/** Two-minute per-file deadline bounds a stalled encoder without deleting its source. */
const encodeTimeoutMs = 120000;

/**
 * Reject protected names and symbolic links in every existing path component.
 * @param {string} filename Absolute source or destination.
 * @returns {void} No filesystem changes.
 * @throws {Error} For protected paths, symbolic links, or inaccessible components.
 */
function checkPath(filename) {
  if (filename.includes('.secret.')) throw new Error('protected .secret. path refused');
  const parent = path.dirname(filename);
  if (parent !== filename) checkPath(parent);
  try {
    if (fs.lstatSync(filename).isSymbolicLink()) throw new Error('symbolic link refused: ' + filename);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

/**
 * Resolve parent aliases such as macOS /var while retaining leaf symlink checks.
 * @param {string} filename Requested source or output filename.
 * @returns {string} Absolute filename with a physical existing parent.
 * @throws {Error} For protected paths or inaccessible parents; no writes.
 */
function canonicalPath(filename) {
  const absolute = path.resolve(filename);
  if (absolute.includes('.secret.')) throw new Error('protected .secret. path refused');
  const parent = path.dirname(absolute);
  if (parent === absolute) return absolute;
  const resolvedParent = fs.existsSync(parent) ? fs.realpathSync(parent) : canonicalPath(parent);
  const resolved = path.join(resolvedParent, path.basename(absolute));
  checkPath(resolved);
  return resolved;
}

/**
 * Read a regular source's identity, rejecting aliases and filesystem changes.
 * @param {string} filename Absolute input filename.
 * @returns {string} Identity including inode, size, and change timestamps.
 * @throws {Error} For missing, nonregular, or unsafe inputs; no writes.
 */
function identity(filename) {
  checkPath(filename);
  const stat = fs.lstatSync(filename);
  if (!stat.isFile()) throw new Error('input must be a regular image: ' + filename);
  return [stat.dev, stat.ino, stat.size, stat.mtimeMs, stat.ctimeMs].join(':');
}

/**
 * Snapshot recursive inputs without following links or revisiting generated output.
 * @param {string} folder Absolute input folder.
 * @param {string} output Absolute output folder or empty string.
 * @returns {string[]} Regular image filenames; reads filesystem metadata only.
 * @throws {Error} For inaccessible folders.
 */
function images(folder, output) {
  const found = [];
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    const filename = path.join(folder, entry.name);
    if (filename === output || filename.includes('.secret.') || entry.name.startsWith('.image-compress-') || entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) found.push(...images(filename, output));
    else if (entry.isFile() && imageExtension.test(entry.name) && !/\.converted\.(png|jpe?g)$/i.test(entry.name)) found.push(filename);
  }
  return found;
}

/**
 * Publish a staged output without overwriting a concurrently created destination.
 * @param {string} staged Verified encoded filename on the destination filesystem.
 * @param {string} destination New output filename.
 * @returns {void} Creates destination; never overwrites an existing entry.
 * @throws {Error} On publication failure, leaving the source untouched.
 */
function publish(staged, destination) {
  try {
    fs.linkSync(staged, destination);
  } catch (error) {
    // FAT and some network shares cannot hard-link; exclusive writes retain no-clobber behavior.
    if (!['EPERM', 'ENOTSUP', 'EOPNOTSUPP', 'EXDEV'].includes(error.code)) throw error;
    fs.writeFileSync(destination, fs.readFileSync(staged), { flag: 'wx' });
  }
}

/**
 * Encode and publish one preflighted image, then optionally remove its unchanged source.
 * @param {{source: string, destination: string, stamp: string, type: string, inPlace: boolean}} job Planned conversion.
 * @param {{quality: number|null, compression: number, purge: boolean, orient: boolean}} options Validated settings.
 * @returns {void} Prints success only after publication and requested purge.
 * @throws {Error} On encoding, concurrent modification, publication, or cleanup failure.
 */
function convert(job, options) {
  const { source, destination, stamp, type, inPlace } = job;
  if (identity(source) !== stamp) throw new Error('source changed before encoding: ' + source);
  const folder = path.dirname(destination);
  checkPath(folder);
  fs.mkdirSync(folder, { recursive: true });
  const temporary = fs.mkdtempSync(path.join(folder, '.image-compress-'));
  try {
    const staged = path.join(temporary, 'output.' + type);
    const quality = options.quality === null ? (type === 'jpeg' ? 82 : 85) : options.quality;
    const args = ['-i', source, '-o', staged, '-f', type, '--quality', String(quality)];
    if (options.orient) args.push('--autoOrient');
    if (type === 'jpeg') args.push('--mozjpeg', 'flatten', '#ffffff');
    else args.push('--palette', '--compressionLevel', String(options.compression));
    // Positional arguments avoid shell interpolation and support npm's Git Bash shim on Windows.
    const result = spawnSync(shell, ['--noprofile', '--norc', '-c', 'command sharp "$@"', 'image_compress', ...args], {
      encoding: 'utf8', timeout: encodeTimeoutMs, maxBuffer: 1024 * 1024,
      env: { ...process.env, BASH_ENV: '' },
    });
    if (result.error || result.status !== 0) {
      const detail = result.error ? result.error.message : (result.stderr || '').trim().slice(0, 2000);
      throw new Error('encoder failed for ' + source + ': ' + detail);
    }
    if (!fs.lstatSync(staged).isFile() || fs.statSync(staged).size === 0) throw new Error('encoder produced no image: ' + source);
    if (identity(source) !== stamp) throw new Error('source changed during encoding: ' + source);
    checkPath(destination);
    if (inPlace) fs.renameSync(staged, destination);
    else {
      publish(staged, destination);
      if (options.purge) {
        if (identity(source) !== stamp) throw new Error('output saved but changed source retained: ' + source);
        fs.unlinkSync(source);
      }
    }
    process.stdout.write('Compressed: ' + JSON.stringify(source) + ' -> ' + JSON.stringify(destination) + '\n');
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

try {
  if (qualityArg !== '' && (!/^\d{1,3}$/.test(qualityArg) || Number(qualityArg) > 100)) throw new Error('quality must be an integer from 0 to 100');
  if (!/^[0-9]$/.test(compressionArg)) throw new Error('compression must be an integer from 0 to 9');
  if (!['preserve', 'jpg', 'png'].includes(format)) throw new Error('outputFormat must be preserve, jpg, or png');
  const options = { quality: qualityArg === '' ? null : Math.max(1, Number(qualityArg)), compression: Number(compressionArg), purge: purgeArg === '1', orient: orientArg === '1' };
  const input = canonicalPath(inputArg);
  const output = outputArg ? canonicalPath(outputArg) : '';
  if (input === path.parse(input).root) throw new Error('input must not be a filesystem root');
  checkPath(input);
  const stat = fs.lstatSync(input);
  if (!stat.isFile() && !stat.isDirectory()) throw new Error('input must be a regular file or folder');
  if (output) {
    checkPath(output);
    if (fs.existsSync(output) && !fs.statSync(output).isDirectory()) throw new Error('output must be a folder');
    if (output === input) throw new Error('output folder equals input; omit output for in-place conversion');
  }
  const sources = stat.isDirectory() ? images(input, output) : [input];
  if (!sources.length) throw new Error('no JPG or PNG images found');
  const destinations = new Set();
  const jobs = sources.map(source => {
    if (!imageExtension.test(source)) throw new Error('input extension must be .jpg, .jpeg, or .png');
    const extension = path.extname(source);
    const suffix = format === 'preserve' ? extension : '.' + format;
    const type = suffix.toLowerCase() === '.png' ? 'png' : 'jpeg';
    const stem = path.basename(source, extension);
    const name = stem + (!output && !options.purge ? '.converted' : '') + suffix;
    const destination = output
      ? path.join(output, stat.isDirectory() ? path.dirname(path.relative(input, source)) : '', name)
      : path.join(path.dirname(source), name);
    checkPath(destination);
    const key = process.platform === 'linux' ? destination : destination.toLowerCase();
    if (destinations.has(key)) throw new Error('multiple inputs target the same output: ' + destination);
    destinations.add(key);
    const stamp = identity(source);
    const exists = fs.existsSync(destination);
    // Case-only extension changes may name the same file on macOS, Windows, or mounted Windows volumes.
    const inPlace = !output && options.purge && (source === destination ||
      (exists && source.toLowerCase() === destination.toLowerCase() &&
        !fs.readdirSync(path.dirname(source)).includes(path.basename(destination)) && identity(destination) === stamp));
    if (exists && !inPlace) throw new Error('destination already exists: ' + destination);
    return { source, destination, stamp, type, inPlace };
  });
  let failures = 0;
  for (const job of jobs) {
    try { convert(job, options); }
    catch (error) {
      failures++;
      process.stderr.write('image_compress: ' + error.message + '\n');
    }
  }
  process.exitCode = failures ? 1 : 0;
} catch (error) {
  process.stderr.write('image_compress: ' + error.message + '\n');
  process.exitCode = 1;
}
_IMAGE_COMPRESS_JS_
  command node -e "$image_js" -- "$quality" "$compression" "$purge" "$auto_orient" "$output_format" "$1" "${2:-}" "$shell_binary"
}

/** Generate the reviewed upstream skill resource manifest without executing upstream code. */
const fs = require("fs");
const path = require("path");
const https = require("https");
const crypto = require("crypto");

/** @type {string} Repository root containing the generated manifest. */
const ROOT = path.resolve(__dirname, "../..");
/** @type {string} Generated data consumed through the shared SOURCE mechanism. */
const OUTPUT = path.join(ROOT, "software/metadata/llm-upstream-skills.common.js");
/** @type {number} Bound each public source request to thirty seconds. */
const REQUEST_TIMEOUT_MS = 30000;
/** @type {number} Refuse unexpectedly large individual upstream resources. */
const MAX_RESOURCE_BYTES = 8 * 1024 * 1024;
/** @type {Array<{id: string, repository: string, revision: string, skills: string[]}>} Reviewed pins and complete skill folders; changes require source review. */
const SOURCES = [
  {
    id: "superpowers",
    repository: "obra/superpowers",
    revision: "2ce8aa15d05bd57213e6f746f953aafb7ded7a8b",
    skills: [
      "systematic-debugging",
      "test-driven-development",
      "verification-before-completion",
      "executing-plans",
      "using-git-worktrees",
      "using-superpowers",
      "writing-plans",
      "subagent-driven-development",
      "requesting-code-review",
      "finishing-a-development-branch",
      "receiving-code-review",
      "dispatching-parallel-agents",
      "brainstorming",
    ],
  },
  {
    id: "khasky",
    repository: "khasky/awesome-agent-skills",
    revision: "58ea4e8915de64907d04cc909a1b8c6e5cf0fcb7",
    skills: [
      "awesome-dependency-upgrade",
      "awesome-dependency-audit",
      "awesome-design-doc",
      "awesome-api-design",
      "awesome-test-gap-audit",
      "awesome-test-writing",
      "awesome-agents-md-generator",
      "awesome-architecture-audit",
      "awesome-code-review",
      "awesome-code-cleanup",
      "awesome-security-audit",
      "awesome-bug-fix",
      "awesome-regression-sweep",
      "awesome-root-cause",
      "awesome-performance-audit",
      "awesome-code-standards",
      "awesome-claims-audit",
      "awesome-document-style",
      "awesome-humanize-en",
      "awesome-grammar-check",
    ],
  },
  {
    id: "addy",
    repository: "addyosmani/agent-skills",
    revision: "eb07f19f52c2669f2364897aaa293e2aaddd7b1c",
    skills: ["interview-me"],
  },
  {
    id: "steve",
    repository: "SteveVitali/agent-skills",
    revision: "e981ec57d487a2c41d416672483b5a4df15b1233",
    skills: ["address-pr-comments", "self-review"],
  },
  {
    id: "arjun",
    repository: "arjunprabhulal/agent-skills",
    revision: "42dd24080fce6d731d00e2a1134f398c3da4171b",
    skills: ["devops/ci-pipelines"],
  },
  {
    id: "anthropic",
    repository: "anthropics/skills",
    revision: "ca45fc496a3436251f191354091d557da31c15b5",
    skills: ["internal-comms"],
  },
];

/**
 * Fetch one public HTTPS resource with explicit time and byte limits.
 * @param {string} url - Public GitHub API or immutable raw-content URL.
 * @returns {Promise<Buffer>} Exact response bytes.
 * @throws {Error} On network, HTTP, timeout, or response-size failure; performs no writes.
 */
function fetchBytes(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { headers: { "User-Agent": "bashrc-upstream-skill-manifest" } }, (response) => {
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`Upstream request failed: HTTP ${response.statusCode} for ${url}`));
        return;
      }
      const chunks = [];
      let size = 0;
      response.on("data", (chunk) => {
        size += chunk.length;
        if (size > MAX_RESOURCE_BYTES) {
          response.destroy(new Error(`Upstream resource exceeds ${MAX_RESOURCE_BYTES} bytes: ${url}`));
          return;
        }
        chunks.push(chunk);
      });
      response.on("end", () => resolve(Buffer.concat(chunks)));
      response.on("error", reject);
    });
    request.setTimeout(REQUEST_TIMEOUT_MS, () => request.destroy(new Error(`Upstream request timed out: ${url}`)));
    request.on("error", reject);
  });
}

/**
 * Build integrity records for complete selected skill folders and their license.
 * @param {{id: string, repository: string, revision: string, skills: string[]}} source - Reviewed source selection.
 * @returns {Promise<object>} Provider metadata and exact resource hashes.
 * @throws {Error} On incomplete trees, unsafe paths, absent skills/licenses, or download failure; performs public reads only.
 */
async function inventorySource(source) {
  /** @type {{truncated: boolean, tree: Array<{type: string, mode: string, path: string}>}} Parsed public tree response. */
  let tree;
  try {
    tree = JSON.parse(
      (await fetchBytes(`https://api.github.com/repos/${source.repository}/git/trees/${source.revision}?recursive=1`)).toString("utf8"),
    );
  } catch (error) {
    if (error instanceof SyntaxError) process.stderr.write(`Malformed upstream tree JSON: ${source.repository}\n`);
    throw error;
  }
  if (!tree || !Array.isArray(tree.tree) || tree.truncated !== false) throw new Error(`Incomplete upstream tree: ${source.repository}`);
  const allFiles = tree.tree.filter((entry) => entry.type === "blob");
  for (const skill of source.skills) {
    if (!allFiles.some((entry) => entry.path === `skills/${skill}/SKILL.md`))
      throw new Error(`Missing upstream skill: ${source.id}/${skill}`);
  }
  const license = allFiles.find((entry) => /^(LICENSE|LICENSE\.md|LICENSE\.txt)$/.test(entry.path));
  if (
    !license &&
    !source.skills.every((skill) => allFiles.some((entry) => new RegExp(`^skills/${skill}/LICENSE(?:\\.md|\\.txt)?$`).test(entry.path)))
  ) {
    throw new Error(`Missing repository or per-skill license: ${source.repository}`);
  }
  const selected = allFiles.filter(
    (entry) => entry === license || source.skills.some((skill) => entry.path.startsWith(`skills/${skill}/`)),
  );
  const files = [];
  for (const entry of selected.sort((left, right) => left.path.localeCompare(right.path, "en"))) {
    if (
      entry.mode === "120000" ||
      entry.path.includes(".secret.") ||
      entry.path.split("/").some((part) => !part || part.startsWith(".") || part === "credentials")
    ) {
      throw new Error(`Unsafe upstream resource path: ${source.id}/${entry.path}`);
    }
    const bytes = await fetchBytes(`https://raw.githubusercontent.com/${source.repository}/${source.revision}/${entry.path}`);
    files.push({
      path: entry.path,
      sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
      bytes: bytes.length,
      executable: entry.mode === "100755",
    });
  }
  return { ...source, files };
}

/**
 * Regenerate the shared manifest only after every pinned source was inventoried.
 * @returns {Promise<void>} Writes generated metadata and prints provider/resource counts.
 * @throws {Error} On retrieval or filesystem failure; never installs or executes upstream resources.
 */
async function main() {
  const providers = [];
  for (const source of SOURCES) {
    const provider = await inventorySource(source);
    providers.push(provider);
    process.stderr.write(`${provider.id}: ${provider.skills.length} skill folders, ${provider.files.length} resources\n`);
  }
  const content = `/** Generated by software/tools/refresh-llm-upstream-skills.js; DO NOT EDIT. */\n/** @type {Array<{id: string, repository: string, revision: string, skills: string[], files: Array<{path: string, sha256: string, bytes: number, executable: boolean}>}>} Reviewed immutable upstream dependencies. */\nconst LLM_UPSTREAM_SKILL_SOURCES = ${JSON.stringify(providers, null, 2)};\n`;
  fs.writeFileSync(OUTPUT, content);
  process.stderr.write(`Generated ${path.relative(ROOT, OUTPUT)}\n`);
}

if (require.main === module)
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });

module.exports = { fetchBytes, inventorySource, main };

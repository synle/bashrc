# LLM Large-Context Handling

A practical guide to working with LLMs when your input is big — long
documents, transcripts, code diffs, full conversation history,
multi-file repos. Covers the four major providers, what they offer,
and the provider-agnostic techniques that matter most.

The core problem: every model has a context window. Naively stuffing
everything into one prompt either overflows the window, costs too
much, or both. This doc is about how to avoid that.

---

## Table of Contents

- [The problem](#the-problem)
- [Capability matrix at a glance](#capability-matrix-at-a-glance)
- [Provider deep-dives](#provider-deep-dives)
  - [OpenAI](#openai)
  - [Anthropic Claude](#anthropic-claude)
  - [Google Gemini](#google-gemini)
  - [GitHub Models / GitHub Copilot](#github-models--github-copilot)
- [Provider-agnostic techniques](#provider-agnostic-techniques)
  - [1. Pre-LLM compression](#1-pre-llm-compression)
  - [2. Two-stage pipelines](#2-two-stage-pipelines)
  - [3. Embedding-based retrieval (RAG)](#3-embedding-based-retrieval-rag)
  - [4. Multi-call fan-out](#4-multi-call-fan-out)
  - [5. Hierarchical summarization](#5-hierarchical-summarization)
  - [6. Application-level response cache](#6-application-level-response-cache)
- [Decision framework](#decision-framework)
- [Pricing reference (approximate)](#pricing-reference-approximate)
- [Anti-patterns](#anti-patterns)

---

## The problem

You have content that's larger than your prompt budget can handle.
Naive options:

- **Truncate** — loses information, picks arbitrarily
- **Bigger model** — pricier per token, still has a ceiling
- **Just send it all** — hits the context limit, fails or degrades

The right answer is layered: shrink the input first (cheap, no model
needed), then use provider features (caching, batching) to make what
remains affordable, and only escalate to bigger context windows or
fancier retrieval when necessary.

Three numbers that shape every decision:

1. **Context window** (model-defined) — max input + output tokens for
   one call.
2. **Per-token price** — input usually 4–10× cheaper than output.
3. **Caching discount** — provider-side reuse of repeated prompt
   prefixes; 50–90% off cached tokens depending on provider.

---

## Capability matrix at a glance

| Capability                      | OpenAI                                 | Anthropic Claude                                       | Google Gemini                                                     | GitHub Models                                              |
| ------------------------------- | -------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------- | ---------------------------------------------------------- |
| Max context window              | 1M (gpt-4.1, gpt-5)                    | 1M (Sonnet long-ctx)                                   | 2M (Gemini 1.5/2.5 Pro)                                           | depends on model routed                                    |
| Common default window           | 128K (gpt-4o family)                   | 200K (Sonnet/Opus)                                     | 1M (Gemini 2.5 Flash)                                             | varies                                                     |
| Prompt caching                  | automatic, ≥1024-token prefix, 50% off | **explicit** via `cache_control`, 90% off, 5min–1h TTL | **explicit** context caching, ~75% off cached, hourly storage fee | passes through for OpenAI-backed models; depends per model |
| Batch / async mode              | yes — 50% off, 24h SLA                 | yes — Message Batches, 50% off, 24h SLA                | yes — Batch prediction (Vertex AI), ~50% off                      | **no**                                                     |
| Embeddings model                | text-embedding-3-small/large           | voyage-3 (partner) or use 3rd party                    | text-embedding-004                                                | yes (OpenAI-backed)                                        |
| Native file/PDF input           | Files API + Responses API              | Files API + native PDF support                         | native PDF + multimodal                                           | depends per model                                          |
| Native multimodal (image/video) | yes                                    | image yes, no video yet                                | image + video + audio                                             | depends per model                                          |
| SDK shape                       | `openai`                               | `@anthropic-ai/sdk`                                    | `@google/generative-ai`                                           | `openai`-compatible                                        |

The four are not interchangeable for large-context work — caching
mechanics in particular differ a lot. Pick deliberately.

---

## Provider deep-dives

### OpenAI

**Context windows.** Default `gpt-4o`/`gpt-4o-mini` = 128K. `o1`/`o3-mini`
= 200K. `gpt-4.1`/`gpt-5` family = 1M. Same window in sync and Batch
modes — Batch doesn't add a separate limit.

**Prompt caching (automatic).** The killer feature is that you don't
opt in — OpenAI auto-caches the longest stable prefix of any prompt
≥ 1024 tokens. Discount: 50% off cached input tokens.

Cache key is the **byte-exact prefix**. One variable token early in
the prompt invalidates everything after it. So the practical rule:

> Put stable content first (system prompt, instructions, reference
> material), variable content last (the user's actual question,
> per-call data).

Verify hits via the response:

```js
const response = await client.chat.completions.create({...});
console.log(response.usage.prompt_tokens_details.cached_tokens);
// > 0 means the cache fired
```

Cache lifetime: ~5–10 min idle, up to ~1 hour during sustained
activity. No control knob; just keep traffic warm.

**Batch API.** Async bulk endpoint for non-real-time workloads.

- **50% off input AND output tokens** vs the sync endpoint
- 24h SLA (usually completes in minutes)
- JSONL file-based: upload requests, poll status, download results
- Separate quota pool from sync (doesn't share your live RPM/TPM)
- Caching stacks with Batch — cached tokens via Batch = **75% off**
  regular input price

Code shape (matches the sync client; same SDK):

```js
import OpenAI from 'openai';
import { createReadStream } from 'node:fs';
const client = new OpenAI();

// 1. Build JSONL — one line per request
const jsonl = jobs.map(j => JSON.stringify({
  custom_id: j.id,           // YOUR id; echoed back on result
  method: 'POST',
  url: '/v1/chat/completions',
  body: { model: 'gpt-4o-mini', messages: [...] }
})).join('\n');
await fs.writeFile('/tmp/batch.jsonl', jsonl);

// 2. Upload + create batch
const file = await client.files.create({
  file: createReadStream('/tmp/batch.jsonl'),
  purpose: 'batch'
});
const batch = await client.batches.create({
  input_file_id: file.id,
  endpoint: '/v1/chat/completions',
  completion_window: '24h'
});

// 3. Poll until terminal
let b = batch;
while (!['completed','failed','expired','cancelled'].includes(b.status)) {
  await new Promise(r => setTimeout(r, 60_000));
  b = await client.batches.retrieve(batch.id);
}

// 4. Always read BOTH files — successes and failures land separately
const ok    = await client.files.content(b.output_file_id);
const errs  = b.error_file_id
  ? await client.files.content(b.error_file_id)
  : null;
```

**Batch failure semantics worth knowing:**

- File-level malformed input → fails at `files.create()` (sync error)
- Quota exceeded / bad endpoint → fails at `batches.create()` (sync error)
- Per-line schema errors → discovered during `validating` status,
  surfaced via `batch.errors` field after polling
- Per-request runtime errors (bad model, content policy, etc.) →
  silent until the batch completes, then land in `error_file_id`

So: **never trust that `status: completed` means "every request
succeeded".** Always read both files, reconcile by `custom_id`.

**Embeddings.** `text-embedding-3-small` or `text-embedding-3-large`.
1536 or 3072 dimensions respectively. Foundational for RAG patterns
below.

**Azure OpenAI.** Same SDK shape, point at
`https://<resource>.openai.azure.com`, use `AzureOpenAI` client class.
Batch supported but requires a **Global Batch deployment** (separate
from Standard / Provisioned) in a region that offers it. Caching:
same automatic behavior as public OpenAI for the same model families.
API endpoint paths drop the `/v1` prefix (`/chat/completions` instead
of `/v1/chat/completions`).

### Anthropic Claude

**Context windows.** Sonnet/Opus default = 200K. A long-context
Sonnet variant supports 1M. Same window in Batch mode.

**Prompt caching (explicit).** Different model than OpenAI: **you
mark what to cache** with `cache_control` blocks. Up to 4 cache
breakpoints per prompt. Discount: 90% off cached input tokens (much
deeper than OpenAI's 50%).

```js
import Anthropic from "@anthropic-ai/sdk";
const client = new Anthropic();

const resp = await client.messages.create({
  model: "claude-sonnet-4-5",
  max_tokens: 1024,
  system: [
    {
      type: "text",
      text: "...long stable system prompt...",
      cache_control: { type: "ephemeral" }, // ← cache marker
    },
  ],
  messages: [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: "...big reference document...",
          cache_control: { type: "ephemeral" }, // ← another cache marker
        },
        {
          type: "text",
          text: "My actual question about the doc.", // variable, not cached
        },
      ],
    },
  ],
});

console.log(resp.usage.cache_read_input_tokens);
console.log(resp.usage.cache_creation_input_tokens);
```

TTL: 5 min default, 1 hour available via beta header. Each breakpoint
caches the prefix up to that point.

When to pick which provider on caching alone:

- **OpenAI** — simpler (zero opt-in), works automatically. Smaller
  discount.
- **Claude** — bigger discount, explicit control over what to cache.
  Lets you cache _multiple_ segments (e.g. system + a big document
  shared across many user questions). Worth more code for 4–5×
  bigger savings.

**Message Batches API.** Anthropic's equivalent to OpenAI Batch.
50% off both input and output, 24h window. Slightly different shape —
requests submitted via API call, not file upload:

```js
const batch = await client.messages.batches.create({
  requests: [
    { custom_id: 'job-1', params: { model: '...', max_tokens: 1024, messages: [...] }},
    { custom_id: 'job-2', params: { ... } },
    // up to 100,000 requests per batch
  ]
});

// Poll, then iterate results
for await (const result of client.messages.batches.results(batch.id)) {
  // result.custom_id, result.result.message, result.result.error
}
```

Caching stacks with Batch — cached + batched = ~95% off regular
input. Currently the deepest discount any provider offers.

**Files API + PDFs.** Native PDF input — you can upload PDFs directly
and reference them by file_id. Claude reads them as text + images
without an OCR step on your side.

**Citations.** When Claude answers from a provided document, it can
emit citation markers tied to spans in the source. Useful for "show
me where this came from" UIs without an extra RAG step.

### Google Gemini

**Context windows.** This is Gemini's headline feature: **Gemini 1.5
Pro / 2.5 Pro = 2M tokens**, Gemini 2.5 Flash = 1M. Bigger than any
other provider's standard offering. For workloads where you really
do want to stuff everything in (entire codebases, hours of video,
huge document sets), Gemini is the easy path.

**Context caching (explicit, stateful).** Different model again: you
create a _named cache object_ with content, then reference it from
subsequent calls.

```js
import { GoogleGenerativeAI } from "@google/generative-ai";
const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 1. Create the cache (once, reusable across calls)
const cache = await ai.caches.create({
  model: "gemini-2.5-pro",
  config: {
    contents: [
      /* big stable content — docs, code, transcripts */
    ],
    systemInstruction: "...",
    ttl: "3600s", // 1 hour
  },
});

// 2. Reference it from generate calls
const model = ai.getGenerativeModelFromCachedContent(cache);
const result = await model.generateContent("My question about the cached docs");
```

Pricing model is different from OpenAI/Claude:

- **Cached input read**: ~75% off normal input price
- **Cache storage**: per-hour fee while the cache exists (a few
  dollars per million cached tokens per hour, depending on model)
- **TTL**: you set it; default 1 hour

The storage fee is the catch — caching pays off only if you make
enough calls against the cache during its lifetime. Rule of thumb:
break-even at ~3–10 calls/hour against a cached payload, depending
on size and model.

When Gemini caching wins:

- A single stable document you ask 50 questions about
- A codebase you analyze repeatedly within a session
- Many users querying the same FAQ corpus

When it loses:

- One-off per-artifact workflows where you wouldn't reuse the cache
  enough times to amortize the storage fee. OpenAI/Claude caching
  (no storage fee) is better here.

**Batch prediction (Vertex AI).** Available via Vertex; ~50% off.
JSONL-based, similar shape to OpenAI Batch. The newer Gemini API
(`generativelanguage.googleapis.com`) is rolling out Batch
separately — check current docs for which endpoint you're hitting.

**Multimodal native.** Image, video, audio all as first-class
inputs. For very-long-form content (a 1-hour meeting recording, a
30-minute screencast), you can hand Gemini the raw media instead of
running a transcription step first. Different cost profile but
sometimes simpler.

### GitHub Models / GitHub Copilot

Important upfront: **"GitHub Copilot" the IDE/chat product is not a
completions API.** The relevant programmatic surface is **GitHub
Models** at `models.github.ai/inference`, which is OpenAI-SDK-
compatible.

```js
import OpenAI from "openai";
const client = new OpenAI({
  baseURL: "https://models.github.ai/inference",
  apiKey: process.env.GITHUB_TOKEN,
});
// Everything else identical to OpenAI direct
```

**Caching.** For OpenAI-backed models routed through GitHub
(`gpt-4o`, `gpt-4o-mini`, `o1`), automatic prefix caching should
pass through — verify via the `prompt_tokens_details.cached_tokens`
field on the response. For non-OpenAI models (Llama, Mistral, Phi,
Cohere on GitHub Models), caching behavior is model/host-specific
and often absent.

**Batch.** **Not available** on GitHub Models as of writing. This is
the main gap vs hitting OpenAI or Azure directly — you lose the 50%
async discount entirely. If your workload is dominated by scheduled
batch processing, GitHub Models is a poor fit.

**Rate limits.** Tied to your Copilot subscription tier. Free tier
is tight; production volume needs a paid tier.

**Why use it.** Broader model selection (test Llama vs GPT-4o
without changing SDK), simplified billing (rolls into Copilot
subscription), and Microsoft data-residency story. Trade-off is no
Batch and tighter rate limits.

---

## Provider-agnostic techniques

The provider features above only matter after you've already shrunk
the input. These techniques apply regardless of which provider you
use, and most are higher-leverage than provider choice.

### 1. Pre-LLM compression

Cheapest savings — no API call, no model needed. For any text input
≥ a few thousand tokens, walk through:

**Structural drops (do first):**

- Remove generated / lock files from code diffs (`package-lock.json`,
  `yarn.lock`, `dist/`, `vendor/`, `*.min.*`, `*.snap`)
- Drop binary file contents, rename-only diffs, whitespace-only deltas
- Drop license / copyright headers in source files

**Lexical / signal-density compression (text):**

For transcripts (calls, dialogues, meeting recordings):

- **Filler words** — `(um|uh|er|ah|hmm|like|you know|i mean|kind of|
sort of|basically|actually)` when filler-shaped (word boundaries +
  punctuation bracketing)
- **Backchannels during one speaker's long turn** — drop short
  turns by another speaker that are only `(yeah|right|mhm|okay|got it|
sure|exactly|totally|makes sense)`
- **Stutter collapse** — `I-I-I think` → `I think`
- **Disfluency markers** — `[inaudible]`, `[crosstalk]`, `[laughter]`
- **Speaker-turn merge** — consecutive turns by same speaker collapse
- **Verbatim repetition** — same speaker repeats a sentence → keep
  once
- **Spoken-number normalization** — "four hundred fifty thousand
  dollars" → "$450,000" (3–5× token savings)

For code diffs:

- Collapse blank-line runs (`\n{3,}` → `\n\n`)
- Compress repeated assertion blocks — keep first 3, last 1, replace
  middle with `// [+N similar redacted]`
- Compress long inline string literals to head+tail
- Drop trailing-whitespace deletions
- Collapse 20+ imports to a summary line listing the dependencies

**Marker allowlist — protect domain-specific signal.** Filler regex
will eat tokens that _look_ like filler but carry meaning in your
domain. Pre-substitute marker phrases with sentinels before the
filler pass, then restore. Examples of domain markers worth
protecting:

- Sales: methodology terms (MEDDPICC, BANT), qualification markers
  (champion, decision criteria, next steps), objection markers, POC
- Support: severity codes (P0–P4), SLA, TTR/MTTR, RCA, escalation
- Engineering: domain-specific framework names, API endpoint names

Typical reduction: **30–50% on transcripts, 10–30% on code diffs**.
Deterministic, fast (regex-level), no quality loss when marker
allowlist is well-curated.

### 2. Two-stage pipelines

The single highest-leverage technique for genuinely large inputs.

**Stage 1 (cheap):** A small/fast model extracts a structured
"evidence card" from the raw artifact. Examples:

- From a 90-min call transcript: extract dealStage, objectionsRaised,
  customerPain, productFeaturesDiscussed, decisionCriteria,
  competitorsMentioned, nextSteps
- From a 5000-line PR diff: extract filesByCategory,
  dependencyChanges, newApis, refactorScope, testCoverage
- From a 100-page document: extract sections, keyEntities, citations

**Stage 2 (full model):** Consumes the evidence card (~500 tokens)
plus ≤3 verbatim excerpts (~1K tokens each) — total ~3K — instead
of the raw 30K-token input.

Cost arithmetic typically:

- Stage 1 on a cheap model (`gpt-4o-mini`, `claude-haiku`,
  `gemini-2.5-flash`): negligible per call
- Stage 2 on the expensive model: down from 30K to 3K tokens = 10×
  cheaper

Net: **5–10× cost reduction with minimal quality loss** because
Stage 1 catches the _what_ and Stage 2 just judges the _how_.

Practical shape:

```js
// Stage 1
const card = await cheapModel.create({
  messages: [{ role: "user", content: extractPrompt(rawArtifact) }],
  response_format: { type: "json_schema", json_schema: EvidenceCardSchema },
});

// Stage 2
const result = await expensiveModel.create({
  messages: [
    {
      role: "user",
      content: classifyPrompt({
        evidenceCard: card,
        excerpts: pickKeyExcerpts(rawArtifact, card.keyAnchors),
      }),
    },
  ],
});
```

The key design decision is what goes in the evidence card schema —
it has to capture everything Stage 2 might need. Iterate on the
schema by comparing Stage-2-from-card outputs vs Stage-2-from-raw
outputs on a held-out set.

### 3. Embedding-based retrieval (RAG)

When the input is too big even after compression, or when you have
a stable corpus you query against repeatedly: embed once, retrieve
top-K relevant chunks per query, send only those.

**Pattern:**

1. Chunk the corpus (semantic chunks, sentence-aware splits, ~500-
   token windows with overlap)
2. Embed each chunk via `text-embedding-3-small` or equivalent
3. Store vectors in a vector DB (Postgres + pgvector, Qdrant,
   Chroma, in-memory FAISS for small corpora)
4. At query time: embed the query, cosine-similarity vs corpus,
   take top-K (typically 5–20)
5. Send top-K chunks + query to the main LLM

**When this beats stuffing the full context:**

- Corpus > 100K tokens and queries touch only a small slice
- Multiple users querying the same corpus (amortize embedding cost)
- Need to cite specific sources (chunks come with provenance)
- Want sub-second retrieval (vector lookup is faster than 1M-token
  prompt processing)

**When stuffing wins (Gemini 2M, Claude 1M):**

- Need cross-document reasoning the LLM can do natively
- Corpus changes constantly (embedding re-runs become a tax)
- Latency tolerance is high (you're not user-facing)
- Corpus < 500K tokens and budget allows

**Hybrid retrieval.** Combine semantic (embedding) + keyword (BM25)
search. Embeddings catch paraphrase / conceptual similarity;
keywords catch exact-term recall (rare jargon, IDs, names). Most
production RAG uses both with score fusion.

**Reranking.** After retrieving top-50 by embedding, run a small
reranker model (Cohere Rerank, BGE-reranker) to score relevance more
precisely and pick top-5. Cheap and often improves quality more than
swapping LLMs.

### 4. Multi-call fan-out

Decompose one big call into many small ones, each handling a
sub-problem. Useful when:

- One call's combined input would exceed the context window
- You want failure isolation (one sub-call breaking doesn't taint
  the rest)
- Each sub-call has its own stable cacheable prefix

**Cost reality check** — fan-out is often _more_ expensive than a
single call, not less, because you pay the system-prompt + variable-
context overhead N times. Worth modeling before committing.

Example: classifying a code change against 12 candidate skills.

| Strategy                           | Calls | Input/call | Total input | Cost basis    |
| ---------------------------------- | ----- | ---------- | ----------- | ------------- |
| Single call, all 12 skills bundled | 1     | 13K        | 13K         | baseline      |
| Fan-out, 1 skill per call          | 12    | 5K each    | 60K         | 4.6× baseline |
| Cluster: 3 calls, ~4 skills each   | 3     | 7K each    | 21K         | 1.6× baseline |

Even with caching applied to all rows, the ranking is stable: fan-out
is the most expensive, single-call is cheapest, clustering is the
middle ground that bounds per-call size without paying full fan-out
overhead.

**When fan-out actually wins:**

- Total combined call would exceed context window (forcing function)
- Robustness / debuggability matters more than cost (high-stakes
  evaluations)
- Each sub-call's prefix is stable across many invocations, so
  cache hit rate is structurally near-100%

**Cluster pattern as a sweet spot.** Group related sub-problems
into 3–5 calls. Each call is bounded enough to fit alongside huge
inputs, each call's prefix is stable per cluster, cost penalty is
1.5–2× single-call instead of 4–5×.

### 5. Hierarchical summarization

When a single artifact is bigger than any reasonable window: chunk →
summarize each chunk → meta-summarize → answer on the meta.

**Map-reduce shape:**

```
[100K-token transcript]
  ↓ chunk into 5K-token windows
[20 chunks × 5K each]
  ↓ summarize each (parallel, cheap model)
[20 summaries × 500 tokens each = 10K total]
  ↓ meta-summarize OR query directly
[final answer]
```

**When this beats RAG:**

- Need a global picture, not a targeted lookup (e.g. "what were the
  3 most important decisions in this 4-hour meeting?")
- Cross-chunk reasoning required at the summary level

**When RAG beats this:**

- Most queries touch a small slice of the corpus
- Need exact spans / verbatim quotes

**Sliding-window variant.** For sequential data where order matters
(meetings, code review threads): summarize chunks with overlap, keep
a running "state" summary that gets updated as you move through the
content. Captures temporal flow that chunk-and-merge loses.

### 6. Application-level response cache

Provider-side caching is for prompt prefixes within a session.
**Application-side caching** is for the entire response keyed by
content hash — persisted, durable, provider-agnostic.

Pattern:

```js
const cacheKey = sha256(
  [
    promptTemplateVersion,
    modelName,
    taxonomyVersion, // whatever stable inputs feed the prompt
    artifactPayloadHash,
  ].join("|"),
);

const cached = await db.responseCache.findUnique({ where: { key: cacheKey } });
if (cached) return JSON.parse(cached.response);

const response = await llm.complete(prompt);
await db.responseCache.create({ data: { key: cacheKey, response: JSON.stringify(response) } });
return response;
```

**Why this matters:**

- **Re-runs are free.** Re-process the same artifact = zero LLM call
- **Idempotency.** Workflow retries don't double-bill
- **Audit trail.** Every response is traceable to a prompt+model+input tuple
- **Survives provider switches.** Cached responses persist when you
  change provider (with appropriate cache-busting on model change)

Storage cost is negligible — a few KB per response, hashed lookups.
For any system that re-processes artifacts (development iteration,
nightly re-classification, debugging) this is the highest-leverage
single move you can make. It's orthogonal to every other technique
above.

---

## Decision framework

Walk through these in order. Stop when you hit a "yes."

**1. Is the input ≤ 50K tokens after structural drops?**

- Just send it. Apply provider prompt caching on the stable parts of
  your prompt template; that's all the optimization you need.

**2. Is the input ≤ 200K tokens but you can extract structure cheaply?**

- Two-stage pipeline. Cheap-model evidence card → expensive-model
  final answer. Single biggest win for most workloads.

**3. Is the input bigger than that, but you only query slices of it?**

- RAG. Embed the corpus once, retrieve top-K per query. Combine with
  reranking for quality.

**4. Is the input bigger than that, and you need global reasoning?**

- Hierarchical summarization, OR Gemini's 2M context window if the
  workload doesn't justify the engineering.

**5. Is per-call cost the bottleneck (not context size)?**

- Provider caching (Claude > Gemini > OpenAI on discount magnitude).
- Batch API for any non-real-time path (OpenAI/Anthropic/Vertex).
- Application-level response cache if you re-process artifacts.

**6. Is per-call reliability the bottleneck?**

- Cluster-based fan-out (3–5 calls per artifact, not N=skills count).
- Pre-validate prompt size before each call; auto-fan-out on threshold.

---

## Pricing reference (approximate)

Snapshot rates — always check current provider pricing pages before
committing to a budget. Numbers below illustrate orders-of-magnitude
and discount ratios, not exact dollars.

| Model                | Input ($/M) | Cached ($/M)    | Output ($/M) | Context           |
| -------------------- | ----------- | --------------- | ------------ | ----------------- |
| OpenAI gpt-4o-mini   | $0.15       | $0.075          | $0.60        | 128K              |
| OpenAI gpt-4o        | $2.50       | $1.25           | $10.00       | 128K              |
| OpenAI gpt-4.1       | $2.00       | $0.50           | $8.00        | 1M                |
| OpenAI o3-mini       | $1.10       | $0.55           | $4.40        | 200K              |
| Anthropic Haiku 4.5  | $1.00       | $0.10 (90% off) | $5.00        | 200K              |
| Anthropic Sonnet 4.5 | $3.00       | $0.30           | $15.00       | 200K (1M variant) |
| Anthropic Opus 4     | $15.00      | $1.50           | $75.00       | 200K              |
| Gemini 2.5 Flash     | $0.30       | $0.075          | $2.50        | 1M                |
| Gemini 2.5 Pro       | $1.25       | $0.31           | $10.00       | 2M                |

**Batch discounts (where available):** -50% on top of the sync rates
above. Stacks with caching: cached + batched = 25% of sync input for
OpenAI, 5% of sync input for Anthropic.

**Embeddings (one-time per corpus):** OpenAI text-embedding-3-small
~$0.02/M tokens, text-embedding-3-large ~$0.13/M. Embedding cost is
almost always negligible vs the inference savings from RAG.

---

## Quick reference: which provider for which problem

- **Smallest possible cost on a stable corpus + many queries** →
  Anthropic + explicit caching (90% off), or OpenAI auto-cache if
  your prompts are structured for it
- **One absurdly huge document, one-shot read** → Gemini 2.5 Pro
  (2M context, no chunking ceremony)
- **Async batch over a fixed corpus** → OpenAI Batch + caching
  (cheapest stack: 75% off input)
- **Provider-agnostic, works on every model** → embedding-based RAG +
  app-level response cache (works regardless of upstream)
- **Need citations natively** → Claude with documents in the prompt,
  or Gemini with native PDF
- **Tight integration with a vendor stack** → Azure OpenAI (MS),
  Vertex AI (GCP), Bedrock (AWS) — same techniques apply, just
  different SDKs

---

## Anti-patterns

- **Stuffing everything into one prompt because the context window
  technically allows it.** Big window ≠ cheap call. A 500K-token
  call costs and behaves like a 500K-token call.
- **Re-fetching the same document into every call instead of
  caching it.** Multiplies cost linearly; obvious in retrospect.
- **Per-item fan-out without modeling cost.** Fan-out is often more
  expensive than single-call, not cheaper.
- **Building RAG when the corpus is < 50K tokens.** Stuff it in.
  RAG is engineering overhead that only pays back at scale.
- **Trusting "batch completed" to mean "every request succeeded".**
  Always reconcile success/failure files.
- **Caching the wrong prefix.** Putting variable content (user
  query, per-call ID) before stable content (system, reference docs)
  invalidates the cache on every call.
- **Skipping the marker allowlist before filler-word stripping.**
  Domain-specific jargon often _looks_ like filler. Pre-substitute
  with sentinels, then strip, then restore.

---

## Further reading

- OpenAI Cookbook: prompt caching, Batch API examples
- Anthropic docs: prompt caching, Message Batches, citations
- Google AI docs: context caching, batch prediction
- "Generative AI on AWS" (O'Reilly) — RAG patterns, eval
- "Designing Machine Learning Systems" (Chip Huyen) — pipeline shape

The shape of the system matters more than the model. Compression
beats context-window upgrades; two-stage pipelines beat single fat
calls; provider caching is a multiplier on top, not a substitute for
shrinking the input first.

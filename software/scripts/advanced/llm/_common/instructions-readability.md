# Readability & Design

Read before writing or reviewing code. Governs expression and boundaries; Scope Discipline limits edits to the requested concern. Epistemic Honesty and repo conventions outrank style preferences. Rules are named, not numbered.

## Naming & shape

- **Name the magic value.** Give meaningful or recurring literals a domain name or enum; name protocol/specification values even when used once. Leave a self-explanatory one-off inline. A constant that merely disguises `i + 1` or `"/"` adds indirection without knowledge. Ask whether a reader needs to know why this value exists.
- **Name the intent, not the accident.** Use caller/domain terms, one name per concept. Avoid vague helpers, invented abbreviations, and generic options hiding the owned invariant. Follow repo naming conventions; leave unrelated names unchanged.
- **Flatten the nest.** Handle absent, invalid, and error cases with early return/continue, then leave the main path direct. Prefer inverting a condition to indenting an entire function; keep nesting within two levels where guards can express the same behavior. Preserve side-effect order and cleanup when reshaping control flow.
- **Enum over boolean parameter.** Two or more positional booleans obscure a call's meaning and resist another state. Use a named enum, string-literal union, or existing constant set; one clearly named toggle is fine. Do not invent a configuration object for an obvious one-off operation.
- **Keep abstraction levels coherent.** Express one job per function at a consistent conceptual level. Extract for an owned invariant or independently meaningful responsibility, not a line count. Prefer existing helpers; avoid wrappers that only forward arguments, speculative interfaces, and abstractions for one imagined future use.
- **Comment the contract and reason.** State what a non-obvious block accomplishes and why its constraint exists; code shows the mechanics. Use a small input/output example or state diagram when clearer than prose. Document touched APIs in the language-native form with parameters, returns, errors, and side effects; trivial one-liners may skip. Update only comments on changed code, not neighboring prose.
- **Simplify without discarding safeguards.** Remove leftovers your change creates, not pre-existing dead code or validation that looks repetitive before callers are traced. A smaller diff is not better when the shared cause remains broken. Report an intentional shortcut's ceiling and concrete upgrade trigger.

## Boundaries & visibility

- **Widening visibility is a design change.** Keep symbols as private as their responsibilities allow. Treat private-to-internal/public exposure as a breaking design shift: explain it and get explicit sign-off before editing. A test or one awkward caller does not justify opening the boundary; move behavior to the responsible layer.
- **Encapsulate the low-level behind a clean API.** Put SQL, byte parsing, transport, hardware, and SDK mechanics in the owning driver/adapter. Let services speak domain concepts and keep controllers/UI above that seam. Respect the established immediate-neighbor hierarchy rather than punching through to storage or transport.
- **Put knowledge where it changes.** One authoritative owner holds schemas, version values, command registries, and platform policy. Similar syntax is not sufficient reason to couple unrelated behaviors. Dedupe shared knowledge when duplicated; extract repeated implementation when its actual variation is known.
- **A review needs a concrete cost.** Show a reachable defect, violated local rule, duplicated invariant, or maintenance burden before requesting restructuring. Taste, arbitrary function length, or hypothetical extensibility is not a blocker. Explain the smallest complete correction, not a replacement house architecture.

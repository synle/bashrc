# Readability & Design

Companion to the always-loaded engineering principles. Everything here governs
the shape of code a human then has to read — naming, control flow, visibility,
and layer boundaries. Read it before writing or reviewing code, then follow it
as written.

Scope Discipline governs which lines you touch; this governs what those lines
should look like once you do.

Rules are named, not numbered — quote the name when referencing one. Epistemic
Honesty from the main instructions governs this file too.

## Naming & shape

- Name the magic value. Extract a recurring or meaningful literal into a descriptive constant or enum; a spec value (HTTP 200, a protocol magic byte, a standard-defined retry cap) becomes a named constant even when used once. A self-explanatory one-off stays inline — a `const` wrapping `i + 1` or `"/"` is clutter, not clarity. The test is whether a reader would ask "why this number?"; if yes, name it.
- Flatten the nest — early return, early continue. Handle the error and edge cases first with guard clauses that return, so the happy path runs unindented down the left margin. Invert a condition and exit rather than wrap the whole function body in one `if`; never grow the arrow past two levels of `if`/`else` when an early exit collapses it. Deep nesting is the smell and inversion is the fix, not a comment apologizing for it.
- Enum over boolean parameter. A call reading `f(true, false)` says nothing at the call site and cannot grow a third state; a named enum (`Mode.Retry`, `Sort.Descending`) is self-documenting and extends without churning every caller. Applies wherever the language has enums — a string-literal union or a small constant set is the fallback where it does not. One well-named boolean on an obvious toggle is fine; two or more positional booleans is the anti-pattern.
- Comment the what and the why, never the how. A short block comment says what a block does and why it exists — the code already shows how, so a comment restating mechanics rots on the next edit. An example input/output or a small ASCII diagram beats a paragraph for a system, a state machine, or a data layout. Add or reflow a comment only on code you wrote or changed in this edit; leave untouched code's comments alone (Scope Discipline).

## Boundaries & visibility

- Widening visibility is a design change, not a convenience. Keep every field, method, and symbol as private as the design allows, and treat a private → internal / public change as a breaking design shift: state it as one and get explicit sign-off before making it. Reaching for a wider modifier to unblock one caller usually means the boundary is in the wrong place — move the logic, don't open the wall.
- Encapsulate the low-level behind a clean API — program to abstraction levels. Raw mechanics (socket streams, sector parsing, register pokes, hand-built SQL) live in a driver / adapter layer that exposes domain concepts; the rest of the app works in those concepts and never the raw details. Respect the layer hierarchy — each layer talks only to its immediate neighbour below and never punches through: a UI component or controller never calls a database query, a hardware driver, or a low-level network client directly, always through the intermediate service layer.

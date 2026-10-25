# Readability & Design

Read before writing or reviewing code. This governs naming, control flow,
visibility, and layer boundaries; Scope Discipline governs which lines to touch.

Rules are named, not numbered — quote the name when referencing one. Epistemic
Honesty from the main instructions governs this file too.

## Naming & shape

- Name the magic value. Give recurring or meaningful literals descriptive constants or enums. Name spec values even when used once: HTTP 200, protocol magic bytes, standard-defined retry caps. Keep self-explanatory one-offs inline, such as `i + 1` or `"/"`. If a reader would ask "why this number?", name it.
- Flatten the nest — early return, early continue. Handle errors and edge cases with guard clauses, leaving the happy path unindented. Invert conditions instead of wrapping whole bodies; keep `if`/`else` nesting within two levels when an early exit can flatten it.
- Enum over boolean parameter. Use named enums (`Mode.Retry`, `Sort.Descending`) instead of opaque positional flags such as `f(true, false)`; enums also accommodate additional states. Where enums are unavailable, use a string-literal union or small constant set. One well-named boolean on an obvious toggle is fine; avoid two or more positional booleans.
- Comment the what and the why, never the how. A short block comment says what a block does and why it exists — the code shows how, so a comment restating mechanics rots on the next edit. An example input/output or a small ASCII diagram beats a paragraph for a system, a state machine, or a data layout. Add or reflow a comment only on code you wrote or changed this edit; leave untouched code's comments alone (Scope Discipline).

## Boundaries & visibility

- Widening visibility is a design change, not a convenience. Keep fields, methods, and symbols as private as the design permits. Declare private → internal / public changes as breaking design shifts and obtain explicit sign-off first. Move misplaced logic instead of widening visibility to unblock one caller.
- Encapsulate the low-level behind a clean API — program to abstraction levels. Raw mechanics (socket streams, sector parsing, register pokes, hand-built SQL) live in a driver / adapter layer that exposes domain concepts; the rest of the app works in those concepts, never the raw details. Respect the layer hierarchy — each layer talks only to its immediate neighbour below, never punches through: a UI component or controller never calls a database query, a hardware driver, or a low-level network client directly, always through the intermediate service layer.

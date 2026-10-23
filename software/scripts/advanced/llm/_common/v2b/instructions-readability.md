# Readability & Design

Read before writing or reviewing code. This governs naming, control flow,
visibility, and layer boundaries; Scope Discipline governs which lines to touch.

Rules are named, not numbered — quote the name when referencing one. Epistemic
Honesty from the main instructions governs this file too.

## Naming & shape

- Name the magic value. Extract a recurring or meaningful literal into a descriptive constant or enum. Name spec values even when used once: HTTP 200, a protocol magic byte, or a standard-defined retry cap. A self-explanatory one-off stays inline — a `const` wrapping `i + 1` or `"/"` is clutter, not clarity. Test: would a reader ask "why this number?" If yes, name it.
- Flatten the nest — early return, early continue. Handle errors and edge cases with guard clauses, leaving the happy path unindented. Invert conditions instead of wrapping whole bodies; keep `if`/`else` nesting within two levels when an early exit can flatten it.
- Enum over boolean parameter. A call reading `f(true, false)` says nothing at the call site and cannot grow a third state. A named enum (`Mode.Retry`, `Sort.Descending`) documents itself and extends without churning every caller. Applies wherever the language has enums — a string-literal union or a small constant set is the fallback where it does not. One well-named boolean on an obvious toggle is fine; two or more positional booleans is the anti-pattern.
- Comment the what and the why, never the how. A short block comment says what a block does and why it exists — the code shows how, so a comment restating mechanics rots on the next edit. An example input/output or a small ASCII diagram beats a paragraph for a system, a state machine, or a data layout. Add or reflow a comment only on code you wrote or changed this edit; leave untouched code's comments alone (Scope Discipline).

## Boundaries & visibility

- Widening visibility is a design change, not a convenience. Keep every field, method, and symbol as private as the design allows. Treat a private → internal / public change as a breaking design shift. State that shift and get explicit sign-off before making it. Reaching for a wider modifier to unblock one caller usually means the boundary is in the wrong place — move the logic, don't open the wall.
- Encapsulate the low-level behind a clean API — program to abstraction levels. Keep raw mechanics in a driver / adapter layer that exposes domain concepts: socket streams, sector parsing, register pokes, and hand-built SQL. The rest of the app uses those concepts, never the raw details. Respect the layer hierarchy. Each layer talks only to its immediate neighbour below and never punches through. A UI component or controller never calls a database query, hardware driver, or low-level network client directly. Always use the intermediate service layer.

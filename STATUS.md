# STATUS — CharRiffle

Last updated: 2026-10-25

## What was built

A fully offline (file:// or served), zero-dependency web app for fiction writers
herding a growing cast of characters:

- **Name inventory** — first/last name, role (protagonist → cameo/placeholder list),
  first-appearance and last-appearance notes, story notes, and a search filter.
- **Name-clash warnings** — pairwise detection over the cast:
  - high: exact duplicate full names; one nickname mapped to two characters;
  - medium: first/surname near-misses (Levenshtein: distance 1, or 2 on long names),
    reversed twin names ("Ash Reed" vs "Reed Ash"), aliases shadowing another
    character's first or full name;
  - low (informational): shared first names, shared surnames, sound-alikes via
    soundex (Sean/Shawn, Katherine/Kathryn, Miller/Mueller).
- **Nickname & alias mapping** — alias chips per character plus an aliases tab:
  alias → formal name(s), shared aliases flagged.
- **Family-relationship sketch** — per-character relation editor (presets +
  custom labels, both directions shown) and a clickable SVG circle sketch with
  labeled edges.
- **Random-slot reriffle** — placeholder-name brainstorming: Classic (curated
  real-ish names) or Fantasy (syllable riff) styles, optional starting-letter
  filter, batch size 1–16, per-slot reriffle / pin / drop, promote-to-cast,
  "add all non-pinned". Slots that clash with the existing cast are flagged
  inline against real names.
- **Persistence** — everything under `localStorage` key `charriffle.v1`;
  Export/Import JSON backup; "Clear all data"; a sample cast loader for empty
  first runs. Guarded with a visible banner when storage is unavailable.
- `core.js` is a pure, environment-agnostic library (browser globals + Node
  `module.exports`) holding normalization, Levenshtein, soundex, clash
  detection, and the seeded name generator.
- `server.js` is an optional zero-dependency static server so `npm start`
  works offline.

## How to run

- `open index.html` (double-click works in most browsers), or
- `npm start` → http://localhost:8080, or
- `python3 -m http.server 8080`.

## How to test

- `npm test` (alias for `node --test tests/`) — 25 tests covering:
  - `tests/clash.test.js` — normalization (diacritics, punctuation,
    case), Levenshtein, spelling-similarity grading, classic soundex reference
    words (Robert/Rupert/Tymczak/Ashcraft), sound-alike grouping
    (Sean/Shawn, Katherine/Kathryn), duplicate-name high severity,
    similar first-name spellings, long-name near-misses, no-false-positive
    cases (Iris/Ivy, Anna+Carey vs Robert+"Anna Smith" ordering), shared
    first name severity, reversed twins, alias-shared, alias-shadow
    (first-name and full-name variants), distinctly-named cast producing zero
    warnings, empty/unamed cast handling, deterministic severity sorting, and
    per-type dedupe.
  - `tests/generator.test.js` — seeded determinism, capitalization/letters-only
    output, starting-letter filter, spread/variety, Math.random fallback.

## Verification results (2026-10-25)

- `node --check core.js app.js server.js` — clean.
- `npm test` — 25 pass / 0 fail.
- Served via bundled `server.js`: all files return HTTP 200.
- Headless-Chrome E2E harness (temporary, removed after the run) drove the real
  UI against a seeded cast: app boot + persistence, add-character form, saved
  state in localStorage, riffle batch/pin/reriffle, slot promotion to cast,
  clash warnings rendered (nickname collision, alias shadow, similar first
  names), per-card clash badges, aliases table with shared rows, family sketch
  SVG with labeled edges and node clicks. Result: **22/22 pass**.
- Fresh-profile boot check: empty state renders, storage-warning banner hidden.
- Repo grep for secrets/API keys/personal data: clean.

## Known gaps

- Clash detection is heuristic (edit distance + soundex). It favors recall on
  writer-relevant cases; "low" items can be deliberate and can be ignored.
- Export/Import JSON was reviewed but not exercised by the automated E2E
  harness (file-download/file-picker flows); the code path is guarded and
  sanitizes imports.
- The family sketch lays characters out on a circle, so very large casts
  (roughly 15+) get crowded labels.
- Edit history/undo is not provided; "Clear all data" and deletes ask for
  confirmation, but the export-once-in-a-while habit is the safety net.
- No explicit license header comments inside source files; the LICENSE and
  README carry the MIT copyright line: "Copyright (c) 2026 Asdale Dynamics, LLC".

# CharRiffle

An offline, local-first ledger for herding a growing cast of characters.
Pure HTML/JS/CSS — zero dependencies, no accounts, no network calls, no secrets.
It pairs naturally with the CLI companion `book-bible-audit-cli` for auditing
story-bible continuity once your cast is inventoried.

Built by [Asdale Dynamics, LLC](https://dylanasdale.github.io) — beginner-friendly
AI education, books, and practical local-first tools.

## What it does

- **Inventory** — every character with role, first/last-appearance notes, story notes, and a search box. Per-card clash badges show when a name needs a second look.
- **Clashes** — automatic name-conflict warnings:
  - *High*: exact duplicate names, and nicknames mapped to two different characters.
  - *Medium*: near-miss spellings (one edit apart), reversed twin names, and aliases that shadow another character's name.
  - *Low* (informational): shared first names, shared surnames, and sound-alikes (soundex comparison, e.g. Sean/Shawn, Miller/Mueller).
- **Aliases** — a nickname→formal-name mapping table, with shared aliases highlighted.
- **Family** — parent/child/sibling/custom relation editor plus a clickable SVG sketch of the web of ties.
- **Riffle** — placeholder-name brainstorming: spin batches (Classic real-ish or Fantasy riff), filter by starting letter, pin keepers, reriffle the rest, and promote winners straight into the cast. Slots that clash with existing cast members are flagged inline.

Everything persists to `localStorage` in your browser; **Export JSON** backs it up, **Import JSON** restores it.

## Run it

Option 1 — just open the file:

```
open index.html      # or double-click it in a file manager
```

Option 2 — serve it locally (recommended, keeps `localStorage` happy everywhere):

```
npm start            # http://localhost:8080  (uses the bundled zero-dependency server.js)
```

or

```
python3 -m http.server 8080
```

## Tests

Clash detection, name normalization, soundex, and the name generator are pure
functions in `core.js` with a zero-dependency Node test suite:

```
npm test
```

## Project layout

```
index.html      the whole UI
styles.css      warm, print-friendly-ish styling (light + dark mode)
core.js         pure library: clash detection, soundex, generator (browser + Node)
app.js          UI logic: tabs, editor, family sketch, riffle, localStorage
server.js       optional zero-dependency static server for `npm start`
tests/          Node built-in runner tests (`node --test`)
```

## Data and privacy

- All data lives in this browser's `localStorage` under the key `charriffle.v1`.
- No analytics, no fetches, no telemetry, no personal data.
- "Clear all data" wipes the ledger; "Export JSON" is your backup habit.

## Known trade-offs

- Clash warnings are heuristic (edit distance + soundex); they aim for good recall on writer-relevant cases, not linguistic perfection — "low" severity is informational and sometimes deliberate.
- The family sketch places characters on a circle; very large casts (15+) get crowded.
- Opening from `file://` works in most browsers, but a few block `localStorage` there — if you see the warning banner, switch to `npm start`.

## License

MIT — see [LICENSE](LICENSE). Copyright (c) 2026 Asdale Dynamics, LLC.

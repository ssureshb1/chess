# CLAUDE.md — Chunk Chess

Operational guide for working in this repo. **Read `REQUIREMENTS.md` first** —
it holds the pedagogy, the research, and the locked product decisions. This file
holds the engineering. Do not re-litigate decisions made in `REQUIREMENTS.md §0`.

---

## 1. What this is

A pattern-recognition trainer for one 6-year-old chess player. Two skills:
**spot the pattern** (chunks) and **see what's coming next** (anticipation).

It is a local-first web app on one Mac laptop. No accounts, no server, no cloud,
no cost. **This is permanent — do not add auth, sync, or a backend.**

## 2. Language: TypeScript, everywhere

One language for the entire stack. No Python, no Rust, no Go.

| Layer | Choice | Why |
|---|---|---|
| App | TypeScript + React 19 + Vite | The kid UI *is* the product. Fastest path to the animation and polish `REQUIREMENTS.md §10` demands. |
| Chess rules | `chess.js` v1.4 | Mature, 152k weekly downloads, native TS types. |
| Engine | `stockfish` v18 (WASM) | Ships a JS API, runs in a Web Worker. No native binary, no subprocess. |
| Build-time DB | **`node:sqlite`** (built into Node 24) | No native module, no `node-gyp`, no `better-sqlite3`. |
| Data files | `zstd` CLI (already installed) | Piped to the importer. No zstd npm package needed. |

**Why not Python?** `python-chess` is excellent, but the two critical
dependencies are JS-native, and the UI — the thing that has to be delightful —
is a browser problem. A Python backend would mean two languages and a worse
interface for no gain.

**Why no server at runtime?** See §4. The app is a static bundle.

## 3. Prerequisites — ALREADY MET

- **Node v24.21.0 (LTS)**, npm 11.19.0 — installed via `brew install node@24`
  and linked with `brew link --overwrite --force node@24`. Homebrew keg-onlys
  `node@24`; the link step is required or `node` is not on PATH. **Already
  done — do not reinstall.**
- **Verified working:** `node:sqlite` (create/insert/query, no experimental
  flag), the `zstd` CLI, and npm registry access.
- Also present: `git` 2.50.1, `zstd` 1.5.7, Homebrew 7.0.6.

Start at Phase 0 directly. No other setup is needed.

## 4. Architecture: build-time vs runtime

The single most important structural decision. Getting this wrong means
building a backend we explicitly don't want.

**Build time (Node, not shipped):**
- `import-puzzles` streams the Lichess CC0 puzzle dump, filters it, writes SQLite
- `build-sets` selects curated frozen puzzle sets from SQLite, emits static JSON
- `analyze-games` runs Stockfish over imported PGNs (Phase 3)

**Runtime (browser, static):**
- Puzzles are **static JSON**, generated at build time
- Attempt log, chunk state, collected creatures live in **IndexedDB**
- Zero network calls except the one-time Lichess import in Phase 3
- Works with the wifi off

This is possible *because the puzzle sets are frozen by design* — that's the
Woodpecker Method, not an accident. A repetition trainer needs addressable,
immutable puzzle sets, so there is nothing for a server to do at runtime.

**SQLite is a build-time tool only. The browser never talks to it.**

## 5. Repo layout

```
chess2/
├── CLAUDE.md              # this file
├── REQUIREMENTS.md        # product + pedagogy + locked decisions
├── package.json           # scripts, deps
├── tsconfig.json
├── vite.config.ts
├── index.html
├── data/                  # gitignored: 304MB dump + puzzles.db
├── scripts/               # build-time Node (tsx)
│   ├── import-puzzles.ts  # zstd -dc | node → SQLite
│   ├── build-sets.ts      # SQLite → public/sets/*.json
│   └── analyze-games.ts   # Stockfish, Phase 3
├── src/
│   ├── main.tsx
│   ├── chunks/            # curriculum.ts = the hand-authored chunk content
│   ├── board/             # Board, coords, click/drag
│   ├── modes/             # Learn, Spot, Solve, Call, Guard
│   ├── engine/            # woodpecker.ts — the cycle state machine
│   ├── store/             # IndexedDB wrapper
│   ├── parent/            # PIN-gated dashboard
│   └── audio/             # success sounds only
└── public/sets/           # generated — gitignored
```

## 6. Commands

```bash
npm run dev        # Vite dev server
npm run build      # typecheck + production build
npm run typecheck  # tsc --noEmit
npm run lint
npm test

# build-time pipeline (rare, offline)
zstd -dc data/lichess_db_puzzle.csv.zst | npm run import:puzzles
npm run build:sets
```

**`npm run lint` and `npm run typecheck` must pass before any phase is
considered done.** Do not report a phase complete without running both.

## 7. Hard rules

These come from parent decisions in `REQUIREMENTS.md §0` and the design
rationale. Do not "improve" on them.

1. **Never build a server, auth, accounts, or sync.** Local-first, permanent.
2. **Piece set is Cburnett.** Non-negotiable. It's the Lichess default, so
   positions look familiar to him.
3. **Never a negative sound.** Success chimes, fanfare on mastery. Errors are
   **silent** — visual correction only (glowing piece, friendly arrow, replay).
   Never add a buzzer, a "wrong" sound, or a red flash.
4. **Never punish.** No lives, no score decay, no visible error counts, no
   "you got 7/12." No timers visible to the kid until Tier 2.
5. **No session timer.** The unit of completion is the 12-puzzle set. Never
   interrupt a cycle — a half-finished cycle corrupts the Woodpecker timing
   data the whole method depends on.
6. **Never a random-puzzle mode.** Novelty is the failure mode we are fixing.
7. **Tiers unlock on measured transfer, never on a puzzle's rating.**
8. **The parent picks the set each session.** The scheduler *sorts by what's
   due* and informs; it does not auto-choose.
9. **No comments in code.** Names should carry the intent.
10. **Binding:** multiplayer, chat, tournaments, opening trainer, social,
    leaderboards, Chess960. Do not build these.

## 8. Build order — strict, gated

Do not build ahead. Each phase ends at its gate. The whole point of the
method is that repetition is the feature; shipping ahead of the gate ships a
version that *looks* like the product without training anything.

### Phase 0 — Foundations
Scaffold, Node install, SQLite + import pipeline, chunk schema, `chess.js`
wired, board renders and accepts moves.
**Gate:** a FEN renders correctly, a legal move can be made, `import-puzzles`
produces a filtered SQLite file with a sane row count, typecheck + lint pass.

### Phase 1 — The chunk trainer (the actual product)
LEARN / SPOT / SOLVE, the Woodpecker cycle engine, 12-puzzle sets, TTFM +
accuracy tracking, `§10` kid UI constraints, parent dashboard v1, creature
collection. Tiers 0–1 only.
**Gate:** he can complete a full 12-puzzle cycle end to end, the celebration
plays, and TTFM + accuracy are recorded and visible to the parent. **Ship the
celebration animation before the dashboard** — if he doesn't like it, nothing
else matters.

### Phase 2 — Transfer test + CALL mode
The transfer test and counter-examples. This is what makes chunking real
rather than assumed, and it is the difference between training and memorising
12 positions. CALL ships behind a per-chunk toggle, enabled on 2–3 Tier 1
chunks — observe, then decide.
**Gate:** a chunk cannot reach "solid" without passing transfer.

### Phase 3 — His own games
Lichess import, Stockfish blunder detection, "turn this into a drill," GUARD
mode. Splits into a silent daily feed and a weekly parent review view.
**Gate:** a real game of his imports, a missed mate is flagged, and one click
turns it into a drill.

### Phase 4 — Maintenance + expansion
Expanding-interval recall, Tiers 2–3, endgame track, practice games.

## 9. Gotchas already researched — don't rediscover these

- **The Lichess puzzle API cannot be used.** `GET /api/puzzle/next` and
  `/api/puzzle/batch/{angle}` require OAuth `puzzle:read`, return *random,
  never-before-seen* puzzles, and their `difficulty` is **relative to the
  authenticated user's rating** — there is no rating band and no bulk puzzle-ID
  fetch. Lichess documents: *"DO NOT use this endpoint to enumerate puzzles for
  mass download."* A repetition trainer requires a frozen, addressable set.
  **Use the CC0 database instead.**
- **Puzzle DB URL — the path is at the root, not `/puzzle/`:**
  `https://database.lichess.org/lichess_db_puzzle.csv.zst` (304 MB, 6.1M rows,
  CC0). The `/puzzle/` subpath 404s; this cost time once already.
- **Columns:** `PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags,DailyDate`.
  `Moves` is UCI. `Themes` is space-separated.
- **Filter:** `Rating` 800–1300, `Popularity` > 90, `NbPlays` > 200,
  `Themes` ∩ the motif list.
- **Do not download `lichess_db_eval.jsonl.zst`** — it is **22 GB**. Run
  Stockfish ourselves.
- **`node:sqlite` is a release candidate** (Node 24.15+), not stable. Fine for
  a build-time script. If it misbehaves, fall back to `better-sqlite3` — but
  try the built-in first, it has no native build step.
- **Lichess Personal Access Token** is created at
  `lichess.org/account/oauth/token`. The app must prompt for it in settings,
  never hardcode it. Needed only in Phase 3.

## 10. Conventions

- TypeScript strict mode. No `any`. No non-null assertions without a comment-
  free justification via a guard.
- Chess-domain types are explicit: `Fen`, `UciMove`, `SanMove`, `PieceSquare`.
  Do not pass raw strings around.
- The chunk curriculum in `src/chunks/curriculum.ts` is **hand-authored
  content, not generated**. It is the heart of the product — see
  `REQUIREMENTS.md §4`. Every chunk needs a `tell`, 3–5 `counterExamples`, a
  creature, and a `kidName` readable aloud to a 6-year-old in under 10 seconds.
- Tests: unit-test the Woodpecker cycle state machine and the transfer-test
  gate. They are the rules engine; everything else is UI.
- No comments. Type it.

## 11. Definition of done, per phase

- `npm run typecheck` and `npm run lint` pass clean
- The phase gate in §8 is met **in the real app**, not in a test
- No item from §7 has been violated
- Anything discovered that contradicts `REQUIREMENTS.md` is raised with the
  parent **before** being implemented, not after

# Requirements — "Chunk Chess" (working title)

A pattern-recognition trainer for one 6-year-old, sub-1000, on a laptop.
Two skills: **spot the pattern** and **see what's coming next**.

---

## 0. Locked decisions

Answered by the parent. These are settled — don't re-open them in review.

| # | Decision | Consequence for the build |
|---|---|---|
| 1 | **Level:** plays real games, loses to basic tactics | Tier 0 is a *brief* warmup, not the main course. **Tier 1 is the primary target.** Puzzle filter favours rating 800–1300. |
| 2 | **Piece set:** Cburnett | Non-negotiable. It's the Lichess default, so positions look familiar. Block on no other set. |
| 3 | **Deployment:** this Mac laptop only | Local-first. Static app + a SQLite file. **No server, no accounts, no cloud, no cost.** Works offline. |
| 4 | **Session length: no cap — finish the set** | See §10. The *set size* is the unit of completion; there's no artificial timer. Soft-stop advisory only. |
| 5 | **Sound:** on for success, **silent on errors** | No buzzer, ever. Wrong answers get visual-only feedback, which must still be clear and warm. |
| 6 | **CALL mode:** try early, decide later | Build it, but expose a per-chunk toggle. Enable on 2–3 Tier 1 chunks, observe, then decide. |
| 7 | **Rewards:** collect a creature per chunk | Each chunk has a character. Collecting it = chunk went solid. This generalises the mascot-per-chunk idea in §10. |
| 8 | **Drill selection:** the parent picks each time | See §7 and §11. The scheduler *surfaces what's due* and sorts it, but the parent chooses. Informed picking, not automation. |
| 9 | **Real games:** both — app drills daily, parent reviews weekly | Phase 3 splits into a silent daily drill feed and a weekly review session. |

**Decisions 4 and 8 shift the product away from full automation toward a
parent-in-the-loop design.** At 6, a parent's judgment about what to drill beats
a pure algorithm. The scheduler informs the choice rather than making it.

---

## 1. The problem, stated precisely

He plays on Lichess and does not improve from it. Why:

- Lichess puzzle streaks feed **novelty** (a new puzzle every time). High volume,
  low retention. He sees thousands of tactics and remembers almost none of them.
- There is no concept of a **motif**. He may solve 500 knight-fork puzzles
  without ever being told "that shape is called a fork, and it looks like *this*."
- He gets no feedback on the thing that actually matters: **how fast** he
  recognised it. Accuracy alone can be 100% while recognition is slow.
- Nothing ties his training to **his own games**, so the patterns never fire
  in a real position.

The goal is not "solve more puzzles." It is to build a **vocabulary of visual
patterns that fire automatically**, and then prove they transfer.

---

## 2. Why this works (the theory we're betting on)

**Chunking.** de Groot (1946) showed masters perceive positions as small
meaningful constellations, not 32 loose pieces. Chase & Simon (1973) and
Gobet & Simon (1996) refined this: experts hold tens of thousands of these
chunks in long-term memory, and recognising a chunk *suggests good moves*
automatically, freeing working memory for verification. Gobet & Simon also
found the ~2-second inter-chunk boundary is robust and chunks have real
psychological reality.

**Repetition beats novelty.** The Woodpecker Method (Smith & Tikkanen): one
*fixed* set, solved repeatedly, each cycle faster, ~7 cycles, done when the set
is solvable in a single day. Deliberately sacrifices breadth for depth.

**Retrieval practice beats recognition.** For memory that survives, you must
*produce* the answer from an empty board, not choose it from options. This is
why "blind-call the opponent's reply" (his favourite of the three he picked)
is the single highest-value drill in the app.

**Spaced spacing.** Kang et al. (2014): expanding-interval retrieval produces
equal long-run recall to equal-interval, but *much* higher average recallability
across the whole training period. Rawson & Dunlosky (2011): aim for ~3 correct
recalls then 3 widely-spaced relearnings.

**The one thing nobody measures: transfer.** A kid can ace a drilled set by
memorising 12 positions. That is not a chunk. The only honest test is a
**fresh** puzzle of the same motif. This app treats transfer as the primary
progress metric. (See §7.)

---

## 3. Landscape — what to steal, what to avoid

| Product | Verdict |
|---|---|
| **Chess.com / ChessKid** | Good kid UX, **no repetition model**, locked behind Gold, and it teaches *random* puzzles — the exact failure mode. Borrow the tone, not the method. |
| **ChessWoodie / ChessPecker / Chessigma** | Real Woodpecker implementation, real cycle/PPM tracking. But targeted at **800–2200 adults**. Too many puzzles, too much text, no kid layer, no parent dashboard. Closest thing to what we're building. |
| **ChessTempo / Chessable** | MoveTrainer spaced repetition is excellent — but built for *opening/endgame line memorisation*, i.e. recall of facts, not visual patterns. Different problem. |
| **Lichess puzzle themes** | 64 well-defined motif tags with authoritative descriptions. **Use these as the motif taxonomy.** Free and already consistent. |
| **Lichess DB (`lichess_db_puzzle.csv.zst`)** | 6.1M rated, themed puzzles. **CC0 licensed** — download, filter, index, redistribute. This is our puzzle supply. |
| **Stockfish 18 (`stockfish` npm)** | WASM, runs in a browser worker. Gives us eval, best lines, blunder detection with **no server and no API keys**. |

**Avoid copying:** opening-line memorisation. US Chess is explicit that for
beginners it "may be detrimental to their play in the long run," and it
crowds out the pattern work. Out of scope until he's much stronger.

---

## 4. The Chunk model (the core data structure)

A chunk is **not a puzzle**. It is a *pattern family* with a perceptual
signature. This is the thing he memorises; puzzles are just the
instruments used to hammer it in.

```
Chunk {
  id                  "fork"
  tier                1
  kidName             "Sticky Fork"          <- what a 6yo calls it
  glyph               knight icon
  oneLiner            "One knight, two targets"   <- max 6 words
  tell                "Knight is 2 jumps from a piece,
                       that piece is next to the king,
                       nothing guards the knight"
                       <- THE thing being memorised: a *visual signature*
  response            "Jump the knight, win the piece"
  counterExamples[]   positions that look like this but aren't
                       <- see below, this is load-bearing
  prerequisites[]     ["hangingPiece"]
  puzzleIds[]         curated from Lichess DB
  gameSourcedIds[]    mined from HIS OWN games
}
```

**Why `counterExamples` matters.** A kid who learns "knight near king = fork"
will hang knights all over the board. Every chunk ships with 3–5 positions
that satisfy the naive rule but are *wrong*, and drills specifically on telling
them apart. This is the single most-skipped thing in existing trainers and it
is the difference between learning a pattern and learning a superstition.

**Why `tell` is separate from `oneLiner`.** The name is for talking about it.
The tell is the *perceptual trigger*. Recognition happens on the tell, before
any name is available. We train the tell.

---

## 5. Curriculum — motif tiers for age 6 / sub-1000

Only ~10 chunks in play at once. New tier unlocks only when the previous
tier is solid on the **transfer** test (§7), not the drilled set.

**Tier 0 — Foundation (warmup only — he's past needing this as the main course)**
Per decision 1 he already plays full games, so Tier 0 is a *brief* orientation
run, roughly the first two sessions, then it retires into a warmup slot:
- `takeTheFreePiece` — an undefended piece is there to be taken
- `queenMate` — drive the king to the edge
- `checkIsNotMate` — the distinction, drilled specifically

**Tier 1 — THE PRIMARY TARGET.** He plays real games and loses to exactly
these. Expect this tier to occupy the first 2–3 months.
- `hangingPiece` · `knightFork` · `backRankMate`

**Tier 2 — The core motif set**
- `pin` · `skewer` · `discoveredAttack` · `doubleAttack` ·
  `trapThePiece` · `mateIn2`

**Tier 3 — Needs real calculation**
- `deflection` · `clearance` · `interference` · `xRayAttack` ·
  `sacrifice` · `quietMove`

**Tier 4 — Deferred until rating >1400.** Endgame chunks
(`opposition`, `squareRule`, `shoulderTheKing`) become a separate track,
backed by Lichess tablebase for ground truth.

Mapping to Lichess theme tags: `hangingPiece`, `fork`, `backRankMate`, `pin`,
`skewer`, `discoveredAttack`, `doubleCheck`, `trappedPiece`, `mateIn2`,
`deflection`, `clearance`, `interference`, `xRayAttack`, `sacrifice`,
`quietMove`.

---

## 6. Modes

| Mode | What it does | Why |
|---|---|---|
| **LEARN** | Introduces one new chunk. 3 puzzles only. The `tell` is *shown* — glow the king, glow the target, draw the arrow. Narration + sound. | 3 is small enough to survive age 6. Never more. |
| **SPOT** | "Can you find a fork here?" Doesn't require playing the move. Click the fork. | Pure chunk retrieval, zero calculation load. Separates "sees the pattern" from "can calculate the pattern." |
| **SOLVE** | Normal solving, motif name hidden. | The real test. |
| **CALL** | He makes his move. Board **stops**. "Now what does Black do?" He must produce Black's best reply before anything is revealed. | *Anticipation training.* The core of "see what's coming next." Correct / close (loses ≤ 100cp) / wrong. |
| **GUARD** | Position shown. "What is Black threatening?" → he must name it → then stop it. | Trains *defensive* recognition. Offence is learned faster than defence; this closes the gap. |
| **RECALL** | Spaced review of chunks whose interval has come due. | Retention between cycles. Expanding intervals per Kang et al. |

**CALL is the flagship mode.** It is the only drill in the app that forces
genuine recall of an unstated plan, and it maps exactly to what he's missing
in real games: he plays his own idea and then has no idea what comes back.

---

## 7. The Woodpecker engine (scaled for a 6-year-old)

The book says 200–1000 puzzles per set. That is impossible here. Scaled down:

- **Set size: 12 puzzles**, drawn from one chunk (or one tight tier).
- **Cycle = one pass through all 12**, timed, with per-puzzle records.
- **Cycle 1** — no clock pressure. Accuracy gate ≥ 80%.
- **Cycles 2+** — target is to **halve the total cycle time**.
- **PROMOTED TO "SOLID"** when 3 consecutive cycles hit **≥ 90% accuracy AND
  ≤ 50% of cycle-1 time**.
- **Then the transfer test** (§8). Solid is provisional until transfer passes.
- **Then maintenance** — expands to 1, 3, 7, 16, 35 days.

**Who chooses the set (decision 8).** The parent picks, from the dashboard,
every session. So the app is not a black box that decides. But the picker's
default sort is **by what's due** — chunks whose recall interval has elapsed
float to the top, chips going stale are visibly flagged, and solid chunks
requiring maintenance are separated from never-drilled ones. The parent
therefore makes an *informed* choice without the app taking over.

A real risk with manual selection: he'll pick the same easy chunk forever and
never progress. The dashboard counters this by showing each chunk's cycle
count and TTFM trend side by side, and by flagging a chunk that has been
drilled 5+ cycles without improving. He can still drill whatever he wants —
it's just never *invisible*.

**Metrics that matter** (in priority order):

1. **TTFM** — time to first move. This *is* recognition. Accuracy is nearly
   irrelevant without it.
2. **Transfer rate** — % of fresh, unseen puzzles of a chunk solved within
   target TTFM. The only honest measure of chunking.
3. **Accuracy per chunk**, rolling.
4. **Cycles to solid** per chunk.
5. **Recall latency** in CALL mode.

**Deliberately excluded from the kid's view:** puzzle rating, streaks with
punishment, leaderboards, "you got 7/12." A 6-year-old gets a creature and a
celebration. Complexity goes behind a parent PIN.

---

## 8. Transfer test — the feature that makes this honest

Once a chunk is "solid" on its drilled set of 12:

1. Pull 3 **fresh** puzzles of that chunk that were never in the set, at the
   same rating band.
2. Include 2 of the chunk's `counterExamples` as controls.
3. Measure TTFM vs. the chunk's target.
4. **Pass** = solves the fresh ones fast AND correctly rejects the counter-examples.

Fail → the chunk goes back to drilling with the counter-examples rotated in.
This is what stops the app from becoming a very elaborate way to memorise 12
positions, which is exactly the failure mode of every existing trainer.

---

## 9. "See what's coming next" module

Three features, in build order. All three were selected by the parent.

**9.1 CALL mode** — in-app, no data needed. See §6. Ship first.

**9.2 Engine blunder-check on his real games**
- Import his Lichess games (`GET /api/games/user/{username}` with a Personal
  Access Token; games owned by the token, or public games by username).
- Run Stockfish 18 in a browser worker over every position.
- Flag three categories, in priority order:
  - **Missed mate in 1 / 2** — the most motivating, and the most learnable
  - **Hung a piece** — eval dropped ≥ 200cp without compensation
  - **Missed a winning capture**
- One click: *"turn this moment into a drill."* It becomes a 1-puzzle chunk
  in his `gameSourcedIds` set, weighted into his next session.
- This closes the loop from his real play back into pattern training, and it's
  the part that will keep him motivated: the mistakes are *his*.

**9.3 Spot-the-threat warmups (GUARD)** — see §6.

**9.4 Deferred — engine lines with arrows.** After a practice game, show the
top-3 engine replies per position, animated. Useful but he will not use it at
6; build at ~10+. Flagged so we don't build it now.

---

## 10. Kid UI constraints

- **No session timer. He finishes the set.** (Decision 4.) The bound is the
  *unit of work* — 12 puzzles — not a clock. At 20–40s a puzzle that's a
  natural 4–8 minute session that ends on a completed set and a celebration,
  which is a far better ending than an interrupt.
  - **Soft-stop only:** if a single session somehow runs past ~20 minutes, the
    app offers a "that's enough for today" card on the home screen. It never
    blocks, never counts down, never ends the session for him.
  - *Why the original 12-minute hard cap was dropped:* a forced cutoff in the
    middle of puzzle 9 of 12 teaches that stopping is the goal, and leaves the
    cycle incomplete — which corrupts the Woodpecker timing data the whole
    method depends on. A half-finished cycle is a broken cycle.
- **No reading required.** Motif name is spoken and shown as a glyph. Max six
  words of text anywhere.
- **Big everything.** Large squares, click to move on laptop, no drag precision
  needed. Piece set is fixed to Cburnett (decision 2).
- **Sound: success only, never errors.** (Decision 5.) Right = chime. Chunk
  mastered = fanfare. **Wrong = silence** — no buzzer, no negative tone, ever.
  Wrong answers are corrected with motion and colour: the intended piece glows,
  a friendly arrow shows the move, the position replays. He learns from the
  visual, and a 6-year-old never hears that he failed. A mute toggle for
  success sounds sits in the corner.
- **Never punish.** Wrong answer → immediate warm correction + replay the same
  position. No lives, no score decay, no "you got it wrong 4 times."
- **No timers visible on early cycles.** Time is *measured* for the parent,
  never shown to him, until Tier 2.
- **Collect a creature per chunk.** (Decision 7.) Every chunk owns a character
  — "Sir Fork", "Pin the Pinned" — and he **collects** it when the chunk goes
  solid on the transfer test. Collected creatures live on the home screen. This
  is the reward, the memory hook, and the visible record of progress, all in
  one. Naming the chunk's character *is* naming the pattern, which is why this
  is training and not decoration.
- **One-tap exit** back to a simple home screen. Never trap him in a session.

## 11. Parent dashboard (PIN-gated)

- **Set picker, sorted by what's due** — this is the primary control (decision
  8). Due chips first, stale ones flagged, never-drilled separated from
  maintenance. Each shows cycle count, TTFM trend, transfer result.
- Per-chunk heatmap: TTFM trend, accuracy, cycles to solid, transfer result
- Per-chunk **CALL mode toggle** (decision 6) — try it on 2–3 chunks, watch,
  then switch on or off permanently
- Assign/remove chunks; adjust target TTFM; force a re-test
- Session history: what he actually did, how long, when
- **Weekly game review view** (decision 9) — the human-facing half of the
  Phase 3 import. His blunders grouped by week with a one-click "drill these
  now", designed to be opened *together* on the couch, not daily.
- **Export:** the whole thing is his data, dumpable as JSON/CSV

---

## 12. Technical architecture

**Shape (decision 3): local-first web app on one Mac laptop.** No accounts, no
cloud, no per-seat cost, no deployment. The trainer is a static app that runs
offline. A Node process is used at build time for the puzzle import pipeline
and for Stockfish game analysis; neither is needed at runtime.

This is the simplest thing that fully works. It also means **no auth, no
multi-user, and no sync** are needed — remove them from scope permanently.

**Stack**
- `chess.js` v1.4 — move gen, legality, FEN, PGN. Mature, 150k+ weekly downloads.
- `stockfish` v18 (WASM) — eval + best lines. Runs in a Web Worker.
- Frontend: React + Vite + TypeScript. Board: `chessboard.js` or a thin
  custom SVG/DOM board (a custom board gives us the highlight/glyph layer
  needed for the `tell` visualisation, which no off-the-shelf board supports).
  Piece set is fixed to **Cburnett** (decision 2).
- Storage: build-time **SQLite** via Node's built-in `node:sqlite` (Node 24).
  `better-sqlite3` is only a fallback if `node:sqlite` misbehaves — it needs
  `node-gyp`, so avoid it. The browser never touches SQLite: it reads the
  pre-built static JSON sets, and keeps the attempt log in IndexedDB.
- Board interaction: click-to-move primary, drag as an enhancement.

**Puzzle data pipeline (one-time, ~5 min)**
- Stream + decompress `https://database.lichess.org/lichess_db_puzzle.csv.zst`
  (304 MB compressed, **CC0**).
- Columns: `PuzzleId, FEN, Moves, Rating, RatingDeviation, Popularity, NbPlays,
  Themes, GameUrl, OpeningTags`.
- Filter: `Rating` **800–1300** (narrowed from 600–1500 per decision 1 — he
  plays real games and loses to *basic* tactics, so the band sits low),
  `Popularity` > 90, `NbPlays` > 200, `Themes` ∩ our motif list.
- **Move-count window per tier.** Solved by measurement, not taste. In the
  filtered set, Lichess's `oneMove` tag is exactly the 2-ply puzzles
  (194,195 rows, 100% in both directions) and `short` is exactly the 4-ply
  ones, so ply count subsumes both tags. A 6-year-old must never be handed a
  forced single move at Tier 1, but *is* meant to be handed one at Tier 0.
  - **Tier 0 — 2–4 plies.** `takeTheFreePiece` genuinely *is* one move.
  - **Tier 1 — 4–6 plies.** Excludes all 194k `oneMove` giveaways. Two moves
    is recognition; three is the edge of his band.
  - **Tier 2 — 4–8.** Tier 3 — 6+.
  - A window, not just a floor: 8+ ply is real calculation and belongs to
    Tier 3, not a frustrated Tier 1 session.
- **The motif must be on move 1, verified — never inferred from the theme
  tag.** This is the most important lesson in the pipeline, and it was learned
  the expensive way. Lichess theme tags describe features *present in a
  position*, not the shape of its *solution*. Row `0082f` is tagged `mateIn1`
  but its first move is `axb3`, a pawn capture with no check and no mate; the
  mate is the opponent's move on ply 2. The tags are also mechanically tied to
  ply count — `mateIn1` ⟺ exactly 2 plies, `mateIn2` ⟺ exactly 4 — so the
  motif always lands on the **last** ply. A solver only ever plays move 1, so
  tag-based selection cannot be trusted to put the motif in front of him.

  Every selected puzzle is therefore checked against a per-chunk **move-1 motif
  predicate**, and rejected if it fails. Measured yield of those predicates:

  | chunk | move-1 test | pool | pass |
  |---|---|---|---|
  | `hangingPiece` | captures an undefended piece | 23,026 | 46.8% |
  | `takeTheFreePiece` | captures an undefended piece | 24,731 | 40.0% |
  | `knightFork` | a knight move hitting 2 pieces | 158,892 | 4.8% |
  | `checkIsNotMate` | gives check but is not mate | 397,154 | 0.32% |
  | `queenMate` | mate by the queen | 397,154 | 0.00% |
  | `backRankMate` | mates a king on its back rank | 29,580 | 0.00% |

  The two zeros are **structural, not a bug**: Lichess emits no 1-ply puzzles.
  A mating first move ends the game, so the line would be one ply, and those do
  not exist in the dump. The side to move in a `mateIn1`-tagged position is the
  one *being* mated — scanning every legal move of 9,000 such positions found a
  mating move in 0.0% of them. So the two mate chunks are **hand-authored**
  (`src/chunks/curatedPuzzles.ts`), checked in beside the hand-authored
  counter-examples and held to the same predicates by the same tests. The other
  four are mined, and have 100–1000× more candidates than the 15 each set needs.

  The 30 curated puzzles were not hand-typed. Each was found by enumerating the
  legal moves of a bare position and keeping the ones that are checkmate, then
  re-verified. Two rules came out of building them:
  - **The two sets share no position and no piece.** `queenMate` owns every
    queen mate, so `backRankMate` is rook-only; otherwise a single board would
    appear in two sets with two different names.
  - **No answer repeats more than twice in a set.** An early draft was fifteen
    puzzles whose answer was all `Ra8#`, which teaches one trick rather than
    "find the back rank". A test now fails the build if any answer appears three
    times or if a set has fewer than five distinct answers.

  A curated puzzle has no Lichess rating, so its `rating` is a **synthetic
  difficulty ladder** (800 → 1150, rising with index) used only by the parent
  dashboard, exactly as §7 requires of ratings. It is labelled as synthetic in
  the source rather than being passed off as a real rating.

  Because a mating line is 1 ply, the two curated chunks report a **1–1 ply
  window** in the manifest instead of the tier window, rather than pretending a
  1-ply line falls inside a 2–4 ply window.

  Side note found while authoring: a rank-1 "back rank" mate of a *black* king
  does not work, because black pawns on rank 2 can interpose on rank 1. Pawns on
  rank 7 can never reach rank 8, so the rank-8 pattern is the real one — and the
  rank-1 version only works when a *black* rook mates a *white* king. Both
  chunks are built from the ranks where the pattern is actually sound.
- Every puzzle that reaches a set is re-verified as playable from its own FEN.
  That is free at 90 puzzles and was only sampled 1-in-50 at import.
- Result: a few hundred thousand rows → SQLite. Indexed by
  `(theme, rating_bucket, popularity)`. Measured: 6,100,953 rows in → 736,331
  kept. Zero unplayable solutions in a 1-in-50 sample.

**Why not the Lichess puzzle API** — this was researched and is decisive:
- `GET /api/puzzle/next` and `/api/puzzle/batch/{angle}` require OAuth
  `puzzle:read`, and return **random, never-before-seen** puzzles.
- `difficulty` is **relative to the authenticated user's puzzle rating** — there
  is no way to request a specific rating band, and no way to request *specific*
  puzzle IDs in bulk.
- Lichess explicitly documents: *"DO NOT use this endpoint to enumerate puzzles
  for mass download."*

A repetition trainer **requires a frozen, deterministic, addressable set**.
The API cannot provide one. The CC0 database can. Hence: build our own index.

**Also rejected:** the `lichess_db_eval.jsonl.zst` dump is **22 GB**. We run
Stockfish ourselves instead — better, offline, and no download.

---

## 13. Phasing

**Phase 0 — Foundations.** Repo scaffold, SQLite + import pipeline, chunk
schema, `chess.js` wired, board renders and accepts moves.

**Phase 1 — The chunk trainer (the actual product).** LEARN / SPOT / SOLVE
modes, the Woodpecker cycle engine, the 12-puzzle sets, TTFM + accuracy
tracking, the kid UI constraints of §10, parent dashboard v1. *Tiers 0–1 only.*
This is the version that could replace his Lichess puzzle routine.

**Phase 2 — Transfer test + CALL mode.** Makes chunking real rather than
assumed. Also counter-example drills. CALL ships behind a per-chunk toggle,
enabled on 2–3 Tier 1 chunks (decision 6).

**Phase 3 — His own games.** Lichess import, Stockfish blunder detection,
"turn this into a drill," GUARD mode. Splits into a **silent daily feed** and
a **weekly parent review view** (decision 9).

**Phase 4 — Maintenance + expansion.** Expanding-interval recall, Tiers 2–3,
endgame track, practice games vs. engine.

**Explicitly not building:** multiplayer, chat, tournaments, opening trainer,
social, leaderboards, Chess960.

---

## 14. Risks

| Risk | Mitigation |
|---|---|
| **He decides he doesn't like it** | Biggest risk by far. Phase 1 must be fun within 30 seconds of opening. Ship the celebration animation before the dashboard. |
| **He memorises positions instead of patterns** | The transfer test (§8) exists precisely for this. It's the release gate for any chunk. |
| **Lichess API / token friction** | Puzzle data is fully local from the CC0 dump — no API dependency for core training. Game import is a separate, degradable feature. |
| **Puzzle ratings don't match his Lichess rating** | Ratings are noisy and from a different population. Chunks unlock on *measured* transfer, not on the puzzle's rating. |
| **Stockfish eval in-browser is slow for long games** | Cap analysis depth, run in a worker, only import games played since last import, do it in the background. |
| **Scope creep into a full chess platform** | §13 "not building" list is binding. |
| **A 6yo's attention is finite** | Mitigated by decision 4: the 12-puzzle set is the unit of completion, and a cycle is never left half-finished. Watch the first few sessions and adjust set size before adding any timer. |
| **Manual selection stalls progress** | Decision 8 accepts this risk by choice. Countered by the due-sorted picker, side-by-side TTFM trends, and a flag on chunks drilled 5+ cycles without improving. |
| **Silent-on-errors removes the signal** | He still *sees* the correction (glowing piece, friendly arrow, replay). Visual feedback is unambiguous; the silence is the kindness. Verify in the first session that he registers the correction. |

---

## 15. Open questions — RESOLVED

All six were answered and folded into §0. No open questions remain for
Phase 0. See §0 for the locked table and §10/§11 for how each one was
implemented.

Answers that are *not* blockers but will need a real decision later:

- **Lichess username for game import** (Phase 3). Only needed then. Create the
  Personal Access Token at `lichess.org/account/oauth/token`; the app should
  prompt for it in settings rather than it being hardcoded.
- **Creature designs** (Phase 1). Names are placeholders. Plain SVG or emoji
  stand-ins are fine for v1 — get the collection mechanic working first.
- **Exact `tell` wording per chunk.** The descriptions in §4 are the design
  intent; each needs a final pass to be readable aloud to a 6-year-old in
  under ten seconds.

---

## Appendix — sources

- de Groot (1946/1978), *Thought and Choice in Chess* — chunks as "large complexes"
- Chase & Simon (1973), *Perception in Chess*, Cognitive Psychology 4:55–81
- Gobet & Simon (1996), *Expert Chess Memory: Revisiting the Chunking Hypothesis*; (1996) *Recall of Random and Distorted Chess Positions*
- Smith & Tikkanen — *The Woodpecker Method* (Quality Chess / Chess.com)
- Kang, Lindsey, Mozer, Pashler (2014), *Retrieval practice over the long term* — expanding vs. equal-interval spacing
- Rawson & Dunlosky (2011), *Optimizing schedules of retrieval practice* — 3 recalls then 3 relearnings
- Gobet, Lane, Croker et al. (2001), *Chunking mechanisms in human learning*, Trends in Cognitive Sciences
- lichess.org API reference — `/api/puzzle/next`, `/api/puzzle/batch/{angle}` (OAuth `puzzle:read`)
- database.lichess.org — puzzle + eval dumps, CC0
- US Chess, *Tips on Teaching Beginners* — don't memorise openings; calculate the opponent's replies
- Competitor reviews: ChessWoodie, ChessPecker, Chessigma, ChessKid, ChessTempo, Chessable

import { readFileSync, readdirSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import {
  firstMoveContext,
  isHandAuthoredChunkId,
  nonMoverKingIsInCheck,
  parseSolution,
  motifPredicateFor,
  plyWindowForChunk,
  replaySolution,
  requiredThemesFor,
  type CuratedHandAuthoredChunkId,
} from '../scripts/set-selection'
import { CURATED_MATE_PUZZLES } from '../src/chunks/curatedPuzzles'

import { curriculum } from '../src/chunks/curriculum'
import type { ChunkId, ChunkTier } from '../src/chunks/schema'
import { ratingBucket } from '../scripts/puzzle-filter'

type SetPuzzle = {
  readonly id: string
  readonly fen: string
  readonly moves: string
  readonly rating: number
  readonly popularity: number
  readonly plies: number
}

type SetFile = {
  readonly version: number
  readonly chunkId: ChunkId
  readonly tier: ChunkTier
  readonly minPlies: number
  readonly maxPlies: number
  readonly drilled: readonly SetPuzzle[]
  readonly transfer: readonly SetPuzzle[]
}

const DIR = 'public/sets'
const failures: string[] = []

function check(condition: boolean, message: string): void {
  if (!condition) failures.push(message)
}

const manifest = JSON.parse(readFileSync(`${DIR}/manifest.json`, 'utf8')) as {
  version: number
  drilledPerSet: number
  transferPerSet: number
  sets: readonly {
    chunkId: ChunkId
    tier: ChunkTier
    minPlies: number
    maxPlies: number
    drilled: number
    transfer: number
    file: string
  }[]
}

const files = readdirSync(DIR).filter((name) => name !== 'manifest.json').sort()
check(files.length === 6, `expected 6 set files, found ${files.length}`)
check(manifest.sets.length === 6, `expected 6 manifest entries, found ${manifest.sets.length}`)

const db = new DatabaseSync('data/puzzles.db', { readOnly: true })
const allIds = new Set<string>()
const chunkById = new Map(curriculum.map((chunk) => [chunk.id, chunk]))

for (const entry of manifest.sets) {
  const set = JSON.parse(readFileSync(`${DIR}/${entry.file}`, 'utf8')) as SetFile
  const chunk = chunkById.get(entry.chunkId)
  if (chunk === undefined) {
    failures.push(`manifest chunk ${entry.chunkId} is not in the curriculum`)
    continue
  }

  check(set.version === 1, `${entry.chunkId}: version ${set.version}`)
  check(set.chunkId === entry.chunkId, `${entry.chunkId}: chunkId mismatch`)
  check(set.tier === chunk.tier, `${entry.chunkId}: tier ${set.tier} != curriculum ${chunk.tier}`)

  const window = plyWindowForChunk(chunk.id, chunk.tier)
  check(set.minPlies === window.minPlies, `${entry.chunkId}: minPlies ${set.minPlies}`)
  check(set.maxPlies === window.maxPlies, `${entry.chunkId}: maxPlies ${set.maxPlies}`)
  check(entry.minPlies === window.minPlies, `${entry.chunkId}: manifest minPlies`)
  check(entry.maxPlies === window.maxPlies, `${entry.chunkId}: manifest maxPlies`)

  check(set.drilled.length === 12, `${entry.chunkId}: ${set.drilled.length} drilled, want 12`)
  check(set.transfer.length === 3, `${entry.chunkId}: ${set.transfer.length} transfer, want 3`)
  check(entry.drilled === set.drilled.length, `${entry.chunkId}: manifest drilled count`)
  check(entry.transfer === set.transfer.length, `${entry.chunkId}: manifest transfer count`)

  const all = [...set.drilled, ...set.transfer]
  const ids = all.map((puzzle) => puzzle.id)
  check(new Set(ids).size === ids.length, `${entry.chunkId}: id repeated inside the set file`)

  for (const id of ids) {
    check(!allIds.has(id), `${entry.chunkId}: id ${id} also appears in another set file`)
    allIds.add(id)
  }

  const buckets = new Map<number, number>()
  let pliesLo = Infinity
  let pliesHi = -Infinity
  let ratingLo = Infinity
  let ratingHi = -Infinity

  for (const puzzle of all) {
    const label = `${entry.chunkId}/${puzzle.id}`

    // A hand-authored puzzle has no database row, so it is checked against the
    // curated source instead of the mine.
    if (isHandAuthoredChunkId(entry.chunkId)) {
      const curated = CURATED_MATE_PUZZLES[entry.chunkId as CuratedHandAuthoredChunkId].find(
        (row) => row.id === puzzle.id,
      )
      if (curated === undefined) {
        failures.push(`${label}: not present in src/chunks/curatedPuzzles.ts`)
        continue
      }
      check(curated.fen === puzzle.fen, `${label}: fen differs from the curated source`)
      check(curated.moves === puzzle.moves, `${label}: moves differ from the curated source`)
      check(curated.rating === puzzle.rating, `${label}: rating differs from the curated source`)
      check(
        curated.popularity === puzzle.popularity,
        `${label}: popularity differs from the curated source`,
      )
      check(curated.plies === puzzle.plies, `${label}: plies differs from the curated source`)
    } else {
      const row = db
        .prepare('SELECT fen, moves, rating, popularity, move_count FROM puzzles WHERE id = ?')
        .get(puzzle.id) as
        | { fen: string; moves: string; rating: number; popularity: number; move_count: number }
        | undefined
      if (row === undefined) {
        failures.push(`${label}: not present in data/puzzles.db`)
        continue
      }
      check(row.fen === puzzle.fen, `${label}: fen differs from the database row`)
      check(row.moves === puzzle.moves, `${label}: moves differ from the database row`)
      check(row.rating === puzzle.rating, `${label}: rating differs from the database row`)
      check(row.popularity === puzzle.popularity, `${label}: popularity differs from the database row`)
      check(row.move_count === puzzle.plies, `${label}: plies differs from the database row`)
    }

    check(
      puzzle.plies >= window.minPlies && puzzle.plies <= window.maxPlies,
      `${label}: ${puzzle.plies} plies outside ${window.minPlies}-${window.maxPlies}`,
    )
    check(
      parseSolution(puzzle.moves).length === puzzle.plies,
      `${label}: moves string length ${parseSolution(puzzle.moves).length} != plies ${puzzle.plies}`,
    )

    const opening = replaySolution(puzzle.fen, [])
    if (opening === null) {
      failures.push(`${label}: FEN does not parse`)
    } else if (nonMoverKingIsInCheck(opening)) {
      failures.push(`${label}: side not to move is in check`)
    }

    const replayed = replaySolution(puzzle.fen, parseSolution(puzzle.moves))
    if (replayed === null) failures.push(`${label}: solution does not replay from its own FEN`)

    // A mined puzzle has to carry a Lichess tag for its chunk; that tag is only
    // a candidate filter, which is why the motif is checked separately below. A
    // curated puzzle has no tags, so the motif is the whole requirement.
    if (isHandAuthoredChunkId(entry.chunkId)) {
      const predicate = motifPredicateFor(entry.chunkId)
      const context = firstMoveContext(puzzle.fen, parseSolution(puzzle.moves))
      check(
        context !== null && predicate !== undefined && predicate(context),
        `${label}: move 1 does not show the ${entry.chunkId} motif`,
      )
    } else {
      const required = requiredThemesFor(entry.chunkId)
      const themes: string[] = []
      for (const themeRow of db
        .prepare('SELECT theme FROM puzzle_themes WHERE puzzle_id = ?')
        .iterate(puzzle.id)) {
        const theme = themeRow['theme']
        if (typeof theme === 'string') themes.push(theme)
      }
      check(
        themes.some((theme) => (required as readonly string[]).includes(theme)),
        `${label}: carries none of ${required.join('/')} (has ${themes.join(' ')})`,
      )
      const predicate = motifPredicateFor(entry.chunkId)
      const context = firstMoveContext(puzzle.fen, parseSolution(puzzle.moves))
      if (predicate !== undefined) {
        check(
          context !== null && predicate(context),
          `${label}: move 1 does not show the ${entry.chunkId} motif`,
        )
      }
    }

    pliesLo = Math.min(pliesLo, puzzle.plies)
    pliesHi = Math.max(pliesHi, puzzle.plies)
    ratingLo = Math.min(ratingLo, puzzle.rating)
    ratingHi = Math.max(ratingHi, puzzle.rating)
  }

  for (const puzzle of set.drilled) {
    const bucket = ratingBucket(puzzle.rating)
    buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1)
  }
  for (const [bucket, count] of buckets) {
    check(count <= 6, `${entry.chunkId}: rating bucket ${bucket} holds ${count} drilled puzzles, cap is 6`)
  }

  const table = [
    entry.chunkId.padEnd(18),
    `T${entry.tier}`.padEnd(4),
    `${window.minPlies}-${window.maxPlies}`.padEnd(6),
    (pliesLo === pliesHi ? `${pliesLo}` : `${pliesLo}-${pliesHi}`).padEnd(9),
    (ratingLo === ratingHi ? `${ratingLo}` : `${ratingLo}-${ratingHi}`).padEnd(11),
    `${set.drilled.length}`.padEnd(9),
    `${set.transfer.length}`.padEnd(10),
    [...buckets.entries()].sort().map(([b, c]) => `${b * 100}s:${c}`).join(' '),
  ].join(' ')
  console.log(table)
}

db.close()

console.log('')
console.log(`total puzzles across all sets: ${allIds.size}`)
if (failures.length > 0) {
  console.error(`FAILED with ${failures.length} problems:`)
  for (const failure of failures) console.error(`  ${failure}`)
  process.exitCode = 1
} else {
  console.log('OK: 12 drilled + 3 transfer per set, no overlap, all plies in window, all FENs replay')
}

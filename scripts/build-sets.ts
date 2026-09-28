import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { DatabaseSync, type SQLOutputValue } from 'node:sqlite'
import { argv, exit } from 'node:process'
import { curriculum } from '../src/chunks/curriculum'
import { CURATED_MATE_PUZZLES } from '../src/chunks/curatedPuzzles'
import type { Chunk, ChunkId, ChunkTier } from '../src/chunks/schema'
import { IMPORT, puzzleDbPath, ratingBucket, type MotifTheme } from './puzzle-filter'
import {
  CHUNK_THEME_REQUIREMENTS,
  DRILLED_PER_SET,
  REJECTION_REASONS,
  TRANSFER_PER_SET,
  emptyRejectionCounts,
  isCuratedChunkId,
  isHandAuthoredChunkId,
  nonMoverKingIsInCheck,
  parseSolution,
  plyWindowForChunk,
  replaySolution,
  requiredThemesFor,
  selectChunkSet,
  selectCuratedChunkSet,
  type CuratedHandAuthoredChunkId,
  type RejectionCounts,
  type Candidate,
  type RejectionReason,
  type Selection,
  type SetPuzzle,
} from './set-selection'

const SET_FILE_VERSION = 1
// A motif predicate can reject almost everything: `checkIsNotMate` keeps about
// 0.3% of its pool, so a thin fetch starves it. 2000 per rating bucket is a
// 10,000-candidate window, which clears the 15 needed even at that yield while
// staying fast enough to re-verify every candidate.
const CANDIDATES_PER_RATING_BUCKET = 2000
const DEFAULT_OUT_DIR = 'public/sets'

// REQUIREMENTS.md §7: puzzle rating is for the parent dashboard only and must
// never reach the kid UI, so the kid-facing loader has to drop it explicitly.

type Options = {
  readonly dbPath: string
  readonly outDir: string
  readonly chunkId: ChunkId | null
}

function parseOptions(): Options {
  let dbPath = puzzleDbPath
  let outDir = DEFAULT_OUT_DIR
  let chunkId: ChunkId | null = null

  const args = argv.slice(2)
  for (let index = 0; index < args.length; index++) {
    const flag = args[index]
    const value = args[index + 1]
    if (flag === '--db' && value !== undefined) {
      dbPath = value
      index++
    } else if (flag === '--out' && value !== undefined) {
      outDir = value
      index++
    } else if (flag === '--chunk' && value !== undefined) {
      if (!isCuratedChunkId(value)) throw new Error(`Unknown chunk "${value}"`)
      chunkId = value
      index++
    } else {
      throw new Error(`Unknown flag "${flag ?? ''}"`)
    }
  }

  return { dbPath, outDir, chunkId }
}

type SqlRow = Record<string, SQLOutputValue>

const THEME_SLOTS = '?, ?'

function themeList(themes: readonly string[]): string {
  return themes.map(() => '?').join(', ')
}

function readText(row: SqlRow, column: string): string {
  const value = row[column]
  if (typeof value !== 'string') throw new Error(`Expected text in column "${column}"`)
  return value
}

function readNumber(row: SqlRow, column: string): number {
  const value = row[column]
  if (typeof value !== 'number') throw new Error(`Expected number in column "${column}"`)
  return value
}

const CANDIDATE_SQL = `
  SELECT p.id            AS id,
         p.fen           AS fen,
         p.moves         AS moves,
         p.rating        AS rating,
         p.popularity    AS popularity,
         p.move_count    AS plies,
         GROUP_CONCAT(pt.theme) AS themes
    FROM puzzles p
    JOIN puzzle_themes pt ON pt.puzzle_id = p.id
   WHERE pt.theme IN (${THEME_SLOTS})
     AND pt.rating_bucket = ?
     AND p.move_count BETWEEN ? AND ?
   GROUP BY p.id
   ORDER BY p.popularity DESC, p.rating ASC, p.id ASC
   LIMIT ?
`

function toCandidate(row: SqlRow): Candidate {
  return {
    id: readText(row, 'id'),
    fen: readText(row, 'fen'),
    moves: readText(row, 'moves'),
    rating: readNumber(row, 'rating'),
    popularity: readNumber(row, 'popularity'),
    plies: readNumber(row, 'plies'),
    themes: readText(row, 'themes').split(','),
  }
}

function candidateBuckets(): readonly number[] {
  const lowest = ratingBucket(IMPORT.minRating)
  const highest = ratingBucket(IMPORT.maxRating)
  return Array.from({ length: highest - lowest + 1 }, (_, index) => lowest + index)
}

// A flat top-N window would sit entirely inside the lowest rating bucket,
// because the order is rating-ascending — leaving the per-bucket cap nothing to
// balance against. Fetching a bounded prefix per rating bucket and re-sorting
// the union with the same key keeps the global order exact while guaranteeing
// every bucket is represented.
function loadCandidates(
  db: DatabaseSync,
  themes: readonly MotifTheme[],
  minPlies: number,
  maxPlies: number,
): Candidate[] {
  const sql = CANDIDATE_SQL.replace(THEME_SLOTS, themeList(themes))
  const statement = db.prepare(sql)
  const candidates: Candidate[] = []
  for (const bucket of candidateBuckets()) {
    for (const row of statement.iterate(
      ...themes,
      bucket,
      minPlies,
      maxPlies,
      CANDIDATES_PER_RATING_BUCKET,
    )) {
      candidates.push(toCandidate(row))
    }
  }
  return candidates
}

const POOL_SQL = `
  SELECT p.move_count AS plies
    FROM puzzles p
    JOIN puzzle_themes pt ON pt.puzzle_id = p.id
   WHERE pt.theme IN (${THEME_SLOTS})
   GROUP BY p.id
`

function countPool(
  db: DatabaseSync,
  themes: readonly MotifTheme[],
  minPlies: number,
  maxPlies: number,
): { total: number; inWindow: number } {
  const sql = POOL_SQL.replace(THEME_SLOTS, themeList(themes))
  let total = 0
  let inWindow = 0
  for (const row of db.prepare(sql).iterate(...themes)) {
    total++
    const plies = readNumber(row, 'plies')
    if (plies >= minPlies && plies <= maxPlies) inWindow++
  }
  return { total, inWindow }
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

type ManifestEntry = {
  readonly chunkId: ChunkId
  readonly tier: ChunkTier
  readonly minPlies: number
  readonly maxPlies: number
  readonly drilled: number
  readonly transfer: number
  readonly file: string
}

function toSetFile(selection: Selection): SetFile {
  return {
    version: SET_FILE_VERSION,
    chunkId: selection.chunkId,
    tier: selection.tier,
    minPlies: selection.window.minPlies,
    maxPlies: selection.window.maxPlies,
    drilled: selection.drilled,
    transfer: selection.transfer,
  }
}

function pliesRange(puzzles: readonly SetPuzzle[]): string {
  if (puzzles.length === 0) return '-'
  let lo = puzzles[0]?.plies ?? 0
  let hi = lo
  for (const puzzle of puzzles) {
    lo = Math.min(lo, puzzle.plies)
    hi = Math.max(hi, puzzle.plies)
  }
  return lo === hi ? String(lo) : `${lo}-${hi}`
}

function ratingRange(puzzles: readonly SetPuzzle[]): string {
  if (puzzles.length === 0) return '-'
  let lo = puzzles[0]?.rating ?? 0
  let hi = lo
  for (const puzzle of puzzles) {
    lo = Math.min(lo, puzzle.rating)
    hi = Math.max(hi, puzzle.rating)
  }
  return lo === hi ? String(lo) : `${lo}-${hi}`
}

function pad(text: string, width: number): string {
  return text.length >= width ? text : text + ' '.repeat(width - text.length)
}

function padStart(text: string, width: number): string {
  return text.length >= width ? text : ' '.repeat(width - text.length) + text
}

function assertRejectionsMatchSelection(counts: RejectionCounts): void {
  for (const reason of REJECTION_REASONS) {
    const value = counts[reason]
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`Rejection counter "${reason}" is not a count: ${String(value)}`)
    }
  }
}

function main(): void {
  const options = parseOptions()

  if (!existsSync(options.dbPath)) {
    throw new Error(`Puzzle database not found: ${options.dbPath}. Run npm run import:puzzles first.`)
  }

  const chunks = curriculum.filter((chunk): chunk is Chunk => chunk.id in CHUNK_THEME_REQUIREMENTS)
  const selected =
    options.chunkId === null ? chunks : chunks.filter((chunk) => chunk.id === options.chunkId)

  mkdirSync(options.outDir, { recursive: true })
  const db = new DatabaseSync(options.dbPath, { readOnly: true })

  const claimedIds = new Set<string>()
  const manifest: ManifestEntry[] = []
  const rows: string[] = []
  const poolRows: string[] = []
  const totals: Record<RejectionReason, number> = emptyRejectionCounts()
  let poolTotal = 0
  let poolInWindow = 0
  let candidatesScanned = 0

  for (const chunk of selected) {
    const window = plyWindowForChunk(chunk.id, chunk.tier)
    const curated = isHandAuthoredChunkId(chunk.id)
    const puzzles = curated ? CURATED_MATE_PUZZLES[chunk.id as CuratedHandAuthoredChunkId] : []

    // The pool report describes where a set's puzzles came from: the mine for a
    // mined chunk, the hand-authored list for the two mate chunks.
    const pool = curated
      ? { total: puzzles.length, inWindow: puzzles.length }
      : countPool(db, [...requiredThemesFor(chunk.id)], window.minPlies, window.maxPlies)
    const candidates: Candidate[] = curated
      ? puzzles.map((puzzle) => ({
          id: puzzle.id,
          fen: puzzle.fen,
          moves: puzzle.moves,
          rating: puzzle.rating,
          popularity: puzzle.popularity,
          plies: puzzle.plies,
          themes: [],
        }))
      : loadCandidates(db, [...requiredThemesFor(chunk.id)], window.minPlies, window.maxPlies)

    const selection = curated
      ? selectCuratedChunkSet({
          chunkId: chunk.id as CuratedHandAuthoredChunkId,
          tier: chunk.tier,
          puzzles,
          claimedIds,
          drilledCount: DRILLED_PER_SET,
          transferCount: TRANSFER_PER_SET,
        }).selection
      : selectChunkSet({
          chunkId: chunk.id,
          tier: chunk.tier,
          window,
          requiredThemes: [...requiredThemesFor(chunk.id)],
          candidates,
          claimedIds,
          drilledCount: DRILLED_PER_SET,
          transferCount: TRANSFER_PER_SET,
        })
    assertRejectionsMatchSelection(selection.rejections)

    if (!selection.complete) {
      throw new Error(
        `Could not fill set for "${chunk.id}": ${selection.drilled.length}/${DRILLED_PER_SET} drilled, ` +
          `${selection.transfer.length}/${TRANSFER_PER_SET} transfer, ${candidates.length} candidates scanned`,
      )
    }

    const chosen = [...selection.drilled, ...selection.transfer]
    for (const puzzle of chosen) assertSolvable(chunk.id, puzzle)

    const file = `${chunk.id}.json`
    writeFileSync(`${options.outDir}/${file}`, `${JSON.stringify(toSetFile(selection), null, 2)}\n`)

    for (const id of selection.claimedIds) claimedIds.add(id)
    for (const reason of REJECTION_REASONS) totals[reason] += selection.rejections[reason]
    poolTotal += pool.total
    poolInWindow += pool.inWindow
    candidatesScanned += candidates.length

    manifest.push({
      chunkId: chunk.id,
      tier: chunk.tier,
      minPlies: window.minPlies,
      maxPlies: window.maxPlies,
      drilled: selection.drilled.length,
      transfer: selection.transfer.length,
      file,
    })

    rows.push(
      [
        pad(chunk.id, 18),
        padStart(String(chunk.tier), 4),
        padStart(`${window.minPlies}-${window.maxPlies}`, 7),
        padStart(pliesRange(chosen), 7),
        padStart(ratingRange(chosen), 11),
        padStart(String(selection.drilled.length), 7),
        padStart(String(selection.transfer.length), 8),
        padStart(String(candidates.length), 9),
        padStart(String(selection.scanned), 9),
      ].join('  '),
    )

    poolRows.push(
      [
        pad(chunk.id, 18),
        padStart(String(pool.total), 10),
        padStart(String(pool.inWindow), 11),
        padStart(String(pool.total - pool.inWindow), 13),
      ].join('  '),
    )
  }

  db.close()

  writeFileSync(
    `${options.outDir}/manifest.json`,
    `${JSON.stringify(
      {
        version: SET_FILE_VERSION,
        drilledPerSet: DRILLED_PER_SET,
        transferPerSet: TRANSFER_PER_SET,
        sets: manifest,
      },
      null,
      2,
    )}\n`,
  )

  const header = [
    pad('chunkId', 18),
    padStart('tier', 4),
    padStart('plies', 7),
    padStart('plyRange', 7),
    padStart('ratingRange', 11),
    padStart('drilled', 7),
    padStart('transfer', 8),
    padStart('cands', 9),
    padStart('scanned', 9),
  ].join('  ')

  const poolHeader = [
    pad('chunkId', 18),
    padStart('poolTotal', 10),
    padStart('inPlyWindow', 11),
    padStart('outOfWindow', 13),
  ].join('  ')

  console.log('')
  console.log(`puzzle sets built from ${options.dbPath}`)
  console.log(header)
  console.log('-'.repeat(header.length))
  for (const row of rows) console.log(row)
  console.log('')
  console.log('candidate pool vs the tier ply window (SQL pre-filter)')
  console.log(poolHeader)
  console.log('-'.repeat(poolHeader.length))
  for (const row of poolRows) console.log(row)
  console.log(
    `  ${pad('all', 18)} ${padStart(String(poolTotal), 10)} ${padStart(String(poolInWindow), 11)} ` +
      `${padStart(String(poolTotal - poolInWindow), 13)}`,
  )
  console.log('')
  console.log('quality-floor rejections at selection time')
  for (const reason of REJECTION_REASONS) {
    console.log(`  ${pad(reason, 24)} ${padStart(String(totals[reason]), 8)}`)
  }
  console.log(`  ${pad('candidatesFetched', 24)} ${padStart(String(candidatesScanned), 8)}`)
  console.log('')
  console.log(`wrote ${manifest.length} set files + manifest.json to ${options.outDir}`)
}

function assertSolvable(chunkId: ChunkId, puzzle: SetPuzzle): void {
  const replayed = replaySolution(puzzle.fen, parseSolution(puzzle.moves))
  if (replayed === null) throw new Error(`Selected puzzle ${puzzle.id} for "${chunkId}" does not replay`)
  if (nonMoverKingIsInCheck(replayed)) {
    throw new Error(`Selected puzzle ${puzzle.id} for "${chunkId}" has the non-moving side in check`)
  }
}

try {
  main()
} catch (error: unknown) {
  process.stderr.write(`${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`)
  exit(1)
}

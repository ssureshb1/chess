import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { existsSync, rmSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { createInterface } from 'node:readline'
import { performance } from 'node:perf_hooks'
import { argv, exit, stdin, stdout } from 'node:process'
import { asFen, asUci, type UciMove } from '../src/chess/types'
import { Position } from '../src/chess/position'
import {
  matchingThemes,
  parseRow,
  passesFilter,
  puzzleDbPath,
  ratingBucket,
  type RawRow,
} from './puzzle-filter'

const SCHEMA = `
PRAGMA journal_mode = OFF;
PRAGMA synchronous = OFF;

CREATE TABLE puzzles (
  id              TEXT    PRIMARY KEY,
  fen             TEXT    NOT NULL,
  moves           TEXT    NOT NULL,
  rating          INTEGER NOT NULL,
  rating_deviation INTEGER NOT NULL,
  popularity      INTEGER NOT NULL,
  plays           INTEGER NOT NULL,
  move_count      INTEGER NOT NULL,
  game_url        TEXT    NOT NULL,
  opening_tags    TEXT    NOT NULL
) WITHOUT ROWID;

CREATE TABLE puzzle_themes (
  puzzle_id     TEXT    NOT NULL,
  theme         TEXT    NOT NULL,
  rating_bucket INTEGER NOT NULL,
  popularity    INTEGER NOT NULL,
  PRIMARY KEY (puzzle_id, theme)
) WITHOUT ROWID;
`

const INDEXES = `
CREATE INDEX idx_puzzle_themes_lookup
  ON puzzle_themes (theme, rating_bucket, popularity DESC, puzzle_id);
CREATE INDEX idx_puzzles_rating ON puzzles (rating);
`

type Options = {
  readonly dbPath: string
  readonly dump: string | null
  readonly limit: number | null
  readonly verifyEvery: number
  readonly quiet: boolean
}

function parseOptions(): Options {
  let dbPath = puzzleDbPath
  let dump: string | null = null
  let limit: number | null = null
  let verifyEvery = 50
  let quiet = false

  const args = argv.slice(2)

  for (let index = 0; index < args.length; index++) {
    const flag = args[index]
    const value = args[index + 1]
    if (flag === '--db' && value !== undefined) {
      dbPath = value
      index++
    } else if (flag === '--dump' && value !== undefined) {
      dump = value
      index++
    } else if (flag === '--limit' && value !== undefined) {
      limit = Number.parseInt(value, 10)
      index++
    } else if (flag === '--verify-every' && value !== undefined) {
      verifyEvery = Math.max(0, Number.parseInt(value, 10))
      index++
    } else if (flag === '--quiet') {
      quiet = true
    } else {
      throw new Error(`Unknown flag "${flag ?? ''}"`)
    }
  }

  return { dbPath, dump, limit, verifyEvery, quiet }
}

type Counters = {
  lines: number
  header: number
  kept: number
  droppedRating: number
  droppedPopularity: number
  droppedPlays: number
  droppedThemes: number
  droppedMalformed: number
  droppedDuplicate: number
  verified: number
  droppedIllegal: number
}

function emptyCounters(): Counters {
  return {
    lines: 0,
    header: 0,
    kept: 0,
    droppedRating: 0,
    droppedPopularity: 0,
    droppedPlays: 0,
    droppedThemes: 0,
    droppedMalformed: 0,
    droppedDuplicate: 0,
    verified: 0,
    droppedIllegal: 0,
  }
}

function classifyDrop(row: RawRow): keyof Counters | null {
  if (row.rating < 800 || row.rating > 1300) return 'droppedRating'
  if (row.popularity <= 90) return 'droppedPopularity'
  if (row.plays <= 200) return 'droppedPlays'
  if (matchingThemes(row).length === 0) return 'droppedThemes'
  return null
}

function parseMoves(raw: string): readonly UciMove[] | null {
  const tokens = raw.trim().split(/\s+/).filter((token) => token.length > 0)
  if (tokens.length < 2 || tokens.length % 2 !== 0) return null
  const moves: UciMove[] = []
  for (const token of tokens) {
    try {
      moves.push(asUci(token))
    } catch {
      return null
    }
  }
  return moves
}

function solutionIsPlayable(fen: string, moves: readonly UciMove[]): boolean {
  try {
    const position = new Position(asFen(fen))
    for (const move of moves) position.makeUci(move)
    return true
  } catch {
    return false
  }
}

function openSource(dump: string | null): AsyncIterable<string> {
  if (dump === null) {
    if (stdin.isTTY) throw new Error('No input. Pipe the dump in, or pass --dump <path.zst>')
    return createInterface({ input: stdin, crlfDelay: Infinity })
  }

  if (!existsSync(dump)) throw new Error(`Dump not found: ${dump}`)

  const child = spawn('zstd', ['-dc', dump], { stdio: ['ignore', 'pipe', 'inherit'] })
  child.stdout.setEncoding('utf8')
  const closed = once(child, 'close')
  child.on('error', (error) => {
    process.emitWarning(`zstd failed: ${error.message}`)
  })
  void closed
  return createInterface({ input: child.stdout, crlfDelay: Infinity })
}

async function main(): Promise<void> {
  const options = parseOptions()
  const log = (line: string): void => {
    if (!options.quiet) stdout.write(`${line}\n`)
  }

  for (const suffix of ['', '-wal', '-shm']) {
    if (existsSync(`${options.dbPath}${suffix}`)) rmSync(`${options.dbPath}${suffix}`)
  }

  const db = new DatabaseSync(options.dbPath)
  db.exec(SCHEMA)

  const insertPuzzle = db.prepare(
    `INSERT OR IGNORE INTO puzzles
       (id, fen, moves, rating, rating_deviation, popularity, plays, move_count, game_url, opening_tags)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  const insertTheme = db.prepare(
    `INSERT OR IGNORE INTO puzzle_themes (puzzle_id, theme, rating_bucket, popularity)
     VALUES (?, ?, ?, ?)`,
  )

  const counters = emptyCounters()
  const started = performance.now()
  let batch = 0

  db.exec('BEGIN')

  const source = openSource(options.dump)
  let isHeader = true

  for await (const line of source) {
    if (line.length === 0) continue
    counters.lines++

    if (isHeader) {
      isHeader = false
      counters.header++
      continue
    }

    if (options.limit !== null && counters.kept >= options.limit) break

    const row = parseRow(line)
    if (row === null) {
      counters.droppedMalformed++
      continue
    }

    if (!passesFilter(row)) {
      const reason = classifyDrop(row)
      if (reason !== null) counters[reason]++
      continue
    }

    const moves = parseMoves(row.moves)
    if (moves === null) {
      counters.droppedMalformed++
      continue
    }

    if (options.verifyEvery > 0 && counters.kept % options.verifyEvery === 0) {
      counters.verified++
      if (!solutionIsPlayable(row.fen, moves)) {
        counters.droppedIllegal++
        continue
      }
    }

    const result = insertPuzzle.run(
      row.id,
      row.fen,
      moves.join(' '),
      row.rating,
      row.ratingDeviation,
      row.popularity,
      row.plays,
      moves.length,
      row.gameUrl,
      row.openingTags,
    )
    if (Number(result.changes) === 0) {
      counters.droppedDuplicate++
      continue
    }

    const bucket = ratingBucket(row.rating)
    for (const theme of matchingThemes(row)) {
      insertTheme.run(row.id, theme, bucket, row.popularity)
    }

    counters.kept++
    batch++

    if (batch >= 5000) {
      db.exec('COMMIT')
      db.exec('BEGIN')
      batch = 0
    }

    if (counters.kept % 250000 === 0 && counters.kept > 0) {
      log(`  kept ${counters.kept.toLocaleString()} after ${counters.lines.toLocaleString()} lines`)
    }
  }

  db.exec('COMMIT')
  log('indexing')
  db.exec(INDEXES)
  db.exec('ANALYZE')
  db.exec('VACUUM')
  db.close()

  const elapsed = (performance.now() - started) / 1000
  log('')
  log('import complete')
  log(`  lines read            ${counters.lines.toLocaleString()}`)
  log(`  kept                  ${counters.kept.toLocaleString()}`)
  log(`  dropped: too hard     ${counters.droppedRating.toLocaleString()}`)
  log(`  dropped: not popular  ${counters.droppedPopularity.toLocaleString()}`)
  log(`  dropped: too few plays${String(counters.droppedPlays).padStart(9)}`)
  log(`  dropped: no motif     ${counters.droppedThemes.toLocaleString()}`)
  log(`  dropped: malformed    ${counters.droppedMalformed.toLocaleString()}`)
  log(`  dropped: duplicate    ${counters.droppedDuplicate.toLocaleString()}`)
  log(`  dropped: unplayable   ${counters.droppedIllegal.toLocaleString()}`)
  log(`  legality checked      ${counters.verified.toLocaleString()}`)
  log(`  elapsed               ${elapsed.toFixed(1)}s`)
  log(`  database              ${options.dbPath}`)
  log(`  dump                  ${options.dump ?? 'stdin'}`)
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
  exit(1)
})

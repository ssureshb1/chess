export const IMPORT = {
  minRating: 800,
  maxRating: 1300,
  minPopularity: 90,
  minPlays: 200,
  ratingBucketSize: 100,
} as const

export const motifThemes = [
  'hangingPiece',
  'fork',
  'backRankMate',
  'pin',
  'skewer',
  'discoveredAttack',
  'doubleCheck',
  'trappedPiece',
  'mateIn1',
  'mateIn2',
  'deflection',
  'clearance',
  'interference',
  'xRayAttack',
  'sacrifice',
  'quietMove',
] as const

export type MotifTheme = (typeof motifThemes)[number]

export const motifThemeSet: ReadonlySet<string> = new Set(motifThemes)

export const CSV_COLUMNS = [
  'PuzzleId',
  'FEN',
  'Moves',
  'Rating',
  'RatingDeviation',
  'Popularity',
  'NbPlays',
  'Themes',
  'GameUrl',
  'OpeningTags',
  'DailyDate',
] as const

export const puzzleDbPath = 'data/puzzles.db'
export const dumpPath = 'data/lichess_db_puzzle.csv.zst'

export function ratingBucket(rating: number): number {
  return Math.floor(rating / IMPORT.ratingBucketSize)
}

export type RawRow = {
  readonly id: string
  readonly fen: string
  readonly moves: string
  readonly rating: number
  readonly ratingDeviation: number
  readonly popularity: number
  readonly plays: number
  readonly themes: readonly string[]
  readonly gameUrl: string
  readonly openingTags: string
  readonly dailyDate: string
}

export function parseRow(line: string): RawRow | null {
  const fields = splitCsvLine(line)
  if (fields.length < 8) return null

  const [id, fen, moves, rating, ratingDeviation, popularity, plays, themes, gameUrl, openingTags, dailyDate] = fields
  if (id === undefined || fen === undefined || moves === undefined || themes === undefined) return null

  const ratingNumber = Number.parseInt(rating ?? '', 10)
  const popularityNumber = Number.parseInt(popularity ?? '', 10)
  const playsNumber = Number.parseInt(plays ?? '', 10)
  if (!Number.isFinite(ratingNumber) || !Number.isFinite(popularityNumber) || !Number.isFinite(playsNumber)) {
    return null
  }

  return {
    id,
    fen,
    moves,
    rating: ratingNumber,
    ratingDeviation: Number.parseInt(ratingDeviation ?? '0', 10),
    popularity: popularityNumber,
    plays: playsNumber,
    themes: themes.split(' ').filter((theme) => theme.length > 0),
    gameUrl: gameUrl ?? '',
    openingTags: openingTags ?? '',
    dailyDate: dailyDate ?? '',
  }
}

export function splitCsvLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let quoted = false

  for (let index = 0; index < line.length; index++) {
    const char = line[index]
    if (quoted) {
      if (char === '"') {
        if (line[index + 1] === '"') {
          current += '"'
          index++
        } else {
          quoted = false
        }
      } else {
        current += char
      }
      continue
    }
    if (char === '"') {
      quoted = true
      continue
    }
    if (char === ',') {
      fields.push(current)
      current = ''
      continue
    }
    current += char
  }
  fields.push(current)
  return fields
}

export function passesFilter(row: RawRow): boolean {
  if (row.rating < IMPORT.minRating || row.rating > IMPORT.maxRating) return false
  if (row.popularity <= IMPORT.minPopularity) return false
  if (row.plays <= IMPORT.minPlays) return false
  return row.themes.some((theme) => motifThemeSet.has(theme))
}

export function matchingThemes(row: RawRow): readonly MotifTheme[] {
  return row.themes.filter((theme): theme is MotifTheme => motifThemeSet.has(theme))
}

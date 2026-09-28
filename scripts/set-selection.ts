import type { ChunkId, ChunkTier } from '../src/chunks/schema'
import { Position } from '../src/chess/position'
import { asFen, asPieceSquare, asUci, opposite, type PieceSymbol, type UciMove } from '../src/chess/types'
import { ratingBucket, type MotifTheme } from './puzzle-filter'

export type PlyWindow = {
  readonly minPlies: number
  readonly maxPlies: number
}

export type PlyTier = 0 | 1 | 2 | 3

export const TIER_PLY_WINDOWS: Readonly<Record<PlyTier, PlyWindow>> = {
  0: { minPlies: 2, maxPlies: 4 },
  1: { minPlies: 4, maxPlies: 6 },
  2: { minPlies: 4, maxPlies: 8 },
  3: { minPlies: 6, maxPlies: 64 },
}

export function plyWindowForTier(tier: ChunkTier): PlyWindow {
  const window = TIER_PLY_WINDOWS[tier as PlyTier]
  if (window === undefined) throw new Error(`No ply window defined for tier ${tier}`)
  return window
}

export function withinPlyWindow(plies: number, window: PlyWindow): boolean {
  return plies >= window.minPlies && plies <= window.maxPlies
}

// `checkIsNotMate` is a distinction, not a motif: no Lichess tag means "this
// check is not mate". It borrows the mate themes and leans on its hand-authored
// counter-examples for the real signal.
export const CHUNK_THEME_REQUIREMENTS = {
  takeTheFreePiece: ['hangingPiece'],
  queenMate: ['mateIn1', 'mateIn2'],
  checkIsNotMate: ['mateIn1', 'mateIn2'],
  hangingPiece: ['hangingPiece'],
  knightFork: ['fork'],
  backRankMate: ['backRankMate'],
} as const

export type CuratedChunkId = keyof typeof CHUNK_THEME_REQUIREMENTS

export function isCuratedChunkId(chunkId: string): chunkId is CuratedChunkId & ChunkId {
  return chunkId in CHUNK_THEME_REQUIREMENTS
}

export function requiredThemesFor(chunkId: string): readonly MotifTheme[] {
  const table: Readonly<Record<string, readonly MotifTheme[]>> = CHUNK_THEME_REQUIREMENTS
  const themes = table[chunkId]
  if (themes === undefined) throw new Error(`No theme requirement for chunk "${chunkId}"`)
  return themes
}

export function hasRequiredTheme(
  candidateThemes: readonly string[],
  requiredThemes: readonly MotifTheme[],
): boolean {
  return requiredThemes.some((theme) => candidateThemes.includes(theme))
}

export const DRILLED_PER_SET = 12
export const TRANSFER_PER_SET = 3
export const MAX_DRILLED_PER_RATING_BUCKET = 6

export type Candidate = {
  readonly id: string
  readonly fen: string
  readonly moves: string
  readonly rating: number
  readonly popularity: number
  readonly plies: number
  readonly themes: readonly string[]
}

export type SetPuzzle = {
  readonly id: string
  readonly fen: string
  readonly moves: string
  readonly rating: number
  readonly popularity: number
  readonly plies: number
}

export const REJECTION_REASONS = [
  'outsidePlyWindow',
  'noRequiredTheme',
  'duplicateWithinSet',
  'claimedByAnotherChunk',
  'trivialRecapture',
  'notReplayable',
  'opponentAlreadyInCheck',
  'ratingBucketFull',
] as const

export type RejectionReason = (typeof REJECTION_REASONS)[number]

export type RejectionCounts = Readonly<Record<RejectionReason, number>>

export function emptyRejectionCounts(): Record<RejectionReason, number> {
  const counts = {} as Record<RejectionReason, number>
  for (const reason of REJECTION_REASONS) counts[reason] = 0
  return counts
}

export function parseSolution(moves: string): readonly UciMove[] {
  return moves
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0)
    .map(asUci)
}

export function parsePosition(fen: string): Position | null {
  try {
    return new Position(asFen(fen))
  } catch {
    return null
  }
}

export function tryParseSolution(moves: string): readonly UciMove[] | null {
  try {
    return parseSolution(moves)
  } catch {
    return null
  }
}

export function replaySolution(fen: string, moves: readonly UciMove[]): Position | null {
  const position = parsePosition(fen)
  if (position === null) return null
  try {
    for (const move of moves) position.makeUci(move)
    return position
  } catch {
    return null
  }
}

export function nonMoverKingIsInCheck(position: Position): boolean {
  const moverColor = position.turn()
  const [king] = position.findPiece('k', opposite(moverColor))
  if (king === undefined) return false
  return position.isAttacked(king, moverColor)
}

export function isSolutionPlayable(fen: string, moves: readonly UciMove[]): boolean {
  const position = parsePosition(fen)
  if (position === null) return false
  return !nonMoverKingIsInCheck(position) && replaySolution(fen, moves) !== null
}

// A pawn taking back a non-pawn on move one is a recapture of something the
// opponent just dropped, not the motif the chunk teaches. `hangingPiece` is
// exactly that motif, so it is exempt.
export function isTrivialRecapture(
  chunkId: ChunkId,
  mover: PieceSymbol,
  captured: PieceSymbol | null,
  isCapture: boolean,
): boolean {
  if (chunkId === 'hangingPiece') return false
  if (!isCapture || captured === null) return false
  return mover === 'p' && captured !== 'p'
}

export function firstMoveIsTrivialRecapture(
  chunkId: ChunkId,
  fen: string,
  moves: readonly UciMove[],
): boolean {
  const [first] = moves
  if (first === undefined) return false
  const position = parsePosition(fen)
  if (position === null) return false
  const from = asPieceSquare(first.slice(0, 2))
  const legal = position.legalMovesFrom(from).find((move) => move.uci === first)
  if (legal === undefined) return false
  return isTrivialRecapture(chunkId, legal.piece, legal.captured, legal.isCapture)
}

export function orderCandidates(candidates: readonly Candidate[]): Candidate[] {
  return [...candidates].sort((left, right) => {
    if (left.popularity !== right.popularity) return right.popularity - left.popularity
    if (left.rating !== right.rating) return left.rating - right.rating
    if (left.id === right.id) return 0
    return left.id < right.id ? -1 : 1
  })
}

export function bucketWithinLimit(
  buckets: ReadonlyMap<number, number>,
  candidateRating: number,
  maxPerBucket: number,
): boolean {
  const used = buckets.get(ratingBucket(candidateRating)) ?? 0
  return used < maxPerBucket
}

export type SelectionRequest = {
  readonly chunkId: ChunkId
  readonly tier: ChunkTier
  readonly window: PlyWindow
  readonly requiredThemes: readonly MotifTheme[]
  readonly candidates: readonly Candidate[]
  readonly claimedIds: ReadonlySet<string>
  readonly drilledCount: number
  readonly transferCount: number
  readonly maxPerRatingBucket: number
}

export type Selection = {
  readonly chunkId: ChunkId
  readonly tier: ChunkTier
  readonly window: PlyWindow
  readonly drilled: readonly SetPuzzle[]
  readonly transfer: readonly SetPuzzle[]
  readonly rejections: RejectionCounts
  readonly scanned: number
  readonly claimedIds: ReadonlySet<string>
  readonly complete: boolean
}

function toSetPuzzle(candidate: Candidate): SetPuzzle {
  return {
    id: candidate.id,
    fen: candidate.fen,
    moves: candidate.moves,
    rating: candidate.rating,
    popularity: candidate.popularity,
    plies: candidate.plies,
  }
}

export function selectChunkSet(request: SelectionRequest): Selection {
  const rejected = emptyRejectionCounts()
  const claimedIds = new Set(request.claimedIds)
  const picked = new Set<string>()
  const buckets = new Map<number, number>()
  const drilled: SetPuzzle[] = []
  const transfer: SetPuzzle[] = []
  let scanned = 0

  for (const candidate of orderCandidates(request.candidates)) {
    if (drilled.length >= request.drilledCount && transfer.length >= request.transferCount) break

    scanned++

    if (!withinPlyWindow(candidate.plies, request.window)) {
      rejected.outsidePlyWindow++
      continue
    }
    if (!hasRequiredTheme(candidate.themes, request.requiredThemes)) {
      rejected.noRequiredTheme++
      continue
    }
    if (picked.has(candidate.id)) {
      rejected.duplicateWithinSet++
      continue
    }
    if (claimedIds.has(candidate.id)) {
      rejected.claimedByAnotherChunk++
      continue
    }

    const moves = tryParseSolution(candidate.moves)
    if (moves === null) {
      rejected.notReplayable++
      continue
    }
    if (firstMoveIsTrivialRecapture(request.chunkId, candidate.fen, moves)) {
      rejected.trivialRecapture++
      continue
    }

    const opening = parsePosition(candidate.fen)
    if (opening === null) {
      rejected.notReplayable++
      continue
    }
    if (nonMoverKingIsInCheck(opening)) {
      rejected.opponentAlreadyInCheck++
      continue
    }
    if (replaySolution(candidate.fen, moves) === null) {
      rejected.notReplayable++
      continue
    }

    const drilling = drilled.length < request.drilledCount
    if (drilling && !bucketWithinLimit(buckets, candidate.rating, request.maxPerRatingBucket)) {
      rejected.ratingBucketFull++
      continue
    }

    if (drilling) {
      const bucket = ratingBucket(candidate.rating)
      buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1)
      drilled.push(toSetPuzzle(candidate))
    } else {
      transfer.push(toSetPuzzle(candidate))
    }
    picked.add(candidate.id)
    claimedIds.add(candidate.id)
  }

  return {
    chunkId: request.chunkId,
    tier: request.tier,
    window: request.window,
    drilled,
    transfer,
    rejections: rejected,
    scanned,
    claimedIds,
    complete: drilled.length === request.drilledCount && transfer.length === request.transferCount,
  }
}

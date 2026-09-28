import type { ChunkId, ChunkTier } from '../src/chunks/schema'
import { Position, type LegalMove } from '../src/chess/position'
import {
  asFen,
  asPieceSquare,
  asUci,
  fileOf,
  opposite,
  rankOf,
  squareAt,
  type PieceSquare,
  type PieceSymbol,
  type UciMove,
} from '../src/chess/types'
import { IMPORT, ratingBucket, type MotifTheme } from './puzzle-filter'

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

// Weight per 100-point rating bucket, lowest first: the 800s and 900s carry the
// set, the top of the band only seasons it. A flat cap plus a rating-ascending
// order pinned every set to 800-900, so the weights are what actually buy the
// spread.
export const RATING_BUCKET_WEIGHTS = [4, 4, 2, 1, 1] as const

export function ratingBucketsInBand(): readonly number[] {
  const lowest = ratingBucket(IMPORT.minRating)
  // 1300 is inclusive in the band but belongs with the 1200s, so round up to
  // whole buckets rather than opening a one-rating-wide bucket 13.
  const highest = Math.ceil(IMPORT.maxRating / 100) - 1
  return Array.from({ length: highest - lowest + 1 }, (_, index) => lowest + index)
}

// Largest-remainder apportionment, so the quotas always sum to exactly
// `drilledCount` and the same input always yields the same quotas.
export function ratingBucketQuotas(drilledCount: number): ReadonlyMap<number, number> {
  const buckets = ratingBucketsInBand()
  const quotas = new Map<number, number>()
  if (drilledCount <= 0) return quotas

  const weights = buckets.map((_, index) => RATING_BUCKET_WEIGHTS[index] ?? 1)
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)
  if (totalWeight === 0) return quotas

  const remainders: { bucket: number; remainder: number }[] = []
  let assigned = 0

  buckets.forEach((bucket, index) => {
    const exact = (drilledCount * (weights[index] ?? 1)) / totalWeight
    const floor = Math.floor(exact)
    quotas.set(bucket, floor)
    assigned += floor
    remainders.push({ bucket, remainder: exact - floor })
  })

  remainders.sort((left, right) =>
    right.remainder === left.remainder ? left.bucket - right.bucket : right.remainder - left.remainder,
  )
  for (let index = 0; assigned < drilledCount && index < remainders.length; index++) {
    const entry = remainders[index]
    if (entry === undefined) break
    quotas.set(entry.bucket, (quotas.get(entry.bucket) ?? 0) + 1)
    assigned++
  }

  return quotas
}

// The band is inclusive of 1300, which lands in its own one-rating-wide bucket
// 13. Clamping keeps the top of the band inside the last real bucket so the
// quotas and the candidates agree on what "the 1200s" means.
export function quotaBucketFor(rating: number, quotas: ReadonlyMap<number, number>): number {
  const bucket = ratingBucket(rating)
  if (quotas.has(bucket)) return bucket
  const highest = Math.max(...quotas.keys())
  return bucket > highest ? highest : bucket
}

export function bucketHasRoom(
  quotas: ReadonlyMap<number, number>,
  used: ReadonlyMap<number, number>,
  candidateRating: number,
): boolean {
  const bucket = quotaBucketFor(candidateRating, quotas)
  const quota = quotas.get(bucket) ?? 0
  return (used.get(bucket) ?? 0) < quota
}

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
  'motifNotOnFirstMove',
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

// ---------------------------------------------------------------------------
// Move-1 motif predicates
//
// Lichess theme tags describe features present in a position, not the shape of
// its solution: row 0082f is tagged `mateIn1` but opens with `axb3`, a pawn
// capture with no check, and the mate is the opponent's move on ply 2. Tags are
// tied to ply count (mateIn1 <-> exactly 2 plies, mateIn2 <-> exactly 4), so the
// motif always lands on the last ply. A solver only ever plays move 1, so every
// selected puzzle is re-checked against the chunk's own move-1 test.
// ---------------------------------------------------------------------------

export type MotifContext = {
  readonly before: Position
  readonly after: Position
  readonly move: LegalMove
}

export function firstMoveContext(fen: string, moves: readonly UciMove[]): MotifContext | null {
  const [first] = moves
  if (first === undefined) return null
  const before = parsePosition(fen)
  if (before === null) return null
  const from = asPieceSquare(first.slice(0, 2))
  const move = before.legalMovesFrom(from).find((candidate) => candidate.uci === first)
  if (move === undefined) return null
  const after = replaySolution(fen, [first])
  if (after === null) return null
  return { before, after, move }
}

// En passant takes the pawn beside the destination, not on it.
function capturedSquare(context: MotifContext): PieceSquare | null {
  if (!context.move.isEnPassant) return context.move.to
  return squareAt(fileOf(context.move.to), rankOf(context.move.from))
}

export function takesFreePiece(context: MotifContext): boolean {
  if (!context.move.isCapture || context.move.captured === null) return false
  const square = capturedSquare(context)
  if (square === null) return false
  const victim = context.before.pieceAt(square)
  if (victim === null) return false
  return !context.before.isAttacked(square, victim.color)
}

export function knightForksTwoPieces(context: MotifContext): boolean {
  if (context.move.piece !== 'n') return false
  const mover = context.after.turnOfOpponent()
  const landing = context.move.to
  let extraTargets = 0
  let givesCheck = false

  for (const square of context.after.occupiedSquares()) {
    const piece = context.after.pieceAt(square)
    if (piece === null || piece.color === mover) continue
    if (!context.after.isAttacked(square, mover)) continue
    if (piece.type === 'k') {
      givesCheck = true
      continue
    }
    if (square === landing) continue
    extraTargets++
  }

  return givesCheck ? extraTargets >= 1 : extraTargets >= 2
}

export function checksButIsNotMate(context: MotifContext): boolean {
  return context.after.isInCheck() && !context.after.isCheckmate()
}

export const CHUNK_MOTIF_PREDICATES: Readonly<
  Partial<Record<ChunkId, (context: MotifContext) => boolean>>
> = {
  takeTheFreePiece: takesFreePiece,
  hangingPiece: takesFreePiece,
  knightFork: knightForksTwoPieces,
  checkIsNotMate: checksButIsNotMate,
}

// `queenMate` and `backRankMate` are deliberately absent: Lichess emits no 1-ply
// puzzles, so a mating first move — which ends the game — cannot be expressed in
// the dump at all. Those two chunks are hand-authored in
// `src/chunks/curatedPuzzles.ts` and held to the same predicates by the same
// tests.
export const HAND_AUTHORED_CHUNK_IDS = ['queenMate', 'backRankMate'] as const

export function motifPredicateFor(chunkId: ChunkId): ((context: MotifContext) => boolean) | undefined {
  return CHUNK_MOTIF_PREDICATES[chunkId]
}

export function orderCandidates(candidates: readonly Candidate[]): Candidate[] {
  return [...candidates].sort((left, right) => {
    if (left.popularity !== right.popularity) return right.popularity - left.popularity
    if (left.rating !== right.rating) return left.rating - right.rating
    if (left.id === right.id) return 0
    return left.id < right.id ? -1 : 1
  })
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
  const usedBuckets = new Map<number, number>()
  const quotas = ratingBucketQuotas(request.drilledCount)
  const predicate = motifPredicateFor(request.chunkId)
  const drilled: SetPuzzle[] = []
  const transfer: SetPuzzle[] = []
  const bucketBlocked = new Set<string>()
  let scanned = 0

  const ordered = orderCandidates(request.candidates)

  // Pass one runs every quality floor and fills each rating bucket up to its
  // quota. A candidate that passes everything but arrives at a full bucket is
  // parked rather than dropped, so pass two can still use it.
  for (const candidate of ordered) {
    if (drilled.length >= request.drilledCount && transfer.length >= request.transferCount) break

    scanned++

    const drilling = drilled.length < request.drilledCount

    if (drilling && !bucketHasRoom(quotas, usedBuckets, candidate.rating)) {
      bucketBlocked.add(candidate.id)
      continue
    }

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

    if (predicate !== undefined) {
      const context = firstMoveContext(candidate.fen, moves)
      if (context === null || !predicate(context)) {
        rejected.motifNotOnFirstMove++
        continue
      }
    }

    if (drilling) {
      const bucket = quotaBucketFor(candidate.rating, quotas)
      usedBuckets.set(bucket, (usedBuckets.get(bucket) ?? 0) + 1)
      drilled.push(toSetPuzzle(candidate))
    } else {
      transfer.push(toSetPuzzle(candidate))
    }
    picked.add(candidate.id)
    claimedIds.add(candidate.id)
  }

  // Pass two exists only to top up from the parked pool — a bucket that ran dry,
  // or transfer slots that pass one never reached because it spent the whole
  // candidate list filling drilled. Parked candidates already cleared every
  // other floor, so nothing is validated or counted twice.
  for (const candidate of ordered) {
    if (drilled.length >= request.drilledCount && transfer.length >= request.transferCount) break
    if (!bucketBlocked.has(candidate.id) || picked.has(candidate.id)) continue
    if (claimedIds.has(candidate.id)) continue

    if (drilled.length < request.drilledCount) {
      const bucket = quotaBucketFor(candidate.rating, quotas)
      usedBuckets.set(bucket, (usedBuckets.get(bucket) ?? 0) + 1)
      drilled.push(toSetPuzzle(candidate))
    } else {
      transfer.push(toSetPuzzle(candidate))
    }
    picked.add(candidate.id)
    claimedIds.add(candidate.id)
  }

  // A parked candidate that pass two brought back was not rejected in the end,
  // so the counter describes outcomes rather than the first pass alone. That
  // keeps scanned === picked + rejected true for anyone auditing a build.
  let recovered = 0
  for (const candidate of ordered) {
    if (bucketBlocked.has(candidate.id) && picked.has(candidate.id)) recovered++
  }
  rejected.ratingBucketFull = bucketBlocked.size - recovered

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

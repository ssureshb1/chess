import { describe, expect, it } from 'vitest'
import { curriculum } from '../src/chunks/curriculum'
import { asFen, asPieceSquare } from '../src/chess/types'
import { Position } from '../src/chess/position'
import { ratingBucket } from './puzzle-filter'
import {
  CHUNK_THEME_REQUIREMENTS,
  DRILLED_PER_SET,
  MAX_DRILLED_PER_RATING_BUCKET,
  TIER_PLY_WINDOWS,
  TRANSFER_PER_SET,
  bucketWithinLimit,
  emptyRejectionCounts,
  firstMoveIsTrivialRecapture,
  hasRequiredTheme,
  isSolutionPlayable,
  isTrivialRecapture,
  nonMoverKingIsInCheck,
  orderCandidates,
  parsePosition,
  parseSolution,
  plyWindowForTier,
  replaySolution,
  requiredThemesFor,
  selectChunkSet,
  withinPlyWindow,
  type Candidate,
  type PlyTier,
  type Selection,
} from './set-selection'

const ELOCHKA_FEN = '4k3/8/8/8/8/4N3/8/4K3 w - - 0 1'
const LOOSE_PAWN_RECAPTURE_FEN = '4k3/8/8/2n5/3P4/8/8/4K3 w - - 0 1'
const LOOSE_PAWN_RECAPTURE_MOVES = 'd4c5 e8d7'
const BLACK_KING_ALREADY_IN_CHECK_FEN = '4k3/8/8/8/8/8/4R3/4K3 w - - 0 1'
const BLACK_KING_ALREADY_IN_CHECK_MOVES = 'e2f2 e8d7'

function candidate(overrides: Partial<Candidate> & { readonly id: string }): Candidate {
  return {
    fen: ELOCHKA_FEN,
    moves: 'e3d5 e8d7',
    rating: 1000,
    popularity: 100,
    plies: 4,
    themes: ['fork'],
    ...overrides,
  }
}

function fill(overrides: Partial<Parameters<typeof selectChunkSet>[0]> = {}): Selection {
  const requests: readonly Candidate[] = Array.from({ length: 60 }, (_, index) =>
    candidate({ id: `f${String(index).padStart(3, '0')}`, rating: 800 + index * 5 }),
  )
  return selectChunkSet({
    chunkId: 'knightFork',
    tier: 1,
    window: TIER_PLY_WINDOWS[1],
    requiredThemes: ['fork'],
    candidates: requests,
    claimedIds: new Set<string>(),
    drilledCount: DRILLED_PER_SET,
    transferCount: TRANSFER_PER_SET,
    maxPerRatingBucket: MAX_DRILLED_PER_RATING_BUCKET,
    ...overrides,
  })
}

describe('tier ply windows', () => {
  it('rejects a 2-ply puzzle for Tier 1 and accepts it for Tier 0', () => {
    expect(withinPlyWindow(2, TIER_PLY_WINDOWS[1])).toBe(false)
    expect(withinPlyWindow(2, TIER_PLY_WINDOWS[0])).toBe(true)
  })

  it('accepts a 4-ply puzzle in both Tier 0 and Tier 1', () => {
    expect(withinPlyWindow(4, TIER_PLY_WINDOWS[0])).toBe(true)
    expect(withinPlyWindow(4, TIER_PLY_WINDOWS[1])).toBe(true)
  })

  it('accepts a 6-ply puzzle for Tier 1 and rejects it for Tier 0', () => {
    expect(withinPlyWindow(6, TIER_PLY_WINDOWS[1])).toBe(true)
    expect(withinPlyWindow(6, TIER_PLY_WINDOWS[0])).toBe(false)
  })

  it('treats each bound as a window, not just a floor', () => {
    expect(withinPlyWindow(8, TIER_PLY_WINDOWS[1])).toBe(false)
    expect(withinPlyWindow(8, TIER_PLY_WINDOWS[2])).toBe(true)
    expect(withinPlyWindow(6, TIER_PLY_WINDOWS[2])).toBe(true)
    expect(withinPlyWindow(5, TIER_PLY_WINDOWS[3])).toBe(false)
    expect(withinPlyWindow(64, TIER_PLY_WINDOWS[3])).toBe(true)
  })

  it('matches the windows REQUIREMENTS.md §12 specifies', () => {
    const expected: Readonly<Record<PlyTier, { minPlies: number; maxPlies: number }>> = {
      0: { minPlies: 2, maxPlies: 4 },
      1: { minPlies: 4, maxPlies: 6 },
      2: { minPlies: 4, maxPlies: 8 },
      3: { minPlies: 6, maxPlies: 64 },
    }
    expect(TIER_PLY_WINDOWS).toEqual(expected)
  })

  it('resolves a window for a curriculum tier and refuses the deferred Tier 4', () => {
    expect(plyWindowForTier(0)).toEqual({ minPlies: 2, maxPlies: 4 })
    expect(plyWindowForTier(1)).toEqual({ minPlies: 4, maxPlies: 6 })
    expect(() => plyWindowForTier(4)).toThrow(/tier 4/)
  })
})

describe('theme requirements', () => {
  it('covers exactly the hand-authored Tier 0-1 chunks', () => {
    const curriculumIds = curriculum.map((chunk) => chunk.id).sort()
    expect([...Object.keys(CHUNK_THEME_REQUIREMENTS)].sort()).toEqual(curriculumIds)
  })

  it('gives each chunk the themes REQUIREMENTS.md §5 names', () => {
    expect(requiredThemesFor('takeTheFreePiece')).toEqual(['hangingPiece'])
    expect(requiredThemesFor('queenMate')).toEqual(['mateIn1', 'mateIn2'])
    expect(requiredThemesFor('checkIsNotMate')).toEqual(['mateIn1', 'mateIn2'])
    expect(requiredThemesFor('hangingPiece')).toEqual(['hangingPiece'])
    expect(requiredThemesFor('knightFork')).toEqual(['fork'])
    expect(requiredThemesFor('backRankMate')).toEqual(['backRankMate'])
  })

  it('throws for a chunk it has no requirement for', () => {
    expect(() => requiredThemesFor('skewer')).toThrow(/skewer/)
  })

  it('matches a candidate carrying at least one of the chunk themes', () => {
    expect(hasRequiredTheme(['hangingPiece', 'mateIn1'], ['mateIn1', 'mateIn2'])).toBe(true)
    expect(hasRequiredTheme(['hangingPiece', 'fork'], ['fork'])).toBe(true)
    expect(hasRequiredTheme(['hangingPiece'], ['fork'])).toBe(false)
    expect(hasRequiredTheme([], ['mateIn1', 'mateIn2'])).toBe(false)
  })
})

describe('trivial recapture predicate', () => {
  it('accepts a pawn taking a non-pawn for hangingPiece', () => {
    expect(isTrivialRecapture('hangingPiece', 'p', 'n', true)).toBe(false)
  })

  it('rejects a pawn taking a non-pawn for knightFork', () => {
    expect(isTrivialRecapture('knightFork', 'p', 'n', true)).toBe(true)
    expect(isTrivialRecapture('knightFork', 'p', 'q', true)).toBe(true)
  })

  it('leaves pawns on pawns, quiet moves and non-pawn takers alone', () => {
    expect(isTrivialRecapture('knightFork', 'p', 'p', true)).toBe(false)
    expect(isTrivialRecapture('knightFork', 'n', 'p', true)).toBe(false)
    expect(isTrivialRecapture('knightFork', 'p', null, false)).toBe(false)
    expect(isTrivialRecapture('knightFork', 'q', 'r', true)).toBe(false)
  })

  it('reads the board for the first move of a solution', () => {
    const moves = parseSolution(LOOSE_PAWN_RECAPTURE_MOVES)
    expect(firstMoveIsTrivialRecapture('knightFork', LOOSE_PAWN_RECAPTURE_FEN, moves)).toBe(true)
    expect(firstMoveIsTrivialRecapture('hangingPiece', LOOSE_PAWN_RECAPTURE_FEN, moves)).toBe(false)
    expect(firstMoveIsTrivialRecapture('knightFork', ELOCHKA_FEN, parseSolution('e3d5 e8d7'))).toBe(false)
  })
})

describe('candidate ordering', () => {
  const unsorted: readonly Candidate[] = [
    candidate({ id: 'bbb', rating: 1200, popularity: 99 }),
    candidate({ id: 'aaa', rating: 1000, popularity: 99 }),
    candidate({ id: 'ddd', rating: 900, popularity: 100 }),
    candidate({ id: 'ccc', rating: 900, popularity: 100 }),
  ]

  it('sorts by popularity desc, then rating asc, then id asc', () => {
    expect(orderCandidates(unsorted).map((puzzle) => puzzle.id)).toEqual([
      'ccc',
      'ddd',
      'aaa',
      'bbb',
    ])
  })

  it('is deterministic across repeated calls and input permutations', () => {
    const expected = ['ccc', 'ddd', 'aaa', 'bbb']
    expect(orderCandidates(unsorted).map((puzzle) => puzzle.id)).toEqual(expected)
    expect(orderCandidates(unsorted).map((puzzle) => puzzle.id)).toEqual(expected)
    expect(orderCandidates([...unsorted].reverse()).map((puzzle) => puzzle.id)).toEqual(expected)
  })

  it('does not mutate its input', () => {
    const before = unsorted.map((puzzle) => puzzle.id)
    orderCandidates(unsorted)
    expect(unsorted.map((puzzle) => puzzle.id)).toEqual(before)
  })
})

describe('rating bucket balance', () => {
  it('blocks a bucket at the per-bucket cap and leaves the others open', () => {
    const buckets = new Map([[8, 6]])
    expect(bucketWithinLimit(buckets, 850, 6)).toBe(false)
    expect(bucketWithinLimit(buckets, 950, 6)).toBe(true)
    expect(bucketWithinLimit(buckets, 1300, 6)).toBe(true)
  })

  it('groups ratings into 100-wide buckets', () => {
    expect(ratingBucket(800)).toBe(8)
    expect(ratingBucket(899)).toBe(8)
    expect(ratingBucket(900)).toBe(9)
    expect(ratingBucket(1299)).toBe(12)
  })

  it('fills at most six drilled puzzles per rating bucket', () => {
    const selection = fill({
      candidates: Array.from({ length: 40 }, (_, index) =>
        candidate({ id: `spread${String(index).padStart(2, '0')}`, rating: 800 + index * 5 }),
      ),
    })
    const counts = new Map<number, number>()
    for (const puzzle of selection.drilled) {
      const bucket = ratingBucket(puzzle.rating)
      counts.set(bucket, (counts.get(bucket) ?? 0) + 1)
    }
    expect(selection.complete).toBe(true)
    expect(selection.drilled.length).toBe(DRILLED_PER_SET)
    expect([...counts.values()].sort()).toEqual([6, 6])
    expect(selection.rejections.ratingBucketFull).toBe(14)
  })

  it('stops short rather than piling one rating bucket past the cap', () => {
    const selection = fill({
      candidates: Array.from({ length: 30 }, (_, index) =>
        candidate({ id: `oneBucket${String(index).padStart(2, '0')}`, rating: 800 + index }),
      ),
    })
    expect(selection.complete).toBe(false)
    expect(selection.drilled.length).toBe(MAX_DRILLED_PER_RATING_BUCKET)
  })
})

describe('replay and illegal-position checks', () => {
  it('replays a real solution and keeps the mover side in check only as given', () => {
    expect(isSolutionPlayable(ELOCHKA_FEN, parseSolution('e3d5 e8d7'))).toBe(true)
  })

  it('rejects a solution that is not legal from its own FEN', () => {
    expect(isSolutionPlayable(ELOCHKA_FEN, parseSolution('a1a2 e8d7'))).toBe(false)
    expect(replaySolution('this is not a fen', parseSolution('e3d5'))).toBeNull()
  })

  it('rejects a position where the side not to move is already in check', () => {
    const opening = parsePosition(BLACK_KING_ALREADY_IN_CHECK_FEN)
    expect(opening).not.toBeNull()
    expect(opening === null ? false : nonMoverKingIsInCheck(opening)).toBe(true)
    expect(
      isSolutionPlayable(BLACK_KING_ALREADY_IN_CHECK_FEN, parseSolution(BLACK_KING_ALREADY_IN_CHECK_MOVES)),
    ).toBe(false)
    expect(replaySolution(BLACK_KING_ALREADY_IN_CHECK_FEN, parseSolution(BLACK_KING_ALREADY_IN_CHECK_MOVES))).not.toBeNull()
  })

  it('accepts a position where the side not to move is safe', () => {
    const position = replaySolution(ELOCHKA_FEN, parseSolution('e3d5 e8d7'))
    expect(position === null ? true : nonMoverKingIsInCheck(position)).toBe(false)
  })
})

describe('selectChunkSet', () => {
  it('fills 12 drilled and 3 transfer with no id reused', () => {
    const selection = fill()
    expect(selection.complete).toBe(true)
    expect(selection.drilled.length).toBe(DRILLED_PER_SET)
    expect(selection.transfer.length).toBe(TRANSFER_PER_SET)
    const ids = [...selection.drilled, ...selection.transfer].map((puzzle) => puzzle.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('never hands back an id that was already claimed', () => {
    const selection = fill({ claimedIds: new Set(['f000', 'f001', 'f002']) })
    expect(selection.drilled.map((puzzle) => puzzle.id)).not.toContain('f000')
    expect(selection.drilled.map((puzzle) => puzzle.id)).not.toContain('f001')
    expect(selection.drilled.map((puzzle) => puzzle.id)).not.toContain('f002')
    expect(selection.rejections.claimedByAnotherChunk).toBe(3)
  })

  it('counts every rejection reason it hits', () => {
    const selection = fill({
      candidates: [
        candidate({ id: 'outOfWindow', plies: 2, rating: 800 }),
        candidate({ id: 'wrongTheme', themes: ['hangingPiece'], rating: 801 }),
        candidate({ id: 'unplayable', moves: 'a1a2 e8d7', rating: 802 }),
        candidate({ id: 'illegalFen', fen: BLACK_KING_ALREADY_IN_CHECK_FEN, rating: 803 }),
        candidate({
          id: 'recapture',
          fen: LOOSE_PAWN_RECAPTURE_FEN,
          moves: LOOSE_PAWN_RECAPTURE_MOVES,
          rating: 804,
        }),
        ...Array.from({ length: 30 }, (_, index) =>
          candidate({ id: `good${String(index).padStart(2, '0')}`, rating: 805 + index * 10 }),
        ),
      ],
    })
    expect(selection.complete).toBe(true)
    expect(selection.rejections.outsidePlyWindow).toBe(1)
    expect(selection.rejections.noRequiredTheme).toBe(1)
    expect(selection.rejections.notReplayable).toBe(1)
    expect(selection.rejections.opponentAlreadyInCheck).toBe(1)
    expect(selection.rejections.trivialRecapture).toBe(1)
    const totalRejected = Object.values(selection.rejections).reduce((sum, count) => sum + count, 0)
    expect(selection.scanned).toBe(selection.drilled.length + selection.transfer.length + totalRejected)
    expect(selection.scanned).toBe(24)
  })

  it('reports an incomplete set rather than padding a thin pool', () => {
    const selection = fill({
      candidates: Array.from({ length: 4 }, (_, index) => candidate({ id: `thin${index}` })),
    })
    expect(selection.complete).toBe(false)
    expect(selection.drilled.length).toBe(4)
    expect(selection.transfer.length).toBe(0)
  })

  it('is reproducible for the same candidate list', () => {
    const build = (): readonly string[] => fill().drilled.map((puzzle) => puzzle.id)
    expect(build()).toEqual(build())
  })
})

describe('helpers', () => {
  it('starts every rejection counter at zero', () => {
    const counts = emptyRejectionCounts()
    for (const value of Object.values(counts)) expect(value).toBe(0)
  })

  it('parses a space-separated UCI solution', () => {
    expect(parseSolution('  e2g1   f7g1 ')).toEqual(['e2g1', 'f7g1'])
    expect(parseSolution('e7e8q')).toEqual(['e7e8q'])
  })

  it('builds a Position from an emitted FEN', () => {
    const position = new Position(asFen(ELOCHKA_FEN))
    expect(position.turn()).toBe('w')
    expect(position.pieceAt(asPieceSquare('e3'))).not.toBeNull()
  })
})

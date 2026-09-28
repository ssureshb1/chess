import { describe, expect, it } from 'vitest'
import { curriculum } from '../src/chunks/curriculum'
import { asFen, asPieceSquare } from '../src/chess/types'
import { Position } from '../src/chess/position'
import { ratingBucket } from './puzzle-filter'
import {
  CHUNK_THEME_REQUIREMENTS,
  DRILLED_PER_SET,
  DRILLED_PER_SET as DRILLED,
  TIER_PLY_WINDOWS,
  TRANSFER_PER_SET,
  bucketHasRoom,
  ratingBucketQuotas,
  emptyRejectionCounts,
  backRankMatesOnFirstMove,
  checksButIsNotMate,
  firstMoveContext,
  firstMoveIsTrivialRecapture,
  HAND_AUTHORED_CHUNK_IDS,
  knightForksTwoPieces,
  motifPredicateFor,
  queenMatesOnFirstMove,
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
  takesFreePiece,
  withinPlyWindow,
  type Candidate,
  type PlyTier,
  type Selection,
} from './set-selection'

// A real knight fork: Nb5-c7+ hits the e8 king and the a8 rook, so the
// default fixture satisfies the `knightFork` move-1 motif predicate.
const ELOCHKA_FEN = 'r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1'
const ELOCHKA_MOVES = 'b5c7 e8d8 e1f1 d8c8'
const LOOSE_PAWN_RECAPTURE_FEN = '4k3/8/8/2n5/3P4/8/8/4K3 w - - 0 1'
const LOOSE_PAWN_RECAPTURE_MOVES = 'd4c5 e8d7'
const BLACK_KING_ALREADY_IN_CHECK_FEN = '4k3/8/8/8/8/8/4R3/4K3 w - - 0 1'
const BLACK_KING_ALREADY_IN_CHECK_MOVES = 'e2f2 e8d7'

function candidate(overrides: Partial<Candidate> & { readonly id: string }): Candidate {
  return {
    fen: ELOCHKA_FEN,
    moves: ELOCHKA_MOVES,
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

describe('rating bucket quotas', () => {
  it('apportions the 800-1300 band so the low end carries the set', () => {
    const quotas = ratingBucketQuotas(12)
    expect(Object.fromEntries(quotas)).toEqual({ 8: 4, 9: 4, 10: 2, 11: 1, 12: 1 })
  })

  it('always sums to the drilled count and stays deterministic', () => {
    for (const count of [1, 5, 12, 13, 30]) {
      const first = ratingBucketQuotas(count)
      const second = ratingBucketQuotas(count)
      expect(Object.fromEntries(first)).toEqual(Object.fromEntries(second))
      const total = [...first.values()].reduce((sum, value) => sum + value, 0)
      expect(total).toBe(count)
    }
  })

  it('returns no quotas for an empty set', () => {
    expect(ratingBucketQuotas(0).size).toBe(0)
  })

  it('blocks a bucket once its quota is used up and leaves the others open', () => {
    const quotas = ratingBucketQuotas(12)
    const used = new Map([[8, 4]])
    expect(bucketHasRoom(quotas, used, 850)).toBe(false)
    expect(bucketHasRoom(quotas, used, 950)).toBe(true)
    expect(bucketHasRoom(quotas, new Map(), 1250)).toBe(true)
  })

  it('groups ratings into 100-wide buckets', () => {
    expect(ratingBucket(800)).toBe(8)
    expect(ratingBucket(899)).toBe(8)
    expect(ratingBucket(900)).toBe(9)
    expect(ratingBucket(1299)).toBe(12)
  })

  it('spreads a set across the whole band instead of pinning it to 800-900', () => {
    const selection = fill({
      candidates: Array.from({ length: 400 }, (_, index) =>
        candidate({ id: `spread${String(index).padStart(3, '0')}`, rating: 800 + ((index * 7) % 500) }),
      ),
    })
    const counts = new Map<number, number>()
    for (const puzzle of selection.drilled) {
      const bucket = ratingBucket(puzzle.rating)
      counts.set(bucket, (counts.get(bucket) ?? 0) + 1)
    }
    expect(selection.complete).toBe(true)
    expect(selection.drilled.length).toBe(DRILLED)
    expect(Object.fromEntries(counts)).toEqual({ 8: 4, 9: 4, 10: 2, 11: 1, 12: 1 })
  })

  it('still fills every slot when one bucket runs dry', () => {
    const selection = fill({
      candidates: Array.from({ length: 60 }, (_, index) =>
        candidate({ id: `lowOnly${String(index).padStart(3, '0')}`, rating: 800 + (index % 100) }),
      ),
    })
    expect(selection.complete).toBe(true)
    expect(selection.drilled.length).toBe(DRILLED)
  })
})

describe('replay and illegal-position checks', () => {
  it('replays a real solution and keeps the mover side in check only as given', () => {
    expect(isSolutionPlayable(ELOCHKA_FEN, parseSolution(ELOCHKA_MOVES))).toBe(true)
  })

  it('rejects a solution that is not legal from its own FEN', () => {
    expect(isSolutionPlayable(ELOCHKA_FEN, parseSolution('a1a2 e8d8'))).toBe(false)
    expect(replaySolution('this is not a fen', parseSolution(ELOCHKA_MOVES))).toBeNull()
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
    const position = replaySolution(ELOCHKA_FEN, parseSolution(ELOCHKA_MOVES))
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
    expect(selection.scanned).toBe(35)
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
    expect(position.pieceAt(asPieceSquare('b5'))).not.toBeNull()
  })
})

describe('move-1 motif predicates', () => {
  function context(fen: string, moves: string) {
    const made = firstMoveContext(fen, parseSolution(moves))
    expect(made, `${fen} / ${moves}`).not.toBeNull()
    if (made === null) throw new Error('unreachable')
    return made
  }

  it('accepts capturing a piece nothing defends and rejects a defended one', () => {
    // Nxd5 on a loose queen, then the same capture with a black pawn on e6
    // covering d5.
    expect(takesFreePiece(context('4k3/8/8/3q4/8/4N3/8/4K3 w - - 0 1', 'e3d5'))).toBe(true)
    expect(takesFreePiece(context('4k3/8/4p3/3q4/8/4N3/8/4K3 w - - 0 1', 'e3d5'))).toBe(false)
  })

  it('rejects a first move that captures nothing', () => {
    expect(takesFreePiece(context(ELOCHKA_FEN, ELOCHKA_MOVES))).toBe(false)
  })

  it('accepts a knight move hitting the king and one more piece', () => {
    expect(knightForksTwoPieces(context(ELOCHKA_FEN, ELOCHKA_MOVES))).toBe(true)
  })

  it('accepts a knight move hitting two pieces with no check', () => {
    // Nc7 hits the a6 rook and the b5 knight, and the h8 king is nowhere near.
    expect(knightForksTwoPieces(context('7k/8/r7/1n1N4/8/8/8/7K w - - 0 1', 'd5c7'))).toBe(true)
  })

  it('rejects a knight move that only hits one piece', () => {
    expect(knightForksTwoPieces(context('7k/8/8/1n1N4/8/8/8/7K w - - 0 1', 'd5c7'))).toBe(false)
  })

  it('rejects a non-knight move even when it attacks two pieces', () => {
    // Bxc5 also hits two black knights, but a bishop is not a fork.
    expect(knightForksTwoPieces(context('7k/8/8/2n1n3/3B4/8/8/7K w - - 0 1', 'd4c5'))).toBe(false)
  })

  it('separates check from mate for the checkIsNotMate chunk', () => {
    expect(checksButIsNotMate(context('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1', 'a1a8'))).toBe(false)
    expect(checksButIsNotMate(context(ELOCHKA_FEN, ELOCHKA_MOVES))).toBe(true)
    expect(checksButIsNotMate(context('4k3/8/8/8/8/8/8/4K3 w - - 0 1', 'e1e2'))).toBe(false)
  })

  it('separates a queen mate from a back-rank mate', () => {
    // A queen mate that is also a back-rank mate is only a queen mate.
    expect(queenMatesOnFirstMove(context('7k/6pp/8/8/8/8/8/Q3K3 w - - 0 1', 'a1a8'))).toBe(true)
    expect(backRankMatesOnFirstMove(context('7k/6pp/8/8/8/8/8/Q3K3 w - - 0 1', 'a1a8'))).toBe(true)
    // A rook back-rank mate is not a queen mate.
    expect(queenMatesOnFirstMove(context('7k/6pp/8/8/8/8/8/R3K3 w - - 0 1', 'a1a8'))).toBe(false)
    expect(backRankMatesOnFirstMove(context('7k/6pp/8/8/8/8/8/R3K3 w - - 0 1', 'a1a8'))).toBe(true)
    // Mated in the middle of the board: checkmate, but not a back rank.
    expect(backRankMatesOnFirstMove(context('4k3/8/8/8/8/8/8/R3K3 w - - 0 1', 'a1a8'))).toBe(false)
  })

  it('keeps the two hand-authored chunks out of the mined path', () => {
    expect(motifPredicateFor('queenMate')).toBe(queenMatesOnFirstMove)
    expect(motifPredicateFor('backRankMate')).toBe(backRankMatesOnFirstMove)
    expect([...HAND_AUTHORED_CHUNK_IDS].sort()).toEqual(['backRankMate', 'queenMate'])
    expect(() =>
      selectChunkSet({
        chunkId: 'queenMate',
        tier: 0,
        window: { minPlies: 2, maxPlies: 4 },
        requiredThemes: ['mateIn1'],
        candidates: [],
        claimedIds: new Set<string>(),
        drilledCount: 1,
        transferCount: 0,
      }),
    ).toThrow(/hand-authored/)
  })
})

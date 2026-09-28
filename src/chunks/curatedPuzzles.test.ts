import { describe, expect, it } from 'vitest'
import { Position } from '../chess/position'
import { asFen, asUci, rankOf } from '../chess/types'
import { CURATED_MATE_PUZZLES } from './curatedPuzzles'
import {
  backRankMatesOnFirstMove,
  firstMoveContext,
  isHandAuthoredChunkId,
  nonMoverKingIsInCheck,
  parseSolution,
  plyWindowForChunk,
  queenMatesOnFirstMove,
  replaySolution,
  selectCuratedChunkSet,
} from '../../scripts/set-selection'

const CHUNKS = ['queenMate', 'backRankMate'] as const
const REQUIRED_PER_CHUNK = 15

describe('curated mate puzzles', () => {
  it('has a drilled pair and a transfer pair for each hand-authored chunk', () => {
    for (const chunkId of CHUNKS) {
      expect(CURATED_MATE_PUZZLES[chunkId]).toHaveLength(REQUIRED_PER_CHUNK)
    }
  })

  it('gives every puzzle a unique id and no position appears in both sets', () => {
    const ids = new Set<string>()
    const fens = new Set<string>()
    for (const chunkId of CHUNKS) {
      for (const puzzle of CURATED_MATE_PUZZLES[chunkId]) {
        expect(ids.has(puzzle.id), `${puzzle.id} is duplicated`).toBe(false)
        ids.add(puzzle.id)
        expect(fens.has(puzzle.fen), `${puzzle.fen} appears in two chunks`).toBe(false)
        fens.add(puzzle.fen)
      }
    }
  })

  it('is a legal position with the side not to move out of check', () => {
    for (const chunkId of CHUNKS) {
      for (const puzzle of CURATED_MATE_PUZZLES[chunkId]) {
        const position = new Position(asFen(puzzle.fen))
        expect(position.isInCheck(), `${puzzle.id}: side to move is in check`).toBe(false)
        expect(nonMoverKingIsInCheck(position), `${puzzle.id}: side not to move is in check`).toBe(
          false,
        )
      }
    }
  })

  it('has a one-move solution that is mate from the puzzle position', () => {
    for (const chunkId of CHUNKS) {
      for (const puzzle of CURATED_MATE_PUZZLES[chunkId]) {
        const moves = parseSolution(puzzle.moves)
        expect(moves, `${puzzle.id}: moves do not parse`).toHaveLength(puzzle.plies)
        expect(puzzle.plies, `${puzzle.id}: a mating puzzle is 1 ply`).toBe(1)

        const after = replaySolution(puzzle.fen, moves)
        expect(after, `${puzzle.id}: solution does not replay`).not.toBeNull()
        expect(after?.isCheckmate(), `${puzzle.id}: move 1 is not mate`).toBe(true)
      }
    }
  })

  it('drills queenMate with a queen and backRankMate with a rook', () => {
    for (const puzzle of CURATED_MATE_PUZZLES.queenMate) {
      const context = firstMoveContext(puzzle.fen, parseSolution(puzzle.moves))
      expect(context, `${puzzle.id}: no move-1 context`).not.toBeNull()
      if (context === null) continue
      expect(context.move.piece, `${puzzle.id}: queenMate needs a queen`).toBe('q')
      expect(queenMatesOnFirstMove(context), `${puzzle.id}: not a queen mate`).toBe(true)
    }
    for (const puzzle of CURATED_MATE_PUZZLES.backRankMate) {
      const context = firstMoveContext(puzzle.fen, parseSolution(puzzle.moves))
      expect(context, `${puzzle.id}: no move-1 context`).not.toBeNull()
      if (context === null) continue
      // Rook-only keeps the two chunks from repeating each other; a queen mate
      // on the back rank still satisfies the predicate, it just is not shipped.
      expect(context.move.piece, `${puzzle.id}: backRankMate is rook-only`).toBe('r')
      expect(backRankMatesOnFirstMove(context), `${puzzle.id}: not a back-rank mate`).toBe(true)
    }
  })

  it('always mates a king that is on its own back rank', () => {
    for (const chunkId of CHUNKS) {
      for (const puzzle of CURATED_MATE_PUZZLES[chunkId]) {
        const after = new Position(asFen(puzzle.fen))
        after.makeUci(asUci(puzzle.moves))
        const king = after.findPiece('k', after.turn())[0]
        expect(king, `${puzzle.id}: no mated king`).toBeDefined()
        if (king === undefined) continue
        const rank = rankOf(king)
        expect(['1', '8'], `${puzzle.id}: mated king on ${rank}`).toContain(rank)
      }
    }
  })

  it('varies the answer instead of drilling one move over and over', () => {
    // A set of 15 that only ever asks for Ra8# teaches one trick instead of
    // "find the back rank", so no answer may appear more than twice.
    for (const chunkId of CHUNKS) {
      const counts = new Map<string, number>()
      for (const puzzle of CURATED_MATE_PUZZLES[chunkId]) {
        const after = new Position(asFen(puzzle.fen))
        const made = after.makeUci(asUci(puzzle.moves))
        counts.set(made.san, (counts.get(made.san) ?? 0) + 1)
      }
      for (const [san, count] of counts) {
        expect(count, `${chunkId}: ${san} appears ${count} times`).toBeLessThanOrEqual(2)
      }
      expect(counts.size, `${chunkId}: only ${counts.size} distinct answers`).toBeGreaterThanOrEqual(5)
    }
  })

  it('orders difficulty with a rising synthetic rating', () => {
    for (const chunkId of CHUNKS) {
      const ratings = CURATED_MATE_PUZZLES[chunkId].map((puzzle) => puzzle.rating)
      expect([...ratings].sort((a, b) => a - b)).toEqual(ratings)
      expect(new Set(ratings).size).toBe(ratings.length)
    }
  })

  it('reports a 1-ply window for these chunks and the tier window otherwise', () => {
    expect(plyWindowForChunk('queenMate', 0)).toEqual({ minPlies: 1, maxPlies: 1 })
    expect(plyWindowForChunk('backRankMate', 1)).toEqual({ minPlies: 1, maxPlies: 1 })
    expect(plyWindowForChunk('knightFork', 1)).toEqual({ minPlies: 4, maxPlies: 6 })
    expect(isHandAuthoredChunkId('queenMate')).toBe(true)
    expect(isHandAuthoredChunkId('knightFork')).toBe(false)
  })

  it('selects 12 drilled and 3 transfer from the curated list', () => {
    for (const chunkId of CHUNKS) {
      const { selection, rejected } = selectCuratedChunkSet({
        chunkId,
        tier: chunkId === 'queenMate' ? 0 : 1,
        puzzles: CURATED_MATE_PUZZLES[chunkId],
        claimedIds: new Set<string>(),
        drilledCount: 12,
        transferCount: 3,
      })
      expect(rejected).toEqual([])
      expect(selection.complete).toBe(true)
      expect(selection.drilled).toHaveLength(12)
      expect(selection.transfer).toHaveLength(3)
      // Drilling the easy end means the transfer pair is the hardest three.
      const highestDrilled = Math.max(...selection.drilled.map((puzzle) => puzzle.rating))
      const lowestTransfer = Math.min(...selection.transfer.map((puzzle) => puzzle.rating))
      expect(lowestTransfer).toBeGreaterThan(highestDrilled)
    }
  })

  it('refuses a curated list that does not show the motif', () => {
    // A rook mate filed under queenMate: the predicate has to catch it.
    expect(() =>
      selectCuratedChunkSet({
        chunkId: 'queenMate',
        tier: 0,
        puzzles: [
          {
            id: 'wrong-piece',
            fen: '7k/6pp/8/8/8/8/8/R3K3 w - - 0 1',
            moves: 'a1a8',
            plies: 1,
            rating: 800,
            popularity: 1,
          },
        ],
        claimedIds: new Set<string>(),
        drilledCount: 1,
        transferCount: 0,
      }),
    ).toThrow(/usable curated puzzles/)
  })

  it('refuses a curated puzzle whose side not to move is already in check', () => {
    for (const chunkId of CHUNKS) {
      expect(() =>
        selectCuratedChunkSet({
          chunkId,
          tier: 0,
          puzzles: [
            {
              id: 'illegal',
              fen: '4k3/8/8/8/8/8/8/4KQ2 b - - 0 1',
              moves: 'g1g8',
              plies: 1,
              rating: 800,
              popularity: 1,
            },
          ],
          claimedIds: new Set<string>(),
          drilledCount: 1,
          transferCount: 0,
        }),
      ).toThrow(/usable curated puzzles/)
    }
  })
})

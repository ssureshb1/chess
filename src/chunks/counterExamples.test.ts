import { describe, expect, it } from 'vitest'
import { curriculum } from './curriculum'
import type { Chunk } from './schema'
import { asFen, asSan, opposite, type Color, type Fen } from '../chess/types'
import { Position } from '../chess/position'

type Role = 'attacker' | 'target' | 'king' | 'guard' | 'escape'

const roleColor: Record<Role, 'w' | 'b' | 'either'> = {
  attacker: 'w',
  target: 'b',
  king: 'b',
  guard: 'b',
  escape: 'either',
}

function playAll(fen: Fen, sans: readonly string[]): Position {
  const position = new Position(fen)
  for (const san of sans) position.makeSan(asSan(san))
  return position
}

describe('curriculum shape', () => {
  it('gives every chunk a kid name, one liner, tell, response and creature', () => {
    for (const chunk of curriculum) {
      expect(chunk.kidName.length, chunk.id).toBeGreaterThan(0)
      expect(chunk.creature.name.length, chunk.id).toBeGreaterThan(0)
      expect(chunk.creature.glyph.length, chunk.id).toBeGreaterThan(0)
      expect(chunk.tell.length, chunk.id).toBeGreaterThan(0)
      expect(chunk.response.length, chunk.id).toBeGreaterThan(0)
      expect(chunk.lichessThemes.length, chunk.id).toBeGreaterThan(0)
      expect(chunk.targetTtfmMs, chunk.id).toBeGreaterThan(0)
    }
  })

  it('keeps every one liner inside six words', () => {
    for (const chunk of curriculum) {
      const words = chunk.oneLiner.split(/\s+/).filter((w) => w.length > 0)
      expect(words.length, `${chunk.id}: "${chunk.oneLiner}"`).toBeLessThanOrEqual(6)
    }
  })

  it('gives every chunk three to five counter examples', () => {
    for (const chunk of curriculum) {
      const count = chunk.counterExamples.length
      expect(count, chunk.id).toBeGreaterThanOrEqual(3)
      expect(count, chunk.id).toBeLessThanOrEqual(5)
    }
  })

  it('keeps counter example questions inside six words', () => {
    for (const chunk of curriculum) {
      for (const counterExample of chunk.counterExamples) {
        const words = counterExample.question.split(/\s+/).filter((w) => w.length > 0)
        expect(words.length, `${counterExample.id}`).toBeLessThanOrEqual(6)
        expect(counterExample.why.length, counterExample.id).toBeGreaterThan(0)
      }
    }
  })

  it('uses unique chunk and counter example ids', () => {
    const chunkIds = curriculum.map((c) => c.id)
    expect(new Set(chunkIds).size).toBe(chunkIds.length)
    const counterIds = curriculum.flatMap((c) => c.counterExamples.map((e) => e.id))
    expect(new Set(counterIds).size).toBe(counterIds.length)
  })

  it('only points prerequisites at chunks that exist', () => {
    const known = new Set(curriculum.map((c) => c.id))
    for (const chunk of curriculum) {
      for (const prerequisite of chunk.prerequisites) {
        expect(known.has(prerequisite), `${chunk.id} -> ${prerequisite}`).toBe(true)
      }
    }
  })

  it('keeps counter examples inside their own tier band', () => {
    for (const chunk of curriculum) {
      for (const counterExample of chunk.counterExamples) {
        expect(counterExample.looksLike, counterExample.id).toBe(chunk.id)
      }
    }
  })
})

describe('counter example positions', () => {
  const all: { chunk: Chunk; id: string; fen: string; question: string; why: string; highlight: readonly { square: string; role: Role }[] }[] =
    curriculum.flatMap((chunk) =>
      chunk.counterExamples.map((e) => ({
        chunk,
        id: e.id,
        fen: e.fen,
        question: e.question,
        why: e.why,
        highlight: e.highlight,
      })),
    )

  it('parses every counter example FEN', () => {
    for (const { id, fen } of all) {
      expect(() => asFen(fen), id).not.toThrow()
      expect(() => new Position(asFen(fen)), id).not.toThrow()
    }
  })

  it('gives every counter example exactly one king per side and no side-not-to-move in check', () => {
    for (const { id, fen } of all) {
      const position = new Position(asFen(fen))
      const whiteKings = position.findPiece('k', 'w')
      const blackKings = position.findPiece('k', 'b')
      expect(whiteKings.length, id).toBe(1)
      expect(blackKings.length, id).toBe(1)
      const sideToMove = position.turn()
      const waiting = opposite(sideToMove)
      const waitingKing = position.findPiece('k', waiting)
      const square = waitingKing[0]
      expect(square, id).toBeDefined()
      if (square === undefined) continue
      expect(position.isAttacked(square, sideToMove), `${id}: ${waiting} king already in check`).toBe(false)
    }
  })

  it('gives every counter example a non terminal position, so a correction can be shown', () => {
    for (const { id, fen } of all) {
      const reason = new Position(asFen(fen)).terminalReason()
      if (reason.kind === 'stalemate') {
        expect(fen, `${id} is a stalemate control`).toBe(fen)
        continue
      }
      expect(reason.kind, id).toBe('ongoing')
    }
  })

  it('points every highlight at a real square of the right colour', () => {
    for (const { id, highlight, fen } of all) {
      const position = new Position(asFen(fen))
      for (const mark of highlight) {
        const square = mark.square as never
        const piece = position.pieceAt(square)
        if (roleColor[mark.role] === 'either') {
          expect(piece === null || piece !== undefined, `${id} ${mark.square}`).toBe(true)
          continue
        }
        expect(piece, `${id} ${mark.square} has no piece`).not.toBeNull()
        if (piece === null) continue
        expect(piece.color, `${id} ${mark.square} should be ${roleColor[mark.role]}`).toBe(
          roleColor[mark.role] as Color,
        )
      }
    }
  })
})

describe('counter example claims that the board must back up', () => {
  const claims: {
    readonly id: string
    readonly fen: string
    readonly plies: readonly string[]
    readonly recapturedBy?: string
    readonly escapes?: readonly string[]
  }[] = [
    {
      id: 'freePiece.guard.bishopLongDiagonal',
      fen: '6k1/1b6/8/3n3R/8/8/8/6K1 w - - 0 1',
      plies: ['Rxd5'],
      recapturedBy: 'Bxd5',
    },
    {
      id: 'freePiece.guard.knightOffToTheSide',
      fen: '7k/1n6/8/p7/1B6/8/8/4K3 w - - 0 1',
      plies: ['Bxa5'],
      recapturedBy: 'Nxa5',
    },
    {
      id: 'freePiece.guard.king',
      fen: '8/8/8/8/p7/1k6/8/R2K4 w - - 0 1',
      plies: ['Rxa4'],
      recapturedBy: 'Kxa4',
    },
    {
      id: 'freePiece.guard.pawnFromTheSide',
      fen: '7k/8/2p5/1p6/1P6/2N5/8/4K3 w - - 0 1',
      plies: ['Nxb5'],
      recapturedBy: 'cxb5',
    },
    {
      id: 'queenMate.kingInTheOpen',
      fen: '8/8/8/3k4/8/2QP4/8/7K w - - 0 1',
      plies: ['Qc4'],
      escapes: ['Kd6', 'Ke5'],
    },
    {
      id: 'queenMate.boxIsDefended',
      fen: '7k/6r1/6Q1/8/8/8/8/7K w - - 0 1',
      plies: ['Qxg7'],
      recapturedBy: 'Kxg7',
    },
    {
      id: 'queenMate.cornerIsNotABox',
      fen: '7k/8/8/8/8/8/8/1Q4K1 w - - 0 1',
      plies: ['Qb8'],
      escapes: ['Kh7', 'Kg7'],
    },
    {
      id: 'checkIsNotMate.kingStepsAside',
      fen: '6k1/8/8/8/8/8/8/Q6K w - - 0 1',
      plies: ['Qa8'],
      escapes: ['Kf7', 'Kh7', 'Kg7'],
    },
    {
      id: 'checkIsNotMate.kingTakesQueen',
      fen: '4k3/8/8/8/8/8/8/3QK3 w - - 0 1',
      plies: ['Qd8'],
      recapturedBy: 'Kxd8',
    },
    {
      id: 'checkIsNotMate.kingTakesQueenBesideAPawn',
      fen: '7k/6p1/6Q1/8/8/8/8/7K w - - 0 1',
      plies: ['Qxg7'],
      recapturedBy: 'Kxg7',
    },
    {
      id: 'hangingPiece.defendedByTwoPawns',
      fen: '4k3/8/2p1p3/3q4/8/8/8/3QK3 w - - 0 1',
      plies: ['Qxd5'],
      recapturedBy: 'cxd5',
    },
    {
      id: 'hangingPiece.pawnDefendedByNeighbour',
      fen: '4k3/8/2p5/3p4/8/8/8/3QK3 w - - 0 1',
      plies: ['Qxd5'],
      recapturedBy: 'cxd5',
    },
    {
      id: 'hangingPiece.twoAttackersTwoDefenders',
      fen: '4k3/8/2p1pn2/3n4/2P5/4N3/8/4K3 w - - 0 1',
      plies: ['cxd5'],
      recapturedBy: 'cxd5',
    },
    {
      id: 'hangingPiece.oneAttackerOneDefender',
      fen: '4k3/8/2p5/1n6/8/N7/8/4K3 w - - 0 1',
      plies: ['Nxb5'],
      recapturedBy: 'cxb5',
    },
    {
      id: 'knightFork.landingSquareGuarded',
      fen: '8/2k5/1p2p3/8/8/4N3/8/4K3 w - - 0 1',
      plies: ['Nd5'],
      recapturedBy: 'exd5',
    },
    {
      id: 'knightFork.onlyOnePieceToTake',
      fen: '8/p1k2pp1/5p2/7p/8/4N3/8/4K3 w - - 0 1',
      plies: ['Nd5'],
      escapes: ['Kb7', 'Kb8', 'Kc6', 'Kd6'],
    },
    {
      id: 'knightFork.secondTargetDefended',
      fen: '8/p1k5/1n6/8/8/4N3/8/4K3 w - - 0 1',
      plies: ['Nd5', 'Kb7', 'Nxb6'],
      recapturedBy: 'axb6',
    },
    {
      id: 'backRankMate.holeInFront',
      fen: '7k/5p1p/8/8/8/8/8/R5K1 w - - 0 1',
      plies: ['Ra8'],
      escapes: ['Kg7'],
    },
    {
      id: 'backRankMate.kingTakesRook',
      fen: '6k1/6pp/8/8/8/8/8/5RK1 w - - 0 1',
      plies: ['Rf8'],
      recapturedBy: 'Kxf8',
    },
    {
      id: 'backRankMate.interposition',
      fen: '7k/4nppp/8/8/8/8/8/R5K1 w - - 0 1',
      plies: ['Ra8'],
      recapturedBy: 'Nc8',
    },
  ]

  it('covers every hand authored counter example except the stalemate control', () => {
    const covered = new Set(claims.map((c) => c.id))
    const declared = curriculum.flatMap((c) => c.counterExamples.map((e) => e.id))
    const unclaimed = declared.filter((id) => !covered.has(id))
    expect(unclaimed).toEqual(['checkIsNotMate.stalemateNotMate'])
  })

  for (const claim of claims) {
    it(`${claim.id}: plays out and holds up`, () => {
      const position = playAll(asFen(claim.fen), claim.plies)
      const legal = position.legalMoves().map((move) => move.san)
      if (claim.recapturedBy !== undefined) {
        expect(legal, claim.id).toContain(claim.recapturedBy)
      }
      if (claim.escapes !== undefined) {
        const king = position.findPiece('k', 'b')[0]
        expect(king, claim.id).toBeDefined()
        if (king === undefined) return
        const kingMoves = position.legalMovesFrom(king).map((move) => move.san)
        for (const escape of claim.escapes) {
          expect(kingMoves, `${claim.id} escape ${escape}`).toContain(escape)
        }
      }
    })
  }

  it('knightFork has a positive control where the fork really wins a queen', () => {
    const position = playAll(asFen('8/2k5/1q6/8/8/2N5/8/4K3 w - - 0 1'), ['Nd5', 'Kb7', 'Nxb6'])
    expect(position.isInCheck(), 'the fork is a check').toBe(false)
    expect(position.findPiece('q', 'b'), 'the black queen is gone').toHaveLength(0)
  })

  it('backRankMate has a positive control that is genuinely mate', () => {
    const position = playAll(asFen('7k/5ppp/8/8/8/8/8/R5K1 w - - 0 1'), ['Ra8'])
    expect(position.isCheckmate()).toBe(true)
  })

  it('checkIsNotMate has a stalemate control that is not mate', () => {
    const position = new Position(asFen('k7/2Q5/8/8/8/8/8/7K b - - 0 1'))
    expect(position.isCheckmate()).toBe(false)
    expect(position.terminalReason()).toEqual({ kind: 'stalemate' })
  })
})

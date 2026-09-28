import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { Position } from '../chess/position'
import type { LegalMove } from '../chess/position'
import { ALL_SQUARES, STARTING_FEN, asFen, asPieceSquare, squareAt } from '../chess/types'
import type { Fen, PieceSquare, PieceSymbol } from '../chess/types'
import {
  applyMove,
  intentForDestination,
  lastMoveSquares,
  outcomeForSquare,
  pieceMapOf,
  positionStatus,
  relatedSquares,
  selectableSquares,
} from './boardModel'
import type { Orientation } from './coordinates'
import {
  cellFor,
  fileLabels,
  orderedSquares,
  rankLabels,
  squareAtCell,
  squareShade,
} from './coordinates'
import { ASSET_ROOT, PIECE_NAMES, PROMOTION_TYPES, assetFor, assetForType } from './pieceAsset'

const COLORS = ['w', 'b'] as const
const TYPES = ['p', 'n', 'b', 'r', 'q', 'k'] as const
const ORIENTATIONS: readonly Orientation[] = ['white', 'black']

function moveOf(fen: Fen, from: string, to: string, promotion?: PieceSymbol): LegalMove {
  const position = new Position(fen)
  const wanted = asPieceSquare(to)
  const found = position
    .legalMovesFrom(asPieceSquare(from))
    .filter((move) => move.to === wanted && (move.promotion ?? null) === (promotion ?? null))
  const first = found[0]
  if (first === undefined) throw new Error(`No legal ${from}${to} in ${fen}`)
  return first
}

function readAsset(path: string): string {
  return readFileSync(fileURLToPath(new URL(`../../public${path}`, import.meta.url)), 'utf8')
}

describe('coordinates', () => {
  it('puts a1 in the bottom left with white at the bottom', () => {
    expect(cellFor(asPieceSquare('a1'), 'white')).toEqual({ row: 7, column: 0 })
    expect(cellFor(asPieceSquare('a8'), 'white')).toEqual({ row: 0, column: 0 })
    expect(cellFor(asPieceSquare('h1'), 'white')).toEqual({ row: 7, column: 7 })
    expect(cellFor(asPieceSquare('e4'), 'white')).toEqual({ row: 4, column: 4 })
  })

  it('rotates every cell by 180 degrees for black', () => {
    expect(cellFor(asPieceSquare('a1'), 'black')).toEqual({ row: 0, column: 7 })
    expect(cellFor(asPieceSquare('h8'), 'black')).toEqual({ row: 7, column: 0 })
  })

  it('round-trips every square through its cell in both orientations', () => {
    for (const orientation of ORIENTATIONS) {
      for (const square of ALL_SQUARES) {
        expect(squareAtCell(cellFor(square, orientation), orientation), `${square} ${orientation}`).toBe(
          square,
        )
      }
    }
  })

  it('rejects cells off the board', () => {
    expect(() => squareAtCell({ row: 8, column: 0 }, 'white')).toThrow(/off the board/)
    expect(() => squareAtCell({ row: 0, column: -1 }, 'white')).toThrow(/off the board/)
    expect(() => squareAtCell({ row: 1.5, column: 0 }, 'white')).toThrow(/Non-integer cell/)
  })

  it('lists all sixty-four squares in render order', () => {
    const white = orderedSquares('white')
    const black = orderedSquares('black')
    expect(white).toHaveLength(64)
    expect(new Set(white).size).toBe(64)
    expect(white[0]).toBe('a8')
    expect(white[63]).toBe('h1')
    expect(black[0]).toBe('h1')
    expect(black[63]).toBe('a8')
    expect(white[8]).toBe('a7')
    expect(white[56]).toBe('a1')
  })

  it('labels files and ranks to match the orientation', () => {
    expect(fileLabels('white')).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'])
    expect(fileLabels('black')).toEqual(['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a'])
    expect(rankLabels('white')).toEqual(['8', '7', '6', '5', '4', '3', '2', '1'])
    expect(rankLabels('black')).toEqual(['1', '2', '3', '4', '5', '6', '7', '8'])
  })

  it('knows a1 is dark and h8 is dark', () => {
    expect(squareShade(asPieceSquare('a1'))).toBe('dark')
    expect(squareShade(asPieceSquare('h1'))).toBe('light')
    expect(squareShade(asPieceSquare('a8'))).toBe('light')
    expect(squareShade(asPieceSquare('h8'))).toBe('dark')
    expect(squareShade(asPieceSquare('d4'))).toBe('dark')
    expect(squareShade(asPieceSquare('d1'))).toBe('light')
  })
})

describe('piece assets', () => {
  it('points every piece at the cburnett file for its colour', () => {
    for (const color of COLORS) {
      for (const type of TYPES) {
        expect(assetFor({ color, type })).toBe(`${ASSET_ROOT}/${color === 'w' ? 'white' : 'black'}/${type}.svg`)
        expect(assetForType(type, color)).toBe(assetFor({ color, type }))
      }
    }
  })

  it('ships all twelve svg files on disk', () => {
    for (const color of COLORS) {
      for (const type of TYPES) {
        const svg = readAsset(assetFor({ color, type }))
        expect(svg, `${color}${type}`).toContain('<svg')
      }
    }
  })

  it('draws the white pieces as white fill with a black outline, not a css class', () => {
    for (const type of TYPES) {
      const svg = readAsset(assetForType(type, 'w'))
      expect(svg, type).toContain('#fff')
      expect(svg, type).toContain('#000')
      expect(svg, type).not.toMatch(/class=|<use|href=/)
    }
  })

  it('offers queen, rook, bishop and knight as promotions', () => {
    expect(PROMOTION_TYPES).toEqual(['q', 'r', 'b', 'n'])
    for (const type of TYPES) {
      expect(PIECE_NAMES[type].length, type).toBeGreaterThan(0)
    }
  })
})

describe('board model', () => {
  it('maps the starting position onto thirty-two squares', () => {
    const pieces = pieceMapOf(new Position(STARTING_FEN))
    expect(pieces.size).toBe(32)
    expect(pieces.get(asPieceSquare('e1'))).toEqual({ type: 'k', color: 'w' })
    expect(pieces.get(asPieceSquare('d8'))).toEqual({ type: 'q', color: 'b' })
    expect(pieces.get(asPieceSquare('e4'))).toBeUndefined()
  })

  it('only lets the side to move be selected', () => {
    const before = new Position(STARTING_FEN)
    const selectable = selectableSquares(before)
    expect(selectable.size).toBe(10)
    expect(selectable.has(asPieceSquare('e2'))).toBe(true)
    expect(selectable.has(asPieceSquare('b1'))).toBe(true)
    expect(selectable.has(asPieceSquare('e1'))).toBe(false)
    expect(selectable.has(asPieceSquare('a7'))).toBe(false)
    const after = new Position(applyMove(STARTING_FEN, moveOf(STARTING_FEN, 'e2', 'e4')))
    expect(selectableSquares(after).has(asPieceSquare('e2'))).toBe(false)
    expect(selectableSquares(after).has(asPieceSquare('e7'))).toBe(true)
  })

  it('refuses a move that is not legal in the position', () => {
    const e4 = applyMove(STARTING_FEN, moveOf(STARTING_FEN, 'e2', 'e4'))
    const repeated = applyMove(e4, moveOf(STARTING_FEN, 'e2', 'e4'))
    expect(repeated).toBe(e4)
    expect(new Position(e4).turn()).toBe('b')
  })

  it('moves a pawn two squares and flips the turn', () => {
    const move = moveOf(STARTING_FEN, 'e2', 'e4')
    const position = new Position(applyMove(STARTING_FEN, move))
    expect(position.fen()).toBe('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1')
    expect(position.pieceAt(asPieceSquare('e4'))).toEqual({ type: 'p', color: 'w' })
    expect(position.pieceAt(asPieceSquare('e2'))).toBeNull()
    expect(position.turn()).toBe('b')
  })

  it('moves the king two squares and the rook across on castling', () => {
    const fen = asFen('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1')
    const move = moveOf(fen, 'e1', 'g1')
    expect(move.isCastle).toBe(true)
    const position = new Position(applyMove(fen, move))
    expect(position.pieceAt(asPieceSquare('g1'))).toEqual({ type: 'k', color: 'w' })
    expect(position.pieceAt(asPieceSquare('f1'))).toEqual({ type: 'r', color: 'w' })
    expect(position.pieceAt(asPieceSquare('e1'))).toBeNull()
    expect(position.pieceAt(asPieceSquare('h1'))).toBeNull()
    expect(position.pieceAt(asPieceSquare('h8'))).toEqual({ type: 'r', color: 'b' })
  })

  it('highlights both rook squares for a castle', () => {
    const fen = asFen('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1')
    expect(relatedSquares(moveOf(fen, 'e1', 'g1'))).toEqual(['h1', 'f1'])
    expect(relatedSquares(moveOf(fen, 'e1', 'c1'))).toEqual(['a1', 'd1'])
    expect(lastMoveSquares(moveOf(fen, 'e1', 'g1'))).toEqual(['e1', 'g1', 'h1', 'f1'])
    expect(lastMoveSquares(null)).toEqual([])
  })

  it('removes the captured pawn from a square that is not the destination', () => {
    const fen = asFen('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1')
    const move = moveOf(fen, 'e5', 'd6')
    expect(move.isEnPassant).toBe(true)
    expect(relatedSquares(move)).toEqual(['d5'])
    const position = new Position(applyMove(fen, move))
    expect(position.pieceAt(asPieceSquare('d6'))).toEqual({ type: 'p', color: 'w' })
    expect(position.pieceAt(asPieceSquare('d5'))).toBeNull()
    expect(position.pieceAt(asPieceSquare('e5'))).toBeNull()
  })

  it('reports no related squares for an ordinary move', () => {
    expect(relatedSquares(moveOf(STARTING_FEN, 'e2', 'e4'))).toEqual([])
  })

  it('asks for a piece when the only moves to a square are promotions', () => {
    const fen = asFen('4k3/P7/8/8/8/8/8/4K3 w - - 0 1')
    const moves = new Position(fen).legalMovesFrom(asPieceSquare('a7'))
    const intent = intentForDestination(moves, asPieceSquare('a8'))
    expect(intent.kind).toBe('promotion')
    if (intent.kind !== 'promotion') throw new Error('expected a promotion')
    expect([...intent.moves].map((move) => move.promotion ?? '').sort()).toEqual([
      'b',
      'n',
      'q',
      'r',
    ])
  })

  it('promotes to the chosen piece', () => {
    const fen = asFen('4k3/P7/8/8/8/8/8/4K3 w - - 0 1')
    const knight = moveOf(fen, 'a7', 'a8', 'n')
    const position = new Position(applyMove(fen, knight))
    expect(position.pieceAt(asPieceSquare('a8'))).toEqual({ type: 'n', color: 'w' })
  })

  it('treats a plain destination as a single move and a dead square as nothing', () => {
    const moves = new Position(STARTING_FEN).legalMovesFrom(asPieceSquare('e2'))
    const intent = intentForDestination(moves, asPieceSquare('e4'))
    expect(intent.kind).toBe('move')
    if (intent.kind !== 'move') throw new Error('expected a move')
    expect(intent.move.uci).toBe('e2e4')
    expect(intentForDestination(moves, asPieceSquare('e5')).kind).toBe('none')
    expect(intentForDestination([], asPieceSquare('e4')).kind).toBe('none')
  })

  it('describes the state of a position in words', () => {
    expect(positionStatus(new Position(STARTING_FEN))).toBe('White to move')
    expect(positionStatus(new Position(asFen('4k3/8/8/8/8/8/4R3/4K3 b - - 0 1')))).toBe(
      'Black is in check',
    )
    expect(positionStatus(new Position(asFen('k7/2Q5/8/8/8/8/8/7K b - - 0 1')))).toBe(
      'Draw by stalemate',
    )
    expect(positionStatus(new Position(asFen('8/8/8/4k3/8/8/4K3/8 w - - 0 1')))).toBe(
      'Draw, not enough material',
    )
    const backRank = asFen('7k/5ppp/8/8/8/8/8/R5K1 w - - 0 1')
    expect(positionStatus(new Position(applyMove(backRank, moveOf(backRank, 'a1', 'a8'))))).toBe(
      'White wins by checkmate',
    )
  })

  it('builds the piece map from an arbitrary fen', () => {
    const fen = asFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
    const pieces = pieceMapOf(new Position(fen))
    const squares: PieceSquare[] = [...pieces.keys()]
    expect(squares).toHaveLength(32)
    for (const square of squares) {
      expect(pieces.get(square)?.color, square).toBeDefined()
    }
    expect(pieceMapOf(new Position(asFen('8/8/8/4k3/8/8/4K3/8 w - - 0 1'))).size).toBe(2)
  })

  it('keeps the corners addressable in either orientation', () => {
    expect(orderedSquares('white')[0]).toBe(squareAt('a', '8'))
    expect(orderedSquares('white')[63]).toBe(squareAt('h', '1'))
    expect(orderedSquares('black')[0]).toBe(squareAt('h', '1'))
    expect(orderedSquares('black')[63]).toBe(squareAt('a', '8'))
  })
})

describe('click to move', () => {
  const at = (square: string): PieceSquare => asPieceSquare(square)

  it('selects a piece the side to move can move', () => {
    const outcome = outcomeForSquare(new Position(STARTING_FEN), null, at('e2'))
    expect(outcome.kind).toBe('select')
  })

  it('ignores an enemy piece and an empty square', () => {
    expect(outcomeForSquare(new Position(STARTING_FEN), null, at('e7')).kind).toBe('clear')
    expect(outcomeForSquare(new Position(STARTING_FEN), null, at('e4')).kind).toBe('clear')
  })

  it('ignores a friendly piece that cannot move', () => {
    expect(outcomeForSquare(new Position(STARTING_FEN), null, at('a1')).kind).toBe('clear')
  })

  it('clears the selection when the same piece is clicked twice', () => {
    expect(outcomeForSquare(new Position(STARTING_FEN), at('e2'), at('e2')).kind).toBe('clear')
  })

  it('moves on a legal destination', () => {
    const outcome = outcomeForSquare(new Position(STARTING_FEN), at('e2'), at('e4'))
    expect(outcome.kind).toBe('move')
    if (outcome.kind !== 'move') throw new Error('expected a move')
    expect(outcome.move.uci).toBe('e2e4')
  })

  it('rejects an illegal destination and moves the selection instead', () => {
    const outcome = outcomeForSquare(new Position(STARTING_FEN), at('b1'), at('g1'))
    expect(outcome.kind).toBe('select')
    if (outcome.kind !== 'select') throw new Error('expected a select')
    expect(outcome.square).toBe(at('g1'))
  })

  it('rejects an empty square it cannot reach', () => {
    expect(outcomeForSquare(new Position(STARTING_FEN), at('e2'), at('e5')).kind).toBe('clear')
    expect(outcomeForSquare(new Position(STARTING_FEN), at('e2'), at('a3')).kind).toBe('clear')
  })

  it('rejects a square holding an enemy piece', () => {
    expect(outcomeForSquare(new Position(STARTING_FEN), at('b1'), at('b8')).kind).toBe('clear')
    expect(outcomeForSquare(new Position(STARTING_FEN), at('b1'), at('a1')).kind).toBe('clear')
  })

  it('selects a pinned rook but refuses to move it off the line', () => {
    const fen = asFen('8/8/8/8/8/8/8/Rrk4K b - - 0 1')
    const position = new Position(fen)
    expect(position.isInCheck()).toBe(false)
    expect(position.legalMovesFrom(at('b1')).map((move) => move.san)).toEqual(['Rxa1'])
    expect(outcomeForSquare(position, null, at('b1')).kind).toBe('select')
    expect(outcomeForSquare(position, at('b1'), at('b2')).kind).toBe('clear')
    expect(outcomeForSquare(position, at('b1'), at('a1')).kind).toBe('move')
  })

  it('asks for a piece instead of moving when the destination is a promotion', () => {
    const fen = asFen('4k3/P7/8/8/8/8/8/4K3 w - - 0 1')
    const outcome = outcomeForSquare(new Position(fen), at('a7'), at('a8'))
    expect(outcome.kind).toBe('promotion')
    if (outcome.kind !== 'promotion') throw new Error('expected a promotion')
    expect(outcome.moves).toHaveLength(4)
  })

  it('casts by landing the king two squares away', () => {
    const fen = asFen('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1')
    const outcome = outcomeForSquare(new Position(fen), at('e1'), at('g1'))
    expect(outcome.kind).toBe('move')
    if (outcome.kind !== 'move') throw new Error('expected a move')
    expect(outcome.move.isCastle).toBe(true)
    expect(applyMove(fen, outcome.move)).toBe('r3k2r/8/8/8/8/8/8/R4RK1 b kq - 1 1')
  })

  it('captures en passant onto a square that is not the captured pawn', () => {
    const fen = asFen('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1')
    const outcome = outcomeForSquare(new Position(fen), at('e5'), at('d6'))
    expect(outcome.kind).toBe('move')
    if (outcome.kind !== 'move') throw new Error('expected a move')
    expect(applyMove(fen, outcome.move)).toBe('4k3/8/3P4/8/8/8/8/4K3 b - - 0 1')
  })

  it('drops a stale selection once the position changes underneath it', () => {
    const afterE4 = asFen('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1')
    expect(outcomeForSquare(new Position(afterE4), at('e2'), at('e4')).kind).toBe('clear')
  })
})

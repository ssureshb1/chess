import {
  Chess,
  SQUARES,
  validateFen,
  type Color,
  type Piece,
  type PieceSymbol,
  type Square,
} from 'chess.js'

declare const brand: unique symbol

type Branded<T, TBrand extends string> = T & { readonly [brand]: TBrand }

export type Fen = Branded<string, 'Fen'>
export type UciMove = Branded<string, 'UciMove'>
export type SanMove = Branded<string, 'SanMove'>
export type PieceSquare = Branded<Square, 'PieceSquare'>

export type { Color, Piece, PieceSymbol, Square }

const UCI_PATTERN = /^[a-h][1-8][a-h][1-8][qrbn]?$/
const SAN_PATTERN = /^(O-O-O|O-O|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?)[+#]?$/

export function asFen(raw: string): Fen {
  const { ok, error } = validateFen(raw)
  if (!ok) throw new Error(`Invalid FEN "${raw}": ${error ?? 'unknown reason'}`)
  return raw as Fen
}

export function asUci(raw: string): UciMove {
  if (!UCI_PATTERN.test(raw)) throw new Error(`Invalid UCI move "${raw}"`)
  return raw as UciMove
}

export function asSan(raw: string): SanMove {
  if (!SAN_PATTERN.test(raw)) throw new Error(`Invalid SAN move "${raw}"`)
  return raw as SanMove
}

export function asPieceSquare(raw: string): PieceSquare {
  if (!SQUARES.includes(raw as Square)) throw new Error(`Invalid square "${raw}"`)
  return raw as PieceSquare
}

export function isPieceSquare(raw: string): raw is Square {
  return SQUARES.includes(raw as Square)
}

export const STARTING_FEN = asFen(
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
)

export const ALL_SQUARES = SQUARES.map(asPieceSquare)

export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const
export const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'] as const

export type File = (typeof FILES)[number]
export type Rank = (typeof RANKS)[number]

export function fileOf(square: Square): File {
  return square[0] as File
}

export function rankOf(square: Square): Rank {
  return square[1] as Rank
}

export function squareAt(file: File, rank: Rank): PieceSquare {
  return asPieceSquare(`${file}${rank}`)
}

export function opposite(color: Color): Color {
  return color === 'w' ? 'b' : 'w'
}

export function uciFromSquares(
  from: Square,
  to: Square,
  promotion?: PieceSymbol,
): UciMove {
  return asUci(promotion ? `${from}${to}${promotion}` : `${from}${to}`)
}

export function uciFrom(square: Square): PieceSquare {
  return asPieceSquare(square)
}

export function uciTo(move: UciMove): PieceSquare {
  return asPieceSquare(move.slice(2, 4))
}

export function parseUciMoves(raw: string): UciMove[] {
  return raw
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0)
    .map(asUci)
}

export function sanList(moves: UciMove[], fen: Fen): SanMove[] {
  const board = new Chess(fen)
  return moves.map((move) => {
    const made = board.move(move)
    if (made === null) throw new Error(`Illegal move ${move} in position ${fen}`)
    return asSan(made.san)
  })
}

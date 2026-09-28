import type { Color, Piece, PieceSymbol } from '../chess/types'

export const ASSET_ROOT = '/pieces/cburnett'

const COLOR_DIRECTORIES = {
  w: 'white',
  b: 'black',
} as const satisfies Record<Color, string>

export const PROMOTION_TYPES: readonly PieceSymbol[] = ['q', 'r', 'b', 'n']

export const PIECE_NAMES = {
  p: 'pawn',
  n: 'knight',
  b: 'bishop',
  r: 'rook',
  q: 'queen',
  k: 'king',
} as const satisfies Record<PieceSymbol, string>

export const COLOR_NAMES = {
  w: 'white',
  b: 'black',
} as const satisfies Record<Color, string>

export function assetFor(piece: Piece): string {
  return `${ASSET_ROOT}/${COLOR_DIRECTORIES[piece.color]}/${piece.type}.svg`
}

export function assetForType(type: PieceSymbol, color: Color): string {
  return `${ASSET_ROOT}/${COLOR_DIRECTORIES[color]}/${type}.svg`
}

import { Position } from '../chess/position'
import type { LegalMove } from '../chess/position'
import { fileOf, rankOf, squareAt } from '../chess/types'
import type { Color, Fen, Piece, PieceSquare } from '../chess/types'

export type PieceMap = ReadonlyMap<PieceSquare, Piece>

export type MoveIntent =
  | { readonly kind: 'none' }
  | { readonly kind: 'move'; readonly move: LegalMove }
  | { readonly kind: 'promotion'; readonly moves: readonly LegalMove[] }

export function pieceMapOf(position: Position): PieceMap {
  const map = new Map<PieceSquare, Piece>()
  for (const square of position.occupiedSquares()) {
    const piece = position.pieceAt(square)
    if (piece !== null) map.set(square, piece)
  }
  return map
}

export function selectableSquares(position: Position): ReadonlySet<PieceSquare> {
  const turn = position.turn()
  const squares = new Set<PieceSquare>()
  for (const move of position.legalMoves()) {
    const piece = position.pieceAt(move.from)
    if (piece !== null && piece.color === turn) squares.add(move.from)
  }
  return squares
}

export function intentForDestination(
  moves: readonly LegalMove[],
  to: PieceSquare,
): MoveIntent {
  const candidates = moves.filter((move) => move.to === to)
  const promotions = candidates.filter((move) => move.promotion !== null)
  const first = candidates[0]
  if (first === undefined) return { kind: 'none' }
  if (promotions.length > 0) return { kind: 'promotion', moves: promotions }
  return { kind: 'move', move: first }
}

export type SquareOutcome =
  | { readonly kind: 'clear' }
  | { readonly kind: 'select'; readonly square: PieceSquare }
  | { readonly kind: 'move'; readonly move: LegalMove }
  | { readonly kind: 'promotion'; readonly moves: readonly LegalMove[] }

export function outcomeForSquare(
  position: Position,
  selected: PieceSquare | null,
  square: PieceSquare,
): SquareOutcome {
  if (selected !== null) {
    const intent = intentForDestination(position.legalMovesFrom(selected), square)
    if (intent.kind === 'promotion') return { kind: 'promotion', moves: intent.moves }
    if (intent.kind === 'move') return { kind: 'move', move: intent.move }
    if (selected === square) return { kind: 'clear' }
  }
  if (position.legalMovesFrom(square).length > 0 && position.pieceAt(square)?.color === position.turn()) {
    return { kind: 'select', square }
  }
  return { kind: 'clear' }
}

export function applyMove(fen: Fen, move: LegalMove): Fen {
  const position = new Position(fen)
  if (!position.isLegal(move.from, move.to, move.promotion ?? undefined)) return fen
  position.makeUci(move.uci)
  return position.fen()
}

export function relatedSquares(move: LegalMove): readonly PieceSquare[] {
  const rank = rankOf(move.from)
  if (move.isEnPassant) return [squareAt(fileOf(move.to), rank)]
  if (move.isCastle) {
    const kingSide = fileOf(move.to) === 'g'
    return [squareAt(kingSide ? 'h' : 'a', rank), squareAt(kingSide ? 'f' : 'd', rank)]
  }
  return []
}

export function lastMoveSquares(move: LegalMove | null): readonly PieceSquare[] {
  return move === null ? [] : [move.from, move.to, ...relatedSquares(move)]
}

function colorName(color: Color): string {
  return color === 'w' ? 'White' : 'Black'
}

export function positionStatus(position: Position): string {
  const reason = position.terminalReason()
  switch (reason.kind) {
    case 'checkmate':
      return `${colorName(reason.winner)} wins by checkmate`
    case 'stalemate':
      return 'Draw by stalemate'
    case 'insufficientMaterial':
      return 'Draw, not enough material'
    case 'threefoldRepetition':
      return 'Draw by threefold repetition'
    case 'fiftyMoveRule':
      return 'Draw by the fifty-move rule'
    case 'ongoing':
      return position.isInCheck()
        ? `${colorName(position.turn())} is in check`
        : `${colorName(position.turn())} to move`
  }
}

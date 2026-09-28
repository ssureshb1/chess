import { Chess, type Move as ChessJsMove } from 'chess.js'
import {
  asFen,
  asPieceSquare,
  asSan,
  asUci,
  opposite,
  STARTING_FEN,
  type Color,
  type Fen,
  type Piece,
  type PieceSquare,
  type PieceSymbol,
  type SanMove,
  type UciMove,
} from './types'

export type TerminalReason =
  | { kind: 'checkmate'; winner: Color }
  | { kind: 'stalemate' }
  | { kind: 'insufficientMaterial' }
  | { kind: 'threefoldRepetition' }
  | { kind: 'fiftyMoveRule' }
  | { kind: 'ongoing' }

export type LegalMove = {
  readonly from: PieceSquare
  readonly to: PieceSquare
  readonly uci: UciMove
  readonly san: SanMove
  readonly piece: PieceSymbol
  readonly captured: PieceSymbol | null
  readonly promotion: PieceSymbol | null
  readonly isCastle: boolean
  readonly isCapture: boolean
  readonly isEnPassant: boolean
}

function toLegalMove(move: ChessJsMove): LegalMove {
  return {
    from: asPieceSquare(move.from),
    to: asPieceSquare(move.to),
    uci: asUci(
      move.promotion ? `${move.from}${move.to}${move.promotion}` : `${move.from}${move.to}`,
    ),
    san: asSan(move.san),
    piece: move.piece,
    captured: move.captured ?? null,
    promotion: move.promotion ?? null,
    isCastle: move.isKingsideCastle() || move.isQueensideCastle(),
    isCapture: move.isCapture(),
    isEnPassant: move.isEnPassant(),
  }
}

export class Position {
  private readonly board: Chess

  constructor(fen: Fen) {
    this.board = new Chess(fen)
  }

  static fromStartingPosition(): Position {
    return new Position(STARTING_FEN)
  }

  fen(): Fen {
    return asFen(this.board.fen())
  }

  turn(): Color {
    return this.board.turn()
  }

  turnOfOpponent(): Color {
    return opposite(this.board.turn())
  }

  pieceAt(square: PieceSquare): Piece | null {
    return this.board.get(square) ?? null
  }

  occupiedSquares(): readonly PieceSquare[] {
    return this.board
      .board()
      .flatMap((row) => row)
      .filter((cell) => cell !== null)
      .map((cell) => asPieceSquare(cell.square))
  }

  findPiece(type: PieceSymbol, color: Color): readonly PieceSquare[] {
    return this.board.findPiece({ type, color }).map(asPieceSquare)
  }

  legalMoves(): readonly LegalMove[] {
    return this.board.moves({ verbose: true }).map(toLegalMove)
  }

  legalMovesFrom(square: PieceSquare): readonly LegalMove[] {
    return this.board.moves({ square, verbose: true }).map(toLegalMove)
  }

  legalTargetsFrom(square: PieceSquare): readonly PieceSquare[] {
    return this.legalMovesFrom(square).map((move) => move.to)
  }

  isLegal(from: PieceSquare, to: PieceSquare, promotion?: PieceSymbol): boolean {
    const probe = new Chess(this.board.fen())
    try {
      probe.move({
        from,
        to,
        ...(promotion ? { promotion } : {}),
      })
    } catch {
      return false
    }
    return true
  }

  isAttacked(square: PieceSquare, by: Color): boolean {
    return this.board.isAttacked(square, by)
  }

  isInCheck(): boolean {
    return this.board.inCheck()
  }

  isCheckmate(): boolean {
    return this.board.isCheckmate()
  }

  isStalemate(): boolean {
    return this.board.isStalemate()
  }

  terminalReason(): TerminalReason {
    if (this.board.isCheckmate()) {
      return { kind: 'checkmate', winner: this.board.turn() === 'w' ? 'b' : 'w' }
    }
    if (this.board.isStalemate()) return { kind: 'stalemate' }
    if (this.board.isInsufficientMaterial()) return { kind: 'insufficientMaterial' }
    if (this.board.isThreefoldRepetition()) return { kind: 'threefoldRepetition' }
    if (this.board.isDrawByFiftyMoves()) return { kind: 'fiftyMoveRule' }
    return { kind: 'ongoing' }
  }

  makeUci(move: UciMove): LegalMove {
    const made = this.board.move(move)
    if (made === null) throw new Error(`Illegal move ${move} in position ${this.board.fen()}`)
    return toLegalMove(made)
  }

  makeSan(move: SanMove): LegalMove {
    const made = this.board.move(move)
    if (made === null) throw new Error(`Illegal move ${move} in position ${this.board.fen()}`)
    return toLegalMove(made)
  }

  undo(): boolean {
    return this.board.undo() !== null
  }

  moveNumber(): number {
    return this.board.moveNumber()
  }

  history(): readonly SanMove[] {
    return this.board.history().map(asSan)
  }
}

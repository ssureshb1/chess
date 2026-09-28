import { FILES, RANKS, fileOf, rankOf, squareAt } from '../chess/types'
import type { File, PieceSquare, Rank } from '../chess/types'

export const ORIENTATIONS = ['white', 'black'] as const

export type Orientation = (typeof ORIENTATIONS)[number]

export type SquareShade = 'light' | 'dark'

export type GridCell = {
  readonly row: number
  readonly column: number
}

const COLUMN_COUNT = 8
const ROW_COUNT = 8
const LAST_COLUMN = 7
const LAST_ROW = 7

function at<T>(items: readonly T[], index: number, what: string): T {
  const item = items[index]
  if (item === undefined) throw new Error(`No ${what} at index ${index}`)
  return item
}

export function fileIndexOf(square: PieceSquare): number {
  return FILES.indexOf(fileOf(square))
}

export function rankIndexOf(square: PieceSquare): number {
  return RANKS.indexOf(rankOf(square))
}

export function squareShade(square: PieceSquare): SquareShade {
  return (fileIndexOf(square) + rankIndexOf(square)) % 2 === 0 ? 'dark' : 'light'
}

export function isFlipped(orientation: Orientation): boolean {
  return orientation === 'black'
}

export function cellFor(square: PieceSquare, orientation: Orientation): GridCell {
  const file = fileIndexOf(square)
  const rank = rankIndexOf(square)
  return isFlipped(orientation)
    ? { row: rank, column: LAST_COLUMN - file }
    : { row: LAST_ROW - rank, column: file }
}

export function squareAtCell(cell: GridCell, orientation: Orientation): PieceSquare {
  if (!Number.isInteger(cell.row) || !Number.isInteger(cell.column)) {
    throw new Error(`Non-integer cell ${cell.row},${cell.column}`)
  }
  if (cell.row < 0 || cell.row > LAST_ROW || cell.column < 0 || cell.column > LAST_COLUMN) {
    throw new Error(`Cell ${cell.row},${cell.column} is off the board`)
  }
  const file = at(FILES, isFlipped(orientation) ? LAST_COLUMN - cell.column : cell.column, 'file')
  const rank = at(RANKS, isFlipped(orientation) ? cell.row : LAST_ROW - cell.row, 'rank')
  return squareAt(file, rank)
}

export function orderedSquares(orientation: Orientation): readonly PieceSquare[] {
  const squares: PieceSquare[] = []
  for (let row = 0; row < ROW_COUNT; row += 1) {
    for (let column = 0; column < COLUMN_COUNT; column += 1) {
      squares.push(squareAtCell({ row, column }, orientation))
    }
  }
  return squares
}

export function fileLabels(orientation: Orientation): readonly File[] {
  return isFlipped(orientation) ? [...FILES].reverse() : [...FILES]
}

export function rankLabels(orientation: Orientation): readonly Rank[] {
  return isFlipped(orientation) ? [...RANKS] : [...RANKS].reverse()
}

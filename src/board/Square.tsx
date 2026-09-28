import type { ReactElement } from 'react'
import type { Piece, PieceSquare } from '../chess/types'
import { squareShade } from './coordinates'
import { COLOR_NAMES, PIECE_NAMES, assetFor } from './pieceAsset'

export type SquareProps = {
  readonly square: PieceSquare
  readonly piece: Piece | null
  readonly selected: boolean
  readonly target: boolean
  readonly lastMove: boolean
  readonly related: boolean
  readonly onSelect: (square: PieceSquare) => void
}

function labelFor(square: PieceSquare, piece: Piece | null): string {
  if (piece === null) return square
  return `${square}, ${COLOR_NAMES[piece.color]} ${PIECE_NAMES[piece.type]}`
}

export const Square = ({
  square,
  piece,
  selected,
  target,
  lastMove,
  related,
  onSelect,
}: SquareProps): ReactElement => {
  const classes = ['square', `square--${squareShade(square)}`]
  if (selected) classes.push('square--selected')
  if (target) classes.push('square--target')
  if (target && piece !== null) classes.push('square--capture')
  if (lastMove) classes.push('square--last')
  if (related) classes.push('square--related')

  return (
    <button
      type="button"
      className={classes.join(' ')}
      data-square={square}
      aria-label={labelFor(square, piece)}
      aria-pressed={selected}
      onClick={() => {
        onSelect(square)
      }}
    >
      {piece !== null && (
        <img className="square__piece" src={assetFor(piece)} alt="" draggable={false} />
      )}
      {target && <span className="square__target" aria-hidden="true" />}
    </button>
  )
}

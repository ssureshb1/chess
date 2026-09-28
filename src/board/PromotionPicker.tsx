import type { ReactElement } from 'react'
import type { LegalMove } from '../chess/position'
import type { Color, PieceSymbol } from '../chess/types'
import { PROMOTION_TYPES, PIECE_NAMES, assetForType } from './pieceAsset'

function promotionTypeOf(move: LegalMove): PieceSymbol {
  return move.promotion ?? move.piece
}

export type PromotionPickerProps = {
  readonly moves: readonly LegalMove[]
  readonly color: Color
  readonly onChoose: (move: LegalMove) => void
  readonly onCancel: () => void
}

export const PromotionPicker = ({
  moves,
  color,
  onChoose,
  onCancel,
}: PromotionPickerProps): ReactElement => {
  const ordered = [...moves].sort(
    (a, b) => PROMOTION_TYPES.indexOf(promotionTypeOf(a)) - PROMOTION_TYPES.indexOf(promotionTypeOf(b)),
  )

  return (
    <div className="promotion" role="group" aria-label="Choose a piece">
      {ordered.map((move) => {
        const type = promotionTypeOf(move)
        return (
          <button
            key={move.uci}
            type="button"
            className="promotion__choice"
            onClick={() => {
              onChoose(move)
            }}
          >
            <img src={assetForType(type, color)} alt="" draggable={false} />
            <span>{PIECE_NAMES[type]}</span>
          </button>
        )
      })}
      <button type="button" className="promotion__cancel" onClick={onCancel}>
        Cancel
      </button>
    </div>
  )
}

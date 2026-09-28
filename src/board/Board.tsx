import { useState } from 'react'
import type { ReactElement } from 'react'
import type { LegalMove, Position } from '../chess/position'
import type { PieceSquare } from '../chess/types'
import { PromotionPicker } from './PromotionPicker'
import { Square } from './Square'
import {
  lastMoveSquares,
  outcomeForSquare,
  pieceMapOf,
  relatedSquares,
  selectableSquares,
} from './boardModel'
import type { Orientation } from './coordinates'
import { fileLabels, orderedSquares, rankLabels } from './coordinates'

export type BoardProps = {
  readonly position: Position
  readonly onMove: (move: LegalMove) => void
  readonly orientation?: Orientation
  readonly lastMove?: LegalMove | null
}

export const Board = ({
  position,
  onMove,
  orientation = 'white',
  lastMove = null,
}: BoardProps): ReactElement => {
  const [chosen, setChosen] = useState<PieceSquare | null>(null)
  const [promotions, setPromotions] = useState<readonly LegalMove[] | null>(null)

  const selectable = selectableSquares(position)
  const selected = chosen !== null && selectable.has(chosen) ? chosen : null
  const pieces = pieceMapOf(position)
  const targets = selected === null ? [] : position.legalTargetsFrom(selected)
  const moved = lastMoveSquares(lastMove)
  const related = lastMove === null ? [] : relatedSquares(lastMove)

  const commit = (move: LegalMove): void => {
    setChosen(null)
    setPromotions(null)
    onMove(move)
  }

  const onSelect = (square: PieceSquare): void => {
    setPromotions(null)
    const outcome = outcomeForSquare(position, selected, square)
    if (outcome.kind === 'move') {
      commit(outcome.move)
      return
    }
    if (outcome.kind === 'promotion') {
      setPromotions(outcome.moves)
      return
    }
    setChosen(outcome.kind === 'select' ? outcome.square : null)
  }

  return (
    <div className="board" data-orientation={orientation}>
      <div className="board__ranks" aria-hidden="true">
        {rankLabels(orientation).map((rank) => (
          <span key={rank} className="board__label">
            {rank}
          </span>
        ))}
      </div>
      <div className="board__grid" role="group" aria-label="Chess board">
        {orderedSquares(orientation).map((square) => (
          <Square
            key={square}
            square={square}
            piece={pieces.get(square) ?? null}
            selected={selected === square}
            target={selected !== null && targets.includes(square)}
            lastMove={moved.includes(square)}
            related={related.includes(square)}
            onSelect={onSelect}
          />
        ))}
      </div>
      <div className="board__corner" aria-hidden="true" />
      <div className="board__files" aria-hidden="true">
        {fileLabels(orientation).map((file) => (
          <span key={file} className="board__label">
            {file}
          </span>
        ))}
      </div>
      {promotions !== null && (
        <PromotionPicker
          moves={promotions}
          color={position.turn()}
          onChoose={commit}
          onCancel={() => {
            setPromotions(null)
          }}
        />
      )}
    </div>
  )
}

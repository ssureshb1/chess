import { useState } from 'react'
import type { FormEvent, ReactElement } from 'react'
import { Board } from '../board/Board'
import { applyMove, positionStatus } from '../board/boardModel'
import type { Orientation } from '../board/coordinates'
import { Position } from '../chess/position'
import type { LegalMove } from '../chess/position'
import { STARTING_FEN, asFen } from '../chess/types'
import type { Fen } from '../chess/types'

const SIDE_LABELS: Record<Orientation, string> = {
  white: 'White at the bottom',
  black: 'Black at the bottom',
}

export const App = (): ReactElement => {
  const [fen, setFen] = useState<Fen>(STARTING_FEN)
  const [draft, setDraft] = useState<string>(STARTING_FEN)
  const [problem, setProblem] = useState<string | null>(null)
  const [lastMove, setLastMove] = useState<LegalMove | null>(null)
  const [orientation, setOrientation] = useState<Orientation>('white')

  const position = new Position(fen)

  const onMove = (move: LegalMove): void => {
    setFen((current) => applyMove(current, move))
    setLastMove(move)
    setProblem(null)
  }

  const loadFen = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    try {
      const next = asFen(draft.trim())
      setFen(next)
      setLastMove(null)
      setProblem(null)
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'That is not a valid FEN.')
    }
  }

  return (
    <main className="app">
      <h1 className="app__title">Chunk Chess</h1>
      <p className="app__status">
        {positionStatus(position)}
        {lastMove === null ? '' : ` · ${lastMove.san}`}
      </p>
      <Board
        position={position}
        orientation={orientation}
        lastMove={lastMove}
        onMove={onMove}
      />
      <div className="app__row">
        <button
          type="button"
          className="button"
          onClick={() => {
            setOrientation(orientation === 'white' ? 'black' : 'white')
          }}
        >
          {SIDE_LABELS[orientation === 'white' ? 'black' : 'white']}
        </button>
      </div>
      <form className="app__row" onSubmit={loadFen}>
        <label className="app__label" htmlFor="fen">
          FEN
        </label>
        <input
          id="fen"
          className="app__fen"
          value={draft}
          spellCheck={false}
          autoComplete="off"
          onChange={(event) => {
            setDraft(event.target.value)
          }}
        />
        <button type="submit" className="button">
          Load
        </button>
        <button
          type="button"
          className="button"
          onClick={() => {
            setFen(STARTING_FEN)
            setDraft(STARTING_FEN)
            setLastMove(null)
            setProblem(null)
          }}
        >
          Start
        </button>
      </form>
      {problem !== null && <p className="app__problem">{problem}</p>}
      <p className="app__current">{position.fen()}</p>
    </main>
  )
}

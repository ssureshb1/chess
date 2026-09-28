/**
 * A hand-authored puzzle. These are not mined from Lichess, so there is no
 * source rating: `rating` is a synthetic difficulty ladder used only by the
 * parent dashboard, and `plies` is the length of `moves`.
 */
export type CuratedPuzzle = {
  readonly id: string
  readonly fen: string
  readonly moves: string
  readonly plies: number
  readonly rating: number
  readonly popularity: number
}

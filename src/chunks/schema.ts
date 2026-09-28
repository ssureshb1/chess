export type ChunkTier = 0 | 1 | 2 | 3 | 4

export type ChunkId =
  | 'takeTheFreePiece'
  | 'queenMate'
  | 'checkIsNotMate'
  | 'hangingPiece'
  | 'knightFork'
  | 'backRankMate'
  | 'pin'
  | 'skewer'
  | 'discoveredAttack'
  | 'doubleAttack'
  | 'trapThePiece'
  | 'mateIn2'
  | 'deflection'
  | 'clearance'
  | 'interference'
  | 'xRayAttack'
  | 'sacrifice'
  | 'quietMove'
  | 'opposition'
  | 'squareRule'
  | 'shoulderTheKing'

export type CreatureId =
  | 'pickpocket'
  | 'queenCrown'
  | 'truthTeller'
  | 'looseTooth'
  | 'sirFork'
  | 'shieldWall'
  | 'spike'
  | 'lure'
  | 'ghost'
  | 'twinFang'
  | 'ratTrap'
  | 'sunDial'
  | 'kite'
  | 'broom'
  | 'tripwire'
  | 'xRayEye'
  | 'baker'
  | 'ghostStep'
  | 'bulldog'
  | 'paintbrush'
  | 'shoulder'

export type HighlightRole = 'attacker' | 'target' | 'king' | 'guard' | 'escape'

export type Highlight = {
  readonly square: string
  readonly role: HighlightRole
}

export type CounterExample = {
  readonly id: string
  readonly fen: string
  readonly question: string
  readonly why: string
  readonly looksLike: ChunkId
  readonly highlight: readonly Highlight[]
}

export type Chunk = {
  readonly id: ChunkId
  readonly tier: ChunkTier
  readonly kidName: string
  readonly creature: {
    readonly id: CreatureId
    readonly name: string
    readonly glyph: string
  }
  readonly oneLiner: string
  readonly tell: string
  readonly response: string
  readonly lichessThemes: readonly string[]
  readonly counterExamples: readonly CounterExample[]
  readonly prerequisites: readonly ChunkId[]
  readonly targetTtfmMs: number
}

export type PuzzleSource = 'lichess' | 'curated' | 'game'

export type Puzzle = {
  readonly id: string
  readonly fen: string
  readonly solution: readonly string[]
  readonly rating: number
  readonly themes: readonly string[]
  readonly source: PuzzleSource
}

import type { Chunk, ChunkId } from './schema'

export const curriculum: readonly Chunk[] = [
  {
    id: 'takeTheFreePiece',
    tier: 0,
    kidName: 'Free Stuff',
    creature: { id: 'pickpocket', name: 'Picky', glyph: '🖐' },
    oneLiner: 'Take the piece nobody guards',
    tell: 'A piece sits there. No enemy guards it. Nothing of yours stops you.',
    response: 'Move in and take it.',
    lichessThemes: ['hangingPiece'],
    targetTtfmMs: 4000,
    prerequisites: [],
    counterExamples: [
      {
        id: 'freePiece.guard.bishopLongDiagonal',
        fen: '6k1/1b6/8/3n3R/8/8/8/6K1 w - - 0 1',
        question: 'Is this piece really free?',
        why: 'The bishop slides down the long diagonal and takes it straight back.',
        looksLike: 'takeTheFreePiece',
        highlight: [
          { square: 'd5', role: 'target' },
          { square: 'b7', role: 'guard' },
        ],
      },
      {
        id: 'freePiece.guard.knightOffToTheSide',
        fen: '7k/1n6/8/p7/1B6/8/8/4K3 w - - 0 1',
        question: 'Is this piece really free?',
        why: 'The knight on b7 jumps in from far away and takes it back.',
        looksLike: 'takeTheFreePiece',
        highlight: [
          { square: 'a5', role: 'target' },
          { square: 'b7', role: 'guard' },
        ],
      },
      {
        id: 'freePiece.guard.king',
        fen: '8/8/8/8/p7/1k6/8/R2K4 w - - 0 1',
        question: 'Is this piece really free?',
        why: 'The king is a guard too. He walks over and takes it.',
        looksLike: 'takeTheFreePiece',
        highlight: [
          { square: 'a4', role: 'target' },
          { square: 'b3', role: 'guard' },
        ],
      },
      {
        id: 'freePiece.guard.pawnFromTheSide',
        fen: '7k/8/2p5/1p6/1P6/2N5/8/4K3 w - - 0 1',
        question: 'Is this piece really free?',
        why: 'The pawn on c6 steps sideways and takes it straight back.',
        looksLike: 'takeTheFreePiece',
        highlight: [
          { square: 'b5', role: 'target' },
          { square: 'c6', role: 'guard' },
        ],
      },
    ],
  },

  {
    id: 'queenMate',
    tier: 0,
    kidName: 'Corner King',
    creature: { id: 'queenCrown', name: 'Queenie', glyph: '👑' },
    oneLiner: 'Push the king to the edge',
    tell: 'Their king is on the edge and every square around him is shut.',
    response: 'Squeeze him into the corner and finish.',
    lichessThemes: ['mateIn1'],
    targetTtfmMs: 4000,
    prerequisites: ['takeTheFreePiece'],
    counterExamples: [
      {
        id: 'queenMate.kingInTheOpen',
        fen: '8/8/8/3k4/8/2QP4/8/7K w - - 0 1',
        question: 'Is this a queen mate?',
        why: 'He is in the middle of the board. He walks away.',
        looksLike: 'queenMate',
        highlight: [
          { square: 'd5', role: 'king' },
          { square: 'd6', role: 'escape' },
        ],
      },
      {
        id: 'queenMate.boxIsDefended',
        fen: '7k/6r1/6Q1/8/8/8/8/7K w - - 0 1',
        question: 'Is this a queen mate?',
        why: 'The rook guards the corner, so the king walks over and eats the queen.',
        looksLike: 'queenMate',
        highlight: [
          { square: 'g6', role: 'attacker' },
          { square: 'g7', role: 'guard' },
          { square: 'h8', role: 'king' },
        ],
      },
      {
        id: 'queenMate.cornerIsNotABox',
        fen: '7k/8/8/8/8/8/8/1Q4K1 w - - 0 1',
        question: 'Is this a queen mate?',
        why: 'No pawns guard him. He steps out to the side.',
        looksLike: 'queenMate',
        highlight: [
          { square: 'h8', role: 'king' },
          { square: 'h7', role: 'escape' },
        ],
      },
    ],
  },

  {
    id: 'checkIsNotMate',
    tier: 0,
    kidName: 'Just A Check',
    creature: { id: 'truthTeller', name: 'Tilly', glyph: '🔔' },
    oneLiner: 'Check is not mate',
    tell: 'The king is attacked. Does he still have a free square to run to?',
    response: 'Look again for the empty square next to the king.',
    lichessThemes: ['mateIn1'],
    targetTtfmMs: 3500,
    prerequisites: ['queenMate'],
    counterExamples: [
      {
        id: 'checkIsNotMate.kingStepsAside',
        fen: '6k1/8/8/8/8/8/8/Q6K w - - 0 1',
        question: 'Is this really mate?',
        why: 'The king just steps onto a free square.',
        looksLike: 'checkIsNotMate',
        highlight: [
          { square: 'g8', role: 'king' },
          { square: 'f7', role: 'escape' },
        ],
      },
      {
        id: 'checkIsNotMate.kingTakesQueen',
        fen: '4k3/8/8/8/8/8/8/3QK3 w - - 0 1',
        question: 'Is this really mate?',
        why: 'The king is right next to the queen. He eats her.',
        looksLike: 'checkIsNotMate',
        highlight: [
          { square: 'd1', role: 'attacker' },
          { square: 'e8', role: 'king' },
        ],
      },
      {
        id: 'checkIsNotMate.kingTakesQueenBesideAPawn',
        fen: '7k/6p1/6Q1/8/8/8/8/7K w - - 0 1',
        question: 'Is this really mate?',
        why: 'Same trap. The king is next to the queen and eats her.',
        looksLike: 'checkIsNotMate',
        highlight: [
          { square: 'g6', role: 'attacker' },
          { square: 'h8', role: 'king' },
        ],
      },
      {
        id: 'checkIsNotMate.stalemateNotMate',
        fen: 'k7/2Q5/8/8/8/8/8/7K b - - 0 1',
        question: 'Is this really mate?',
        why: 'No moves left, but he is not even in check. That is stalemate, not mate.',
        looksLike: 'checkIsNotMate',
        highlight: [{ square: 'a8', role: 'king' }],
      },
    ],
  },

  {
    id: 'hangingPiece',
    tier: 1,
    kidName: 'Loose Tooth',
    creature: { id: 'looseTooth', name: 'Toothy', glyph: '🦷' },
    oneLiner: 'They hit it more than you',
    tell: 'Two of yours can take it. Only one of theirs can save it.',
    response: 'Take it. When they take it back, take again.',
    lichessThemes: ['hangingPiece'],
    targetTtfmMs: 3500,
    prerequisites: ['takeTheFreePiece'],
    counterExamples: [
      {
        id: 'hangingPiece.defendedByTwoPawns',
        fen: '4k3/8/2p1p3/3q4/8/8/8/3QK3 w - - 0 1',
        question: 'Is this piece really loose?',
        why: 'Two pawns take it straight back. You gain nothing.',
        looksLike: 'hangingPiece',
        highlight: [
          { square: 'd5', role: 'target' },
          { square: 'c6', role: 'guard' },
          { square: 'e6', role: 'guard' },
        ],
      },
      {
        id: 'hangingPiece.pawnDefendedByNeighbour',
        fen: '4k3/8/2p5/3p4/8/8/8/3QK3 w - - 0 1',
        question: 'Is this piece really loose?',
        why: 'The pawn on c6 steps sideways and takes it straight back.',
        looksLike: 'hangingPiece',
        highlight: [
          { square: 'd5', role: 'target' },
          { square: 'c6', role: 'guard' },
        ],
      },
      {
        id: 'hangingPiece.twoAttackersTwoDefenders',
        fen: '4k3/8/2p1pn2/3n4/2P5/4N3/8/4K3 w - - 0 1',
        question: 'Is this piece really loose?',
        why: 'Two of mine attack, two of theirs defend. That is an even trade.',
        looksLike: 'hangingPiece',
        highlight: [
          { square: 'd5', role: 'target' },
          { square: 'c4', role: 'attacker' },
          { square: 'e3', role: 'attacker' },
          { square: 'c6', role: 'guard' },
          { square: 'e6', role: 'guard' },
        ],
      },
      {
        id: 'hangingPiece.oneAttackerOneDefender',
        fen: '4k3/8/2p5/1n6/8/N7/8/4K3 w - - 0 1',
        question: 'Is this piece really loose?',
        why: 'One attacks, one defends. Even trade, so nothing is won.',
        looksLike: 'hangingPiece',
        highlight: [
          { square: 'b5', role: 'target' },
          { square: 'a3', role: 'attacker' },
          { square: 'c6', role: 'guard' },
        ],
      },
    ],
  },

  {
    id: 'knightFork',
    tier: 1,
    kidName: 'Sticky Fork',
    creature: { id: 'sirFork', name: 'Sir Fork', glyph: '🐴' },
    oneLiner: 'One knight, two targets',
    tell: 'A knight jumps in. It hits the king and one more piece. Nothing guards the knight.',
    response: 'Jump in and win the piece.',
    lichessThemes: ['fork'],
    targetTtfmMs: 2500,
    prerequisites: ['hangingPiece'],
    counterExamples: [
      {
        id: 'knightFork.landingSquareGuarded',
        fen: '8/2k5/1p2p3/8/8/4N3/8/4K3 w - - 0 1',
        question: 'Is this a real fork?',
        why: 'The pawn on e6 guards the landing square and takes the knight back.',
        looksLike: 'knightFork',
        highlight: [
          { square: 'e3', role: 'attacker' },
          { square: 'c7', role: 'king' },
          { square: 'b6', role: 'target' },
          { square: 'e6', role: 'guard' },
        ],
      },
      {
        id: 'knightFork.onlyOnePieceToTake',
        fen: '8/p1k2pp1/5p2/7p/8/4N3/8/4K3 w - - 0 1',
        question: 'Is this a real fork?',
        why: 'The board is busy but there is no second piece. Only a check.',
        looksLike: 'knightFork',
        highlight: [
          { square: 'e3', role: 'attacker' },
          { square: 'c7', role: 'king' },
        ],
      },
      {
        id: 'knightFork.secondTargetDefended',
        fen: '8/p1k5/1n6/8/8/4N3/8/4K3 w - - 0 1',
        question: 'Is this a real fork?',
        why: 'The a7 pawn takes the knight straight back. It is an even trade.',
        looksLike: 'knightFork',
        highlight: [
          { square: 'e3', role: 'attacker' },
          { square: 'c7', role: 'king' },
          { square: 'b6', role: 'target' },
          { square: 'a7', role: 'guard' },
        ],
      },
    ],
  },

  {
    id: 'backRankMate',
    tier: 1,
    kidName: 'Shield Wall',
    creature: { id: 'shieldWall', name: 'Wally', glyph: '🛡️' },
    oneLiner: 'King hides behind his pawns',
    tell: 'Their king is on the last rank, boxed in by his own pawns.',
    response: 'Slide a piece along the back rank and check.',
    lichessThemes: ['backRankMate'],
    targetTtfmMs: 3000,
    prerequisites: ['checkIsNotMate'],
    counterExamples: [
      {
        id: 'backRankMate.holeInFront',
        fen: '7k/5p1p/8/8/8/8/8/R5K1 w - - 0 1',
        question: 'Is this a back rank mate?',
        why: 'g7 is empty. The king walks straight out through the hole.',
        looksLike: 'backRankMate',
        highlight: [
          { square: 'h8', role: 'king' },
          { square: 'g7', role: 'escape' },
        ],
      },
      {
        id: 'backRankMate.kingTakesRook',
        fen: '6k1/6pp/8/8/8/8/8/5RK1 w - - 0 1',
        question: 'Is this a back rank mate?',
        why: 'The rook lands right next to the king, so he eats it.',
        looksLike: 'backRankMate',
        highlight: [
          { square: 'f1', role: 'attacker' },
          { square: 'g8', role: 'king' },
        ],
      },
      {
        id: 'backRankMate.interposition',
        fen: '7k/4nppp/8/8/8/8/8/R5K1 w - - 0 1',
        question: 'Is this a back rank mate?',
        why: 'The knight steps in front of the king and blocks the check.',
        looksLike: 'backRankMate',
        highlight: [
          { square: 'h8', role: 'king' },
          { square: 'e7', role: 'guard' },
        ],
      },
    ],
  },
]

const byId = new Map<ChunkId, Chunk>(curriculum.map((chunk) => [chunk.id, chunk]))

export function chunkById(id: ChunkId): Chunk {
  const chunk = byId.get(id)
  if (chunk === undefined) throw new Error(`Unknown chunk "${id}"`)
  return chunk
}

export function chunksAtTier(tier: number): readonly Chunk[] {
  return curriculum.filter((chunk) => chunk.tier === tier)
}

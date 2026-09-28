import type { CuratedPuzzle } from './curatedPuzzleTypes'

// Hand-authored, because no mined set can supply these two chunks. A mating first
// move ends the game, so the puzzle is 1 ply, and Lichess publishes no 1-ply
// puzzles: scanning every legal move of 9,000 mateIn1-tagged positions turned up a
// mating move in 0.0% of them. REQUIREMENTS.md has the measurements.
//
// Each line was found by enumerating the legal moves of a bare position and keeping
// the ones that are checkmate, then re-checked by the motif predicates in
// scripts/set-selection.ts. `moves` is the entire solution.
//
// `rating` is a synthetic difficulty ladder rather than a Lichess rating, since there
// is no source; the parent dashboard is its only consumer (REQUIREMENTS.md §7). The
// first 12 of each are drilled, the last 3 are the transfer pair.
//
// The two sets are kept apart on purpose: queenMate owns every queen mate, so
// backRankMate is rook-only and the two share no position.

const queenMate: readonly CuratedPuzzle[] = [
  // drilled 01/15  Qc8#  (black king on a8)
  { id: 'curated-queenMate-01', fen: 'k7/p7/8/8/8/2Q5/8/7K w - - 0 1', moves: 'c3c8', plies: 1, rating: 800, popularity: 9000 },
  // drilled 02/15  Qh8#  (black king on a8)
  { id: 'curated-queenMate-02', fen: 'k7/pp6/8/8/8/8/8/Q6K w - - 0 1', moves: 'a1h8', plies: 1, rating: 825, popularity: 8990 },
  // drilled 03/15  Qa8#  (black king on h8)
  { id: 'curated-queenMate-03', fen: '7k/6pp/8/8/Q7/8/8/K7 w - - 0 1', moves: 'a4a8', plies: 1, rating: 850, popularity: 8980 },
  // drilled 04/15  Qe8#  (black king on a8)
  { id: 'curated-queenMate-04', fen: 'k7/pp6/8/8/Q7/8/8/7K w - - 0 1', moves: 'a4e8', plies: 1, rating: 875, popularity: 8970 },
  // drilled 05/15  Qb8#  (black king on h8)
  { id: 'curated-queenMate-05', fen: '7k/6pp/8/8/8/8/1Q6/K7 w - - 0 1', moves: 'b2b8', plies: 1, rating: 900, popularity: 8960 },
  // drilled 06/15  Qh8#  (black king on a8)
  { id: 'curated-queenMate-06', fen: 'k7/pp6/8/8/8/8/1Q6/7K w - - 0 1', moves: 'b2h8', plies: 1, rating: 925, popularity: 8950 },
  // drilled 07/15  Qc8#  (black king on h8)
  { id: 'curated-queenMate-07', fen: '7k/6pp/8/8/8/2Q5/8/K7 w - - 0 1', moves: 'c3c8', plies: 1, rating: 950, popularity: 8940 },
  // drilled 08/15  Qd8#  (black king on h8)
  { id: 'curated-queenMate-08', fen: '7k/6pp/8/8/8/8/8/K2Q4 w - - 0 1', moves: 'd1d8', plies: 1, rating: 975, popularity: 8930 },
  // drilled 09/15  Qd8#  (black king on a8)
  { id: 'curated-queenMate-09', fen: 'k7/pp6/8/8/8/8/8/3Q3K w - - 0 1', moves: 'd1d8', plies: 1, rating: 1000, popularity: 8920 },
  // drilled 10/15  Qb8#  (black king on h8)
  { id: 'curated-queenMate-10', fen: '7k/6pp/3Q4/8/8/8/8/K7 w - - 0 1', moves: 'd6b8', plies: 1, rating: 1025, popularity: 8910 },
  // drilled 11/15  Qa8#  (black king on c8)
  { id: 'curated-queenMate-11', fen: '2k5/1ppp4/8/8/8/8/8/Q6K w - - 0 1', moves: 'a1a8', plies: 1, rating: 1050, popularity: 8900 },
  // drilled 12/15  Qe8#  (black king on b8)
  { id: 'curated-queenMate-12', fen: '1k6/ppp5/8/8/Q7/8/8/7K w - - 0 1', moves: 'a4e8', plies: 1, rating: 1075, popularity: 8890 },
  // transfer 13/15  Qf8#  (black king on b8)
  { id: 'curated-queenMate-13', fen: '1k6/ppp5/3Q4/8/8/8/8/7K w - - 0 1', moves: 'd6f8', plies: 1, rating: 1100, popularity: 8880 },
  // transfer 14/15  Qf8#  (black king on c8)
  { id: 'curated-queenMate-14', fen: '2k5/1ppp4/3Q4/8/8/8/8/7K w - - 0 1', moves: 'd6f8', plies: 1, rating: 1125, popularity: 8870 },
  // transfer 15/15  Qg8#  (black king on b8)
  { id: 'curated-queenMate-15', fen: '1k6/ppp5/8/8/8/8/6Q1/7K w - - 0 1', moves: 'g2g8', plies: 1, rating: 1150, popularity: 8860 },
]

const backRankMate: readonly CuratedPuzzle[] = [
  // drilled 01/15  Rb8#  (black king on h8)
  { id: 'curated-backRankMate-01', fen: '7k/6pp/8/8/8/8/8/KR6 w - - 0 1', moves: 'b1b8', plies: 1, rating: 800, popularity: 9000 },
  // drilled 02/15  Rb1#  (white king on h1)
  { id: 'curated-backRankMate-02', fen: 'kr6/8/8/8/8/8/6PP/7K b - - 0 1', moves: 'b8b1', plies: 1, rating: 825, popularity: 8990 },
  // drilled 03/15  Rc8#  (black king on h8)
  { id: 'curated-backRankMate-03', fen: '7k/6pp/8/8/8/8/8/K1R5 w - - 0 1', moves: 'c1c8', plies: 1, rating: 850, popularity: 8980 },
  // drilled 04/15  Rc8#  (black king on a8)
  { id: 'curated-backRankMate-04', fen: 'k7/pp6/8/8/8/8/8/2R4K w - - 0 1', moves: 'c1c8', plies: 1, rating: 875, popularity: 8970 },
  // drilled 05/15  Rc1#  (white king on h1)
  { id: 'curated-backRankMate-05', fen: 'k1r5/8/8/8/8/8/6PP/7K b - - 0 1', moves: 'c8c1', plies: 1, rating: 900, popularity: 8960 },
  // drilled 06/15  Rc1#  (white king on a1)
  { id: 'curated-backRankMate-06', fen: 'k1r5/8/8/8/8/8/PP6/K7 b - - 0 1', moves: 'c8c1', plies: 1, rating: 925, popularity: 8950 },
  // drilled 07/15  Rd8#  (black king on h8)
  { id: 'curated-backRankMate-07', fen: '7k/6pp/8/8/8/8/8/K2R4 w - - 0 1', moves: 'd1d8', plies: 1, rating: 950, popularity: 8940 },
  // drilled 08/15  Rd8#  (black king on a8)
  { id: 'curated-backRankMate-08', fen: 'k7/pp6/8/8/8/8/8/3R3K w - - 0 1', moves: 'd1d8', plies: 1, rating: 975, popularity: 8930 },
  // drilled 09/15  Ra8#  (black king on c8)
  { id: 'curated-backRankMate-09', fen: '2k5/1ppp4/8/8/8/8/8/R6K w - - 0 1', moves: 'a1a8', plies: 1, rating: 1000, popularity: 8920 },
  // drilled 10/15  Ra8#  (black king on d8)
  { id: 'curated-backRankMate-10', fen: '3k4/2ppp3/8/8/8/8/8/R6K w - - 0 1', moves: 'a1a8', plies: 1, rating: 1025, popularity: 8910 },
  // drilled 11/15  Rb8#  (black king on d8)
  { id: 'curated-backRankMate-11', fen: '3k4/2ppp3/8/8/8/8/8/1R5K w - - 0 1', moves: 'b1b8', plies: 1, rating: 1050, popularity: 8900 },
  // drilled 12/15  Rb1#  (white king on d1)
  { id: 'curated-backRankMate-12', fen: 'kr6/8/8/8/8/8/2PPP3/3K4 b - - 0 1', moves: 'b8b1', plies: 1, rating: 1075, popularity: 8890 },
  // transfer 13/15  Rd1#  (white king on f1)
  { id: 'curated-backRankMate-13', fen: 'k2r4/8/8/8/8/8/4PPP1/5K2 b - - 0 1', moves: 'd8d1', plies: 1, rating: 1100, popularity: 8880 },
  // transfer 14/15  Rd1#  (white king on g1)
  { id: 'curated-backRankMate-14', fen: 'k2r4/8/8/8/8/8/5PPP/6K1 b - - 0 1', moves: 'd8d1', plies: 1, rating: 1125, popularity: 8870 },
  // transfer 15/15  Re8#  (black king on b8)
  { id: 'curated-backRankMate-15', fen: '1k6/ppp5/8/8/8/8/8/4R2K w - - 0 1', moves: 'e1e8', plies: 1, rating: 1150, popularity: 8860 },
]

export const CURATED_MATE_PUZZLES: Readonly<
  Record<'queenMate' | 'backRankMate', readonly CuratedPuzzle[]>
> = {
  queenMate,
  backRankMate,
}

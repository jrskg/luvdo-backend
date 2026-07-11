import { PlayerColor } from '../types/game.types';

export const BOARD_SIZE = 52; // main ring tile count
export const HOME_COLUMN_SIZE = 5; // tiles per player in home column
export const CENTER_POSITION = 72; // win position
export const BASE_POSITION = -1; // token not yet on board

// Entry positions on main ring when leaving base (requires dice=6)
export const PLAYER_START_POSITIONS: Record<PlayerColor, number> = {
  red: 0,
  green: 13,
  yellow: 26,
  blue: 39,
};

// Start index of each player's home column in the flat position space
export const HOME_COLUMN_START: Record<PlayerColor, number> = {
  red: 52,
  green: 57,
  yellow: 62,
  blue: 67,
};

// The main-ring position just before branching into the home column.
// When a token is at this position, its next move enters the home column.
// Each value is the cell directly adjacent (orthogonally) to that color's
// homeColStart, so the visual transition is a clean single-direction step.
export const HOME_ENTRY_POSITION: Record<PlayerColor, number> = {
  red: 50,    // row 7 col 0 → homeColStart row 7 col 1 (step right)
  green: 11,  // row 0 col 7 → homeColStart row 1 col 7 (step down)
  yellow: 24, // row 7 col 14 → homeColStart row 7 col 13 (step left)
  blue: 37,   // row 14 col 7 → homeColStart row 13 col 7 (step up)
};

// Positions where tokens cannot be captured
export const SAFE_POSITIONS: ReadonlyArray<number> = [0, 8, 13, 21, 26, 34, 39, 47];

// Star positions: safe AND grant an extra turn on landing
export const STAR_POSITIONS: ReadonlyArray<number> = [8, 21, 34, 47];

export const PLAYER_COLORS: PlayerColor[] = ['red', 'green', 'yellow', 'blue'];

export const COLOR_ORDER: PlayerColor[] = ['red', 'green', 'yellow', 'blue'];

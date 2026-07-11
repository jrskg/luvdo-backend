import {
  GameRules,
  MoveValidationResult,
  Player,
  Token,
  TokenState,
} from '../types/game.types';
import {
  BASE_POSITION,
  BOARD_SIZE,
  CENTER_POSITION,
  HOME_COLUMN_SIZE,
  HOME_COLUMN_START,
  HOME_ENTRY_POSITION,
  PLAYER_START_POSITIONS,
  SAFE_POSITIONS,
  STAR_POSITIONS,
} from '../constants/board.constants';

export function calculateNewPosition(
  token: Token,
  diceValue: number,
): {
  newPosition: number;
  newState: TokenState;
  newHomeColumnIndex: number;
} {
  // Token in base — needs 6 to enter board
  if (token.state === 'base') {
    if (diceValue === 6) {
      return {
        newPosition: PLAYER_START_POSITIONS[token.color],
        newState: 'active',
        newHomeColumnIndex: -1,
      };
    }
    return { newPosition: token.position, newState: 'base', newHomeColumnIndex: -1 };
  }

  if (token.state === 'finished') {
    return { newPosition: CENTER_POSITION, newState: 'finished', newHomeColumnIndex: -1 };
  }

  if (token.state === 'home_column') {
    const newHomeIdx = token.homeColumnIndex + diceValue;
    if (newHomeIdx === HOME_COLUMN_SIZE) {
      // Exactly reaches the center
      return { newPosition: CENTER_POSITION, newState: 'finished', newHomeColumnIndex: -1 };
    }
    if (newHomeIdx > HOME_COLUMN_SIZE) {
      // Overshoots — token stays put
      return {
        newPosition: token.position,
        newState: 'home_column',
        newHomeColumnIndex: token.homeColumnIndex,
      };
    }
    const newPos = HOME_COLUMN_START[token.color] + newHomeIdx;
    return { newPosition: newPos, newState: 'home_column', newHomeColumnIndex: newHomeIdx };
  }

  // Token is active on the main ring
  const homeEntry = HOME_ENTRY_POSITION[token.color];
  const currentPos = token.position;

  // Steps from current position to home entry (clockwise)
  const stepsToEntry =
    currentPos <= homeEntry ? homeEntry - currentPos : BOARD_SIZE - currentPos + homeEntry;

  if (diceValue > stepsToEntry) {
    // Token will enter home column
    const homeSteps = diceValue - stepsToEntry - 1;
    if (homeSteps >= HOME_COLUMN_SIZE) {
      // Overshoots home column — stays put
      return { newPosition: token.position, newState: 'active', newHomeColumnIndex: -1 };
    }
    const newPos = HOME_COLUMN_START[token.color] + homeSteps;
    if (homeSteps + 1 === HOME_COLUMN_SIZE) {
      return { newPosition: CENTER_POSITION, newState: 'finished', newHomeColumnIndex: -1 };
    }
    return { newPosition: newPos, newState: 'home_column', newHomeColumnIndex: homeSteps };
  }

  if (diceValue === stepsToEntry) {
    // Token lands exactly on home entry (just before the column)
    const newPos = (currentPos + diceValue) % BOARD_SIZE;
    return { newPosition: newPos, newState: 'active', newHomeColumnIndex: -1 };
  }

  // Normal movement on main ring
  const newPos = (currentPos + diceValue) % BOARD_SIZE;
  return { newPosition: newPos, newState: 'active', newHomeColumnIndex: -1 };
}

export function isSafePosition(position: number): boolean {
  return SAFE_POSITIONS.includes(position);
}

export function isStarPosition(position: number): boolean {
  return STAR_POSITIONS.includes(position);
}

export function getTokensAtPosition(tokens: Token[], position: number): Token[] {
  return tokens.filter((t) => t.position === position && t.state === 'active');
}

export function checkCapture(
  movingToken: Token,
  newPosition: number,
  allTokens: Token[],
): Token | null {
  if (isSafePosition(newPosition)) return null;

  const opponentTokens = allTokens.filter(
    (t) =>
      t.playerId !== movingToken.playerId &&
      t.position === newPosition &&
      t.state === 'active',
  );

  // If multiple opponent tokens occupy the same cell, they form a block — can't capture
  if (opponentTokens.length >= 2) return null;

  return opponentTokens[0] ?? null;
}

export function checkWin(tokens: Token[], playerId: string): boolean {
  const playerTokens = tokens.filter((t) => t.playerId === playerId);
  return playerTokens.length > 0 && playerTokens.every((t) => t.state === 'finished');
}

export function getValidMoves(
  tokens: Token[],
  playerId: string,
  diceValue: number,
  rules: GameRules,
): string[] {
  const playerTokens = tokens.filter((t) => t.playerId === playerId);

  const validTokenIds: string[] = [];

  for (const token of playerTokens) {
    if (token.state === 'finished') continue;

    if (token.state === 'base') {
      if (rules.requireSixToStart && diceValue !== 6) continue;
      if (!rules.requireSixToStart || diceValue === 6) {
        validTokenIds.push(token.tokenId);
      }
      continue;
    }

    const { newPosition, newState } = calculateNewPosition(token, diceValue);

    // Position didn't change means it's invalid (overshoot or no-op)
    if (newState !== 'finished' && newPosition === token.position) {
      continue;
    }

    validTokenIds.push(token.tokenId);
  }

  return validTokenIds;
}

export function getNextTurn(
  currentPlayerId: string,
  players: Player[],
  extraTurn: boolean,
): string {
  if (extraTurn) return currentPlayerId;

  const connectedPlayers = players.filter((p) => p.isConnected);
  const currentIndex = connectedPlayers.findIndex((p) => p.playerId === currentPlayerId);
  const nextIndex = (currentIndex + 1) % connectedPlayers.length;
  return connectedPlayers[nextIndex]?.playerId ?? currentPlayerId;
}

export function validateMove(
  token: Token,
  diceValue: number,
  allTokens: Token[],
  rules: GameRules,
): MoveValidationResult {
  if (token.state === 'finished') {
    return { valid: false, reason: 'Token is already finished' };
  }

  if (token.state === 'base' && diceValue !== 6 && rules.requireSixToStart) {
    return { valid: false, reason: 'Need a 6 to leave the base' };
  }

  const { newPosition, newState, newHomeColumnIndex } = calculateNewPosition(token, diceValue);

  if (newState !== 'finished' && newPosition === token.position) {
    return { valid: false, reason: 'Move would overshoot — no valid path' };
  }

  const capturedToken = newState === 'active' ? checkCapture(token, newPosition, allTokens) : null;
  const isWin = newState === 'finished' && checkWin(
    allTokens.map((t) =>
      t.tokenId === token.tokenId
        ? { ...t, state: newState as TokenState, position: newPosition }
        : t,
    ),
    token.playerId,
  );

  const extraTurn =
    (diceValue === 6 && rules.extraTurnOnSix) ||
    (capturedToken !== null && rules.extraTurnOnCapture) ||
    isStarPosition(newPosition);

  return {
    valid: true,
    newPosition,
    newState,
    newHomeColumnIndex,
    capturedTokenId: capturedToken?.tokenId ?? null,
    isWin,
    extraTurn,
  };
}

export function buildTokenId(color: string, index: number): string {
  return `${color}_${index}`;
}

export function getAbsolutePosition(position: number): number {
  if (position === BASE_POSITION) return BASE_POSITION;
  return position;
}

export function getBotMove(
  validTokenIds: string[],
  tokens: Token[],
  botPlayerId: string,
): string {
  if (validTokenIds.length === 1) return validTokenIds[0];

  const scored = validTokenIds.map((tokenId) => {
    const token = tokens.find((t) => t.tokenId === tokenId);
    if (!token) return { tokenId, score: 0 };

    let score = 0;

    // Highest priority: move home (win condition)
    if (token.state === 'home_column') score += 1000 + token.homeColumnIndex!;

    // High priority: capture (token on same cell as opponent not on safe)
    if (token.state === 'active' && !SAFE_POSITIONS.includes(token.position)) score += 500;

    // Medium: advance active token by raw position
    if (token.state === 'active') score += token.position;

    // Low: leave base
    if (token.state === 'base') score += 10;

    return { tokenId, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0].tokenId;
}

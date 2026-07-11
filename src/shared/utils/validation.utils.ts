import { GameState, MoveValidationResult } from '../types/game.types';
import { validateMove } from './board.utils';

export function validateDiceRoll(
  gameState: GameState,
  playerId: string,
  clientEventId: string,
): { valid: boolean; reason?: string } {
  if (gameState.phase !== 'playing') {
    return { valid: false, reason: 'Game is not in playing phase' };
  }

  if (gameState.currentTurn !== playerId) {
    return { valid: false, reason: 'Not your turn' };
  }

  if (gameState.diceValue !== null) {
    return { valid: false, reason: 'Dice already rolled this turn' };
  }

  return { valid: true };
}

export function validateTokenMove(
  gameState: GameState,
  playerId: string,
  tokenId: string,
  clientEventId: string,
): MoveValidationResult {
  if (gameState.phase !== 'playing') {
    return { valid: false, reason: 'Game is not in playing phase' };
  }

  if (gameState.currentTurn !== playerId) {
    return { valid: false, reason: 'Not your turn' };
  }

  if (gameState.diceValue === null) {
    return { valid: false, reason: 'Dice has not been rolled yet' };
  }

  const token = gameState.tokens.find((t) => t.tokenId === tokenId);
  if (!token) {
    return { valid: false, reason: 'Token not found' };
  }

  if (token.playerId !== playerId) {
    return { valid: false, reason: 'Token does not belong to you' };
  }

  if (!gameState.validMoves.includes(tokenId)) {
    return { valid: false, reason: 'Token cannot be moved with current dice value' };
  }

  return validateMove(token, gameState.diceValue, gameState.tokens, gameState.rules);
}

export function validatePlayerInRoom(gameState: GameState, playerId: string): boolean {
  return gameState.players.some((p) => p.playerId === playerId);
}

export function validateRoomAction(
  gameState: GameState,
  playerId: string,
  requireHost = false,
): { valid: boolean; reason?: string } {
  const player = gameState.players.find((p) => p.playerId === playerId);
  if (!player) {
    return { valid: false, reason: 'Player not in room' };
  }

  if (requireHost && !player.isHost) {
    return { valid: false, reason: 'Only the host can perform this action' };
  }

  return { valid: true };
}

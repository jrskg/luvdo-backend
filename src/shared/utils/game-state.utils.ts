import { v4 as uuidv4 } from 'uuid';
import {
  DEFAULT_GAME_CONFIG,
  DEFAULT_GAME_RULES,
  GameConfig,
  GameRules,
  GameState,
  MoveValidationResult,
  Player,
  PlayerColor,
  Token,
  TokenState,
} from '../types/game.types';
import {
  BASE_POSITION,
  CENTER_POSITION,
  COLOR_ORDER,
} from '../constants/board.constants';
import {
  buildTokenId,
  getNextTurn,
  getValidMoves,
} from './board.utils';

export function createInitialTokens(players: Player[], tokensPerPlayer: number): Token[] {
  const tokens: Token[] = [];
  for (const player of players) {
    for (let i = 0; i < tokensPerPlayer; i++) {
      tokens.push({
        tokenId: buildTokenId(player.color, i),
        playerId: player.playerId,
        color: player.color,
        state: 'base',
        position: BASE_POSITION,
        homeColumnIndex: -1,
      });
    }
  }
  return tokens;
}

export function initializeGameState(
  roomId: string,
  players: Player[],
  config: Partial<GameConfig> = {},
  rules: Partial<GameRules> = {},
): GameState {
  const mergedConfig: GameConfig = { ...DEFAULT_GAME_CONFIG, ...config };
  const mergedRules: GameRules = { ...DEFAULT_GAME_RULES, ...rules };

  const tokens = createInitialTokens(players, mergedConfig.tokensPerPlayer);
  const firstPlayer = players[0];

  return {
    roomId,
    players,
    teams: null,
    tokens,
    currentTurn: firstPlayer.playerId,
    diceValue: null,
    diceRolledBy: null,
    phase: 'playing',
    config: mergedConfig,
    rules: mergedRules,
    turnCount: 0,
    consecutiveSixes: 0,
    validMoves: [],
    lastEventId: null,
    sequenceNumber: 0,
    startedAt: new Date(),
  };
}

export function applyDiceRoll(
  state: GameState,
  diceValue: number,
  playerId: string,
  clientEventId: string,
): GameState {
  const consecutiveSixes =
    diceValue === 6 ? state.consecutiveSixes + 1 : 0;

  // Three consecutive sixes → skip turn
  if (consecutiveSixes >= state.rules.maxConsecutiveSixes) {
    const nextPlayerId = getNextTurn(playerId, state.players, false);
    return {
      ...state,
      diceValue,
      diceRolledBy: playerId,
      consecutiveSixes: 0,
      validMoves: [],
      currentTurn: nextPlayerId,
      lastEventId: clientEventId,
      sequenceNumber: state.sequenceNumber + 1,
    };
  }

  const validMoves = getValidMoves(state.tokens, playerId, diceValue, state.rules);

  // If no valid moves, advance turn automatically
  if (validMoves.length === 0) {
    const nextPlayerId = getNextTurn(playerId, state.players, false);
    return {
      ...state,
      diceValue,
      diceRolledBy: playerId,
      consecutiveSixes,
      validMoves: [],
      currentTurn: nextPlayerId,
      lastEventId: clientEventId,
      sequenceNumber: state.sequenceNumber + 1,
    };
  }

  return {
    ...state,
    diceValue,
    diceRolledBy: playerId,
    consecutiveSixes,
    validMoves,
    lastEventId: clientEventId,
    sequenceNumber: state.sequenceNumber + 1,
  };
}

export function applyTokenMove(
  state: GameState,
  tokenId: string,
  result: MoveValidationResult,
  clientEventId: string,
): GameState {
  if (!result.valid || result.newPosition === undefined) return state;

  const updatedTokens = state.tokens.map((t): Token => {
    if (t.tokenId === tokenId) {
      return {
        ...t,
        position: result.newPosition!,
        state: result.newState as TokenState ?? t.state,
        homeColumnIndex: result.newHomeColumnIndex ?? t.homeColumnIndex,
      };
    }
    // Reset captured token to base
    if (result.capturedTokenId && t.tokenId === result.capturedTokenId) {
      return { ...t, state: 'base', position: BASE_POSITION, homeColumnIndex: -1 };
    }
    return t;
  });

  if (result.isWin) {
    return {
      ...state,
      tokens: updatedTokens,
      phase: 'finished',
      diceValue: null,
      diceRolledBy: null,
      validMoves: [],
      lastEventId: clientEventId,
      sequenceNumber: state.sequenceNumber + 1,
    };
  }

  const nextPlayerId = getNextTurn(
    state.currentTurn,
    state.players,
    result.extraTurn ?? false,
  );

  const newConsecutiveSixes = result.extraTurn ? state.consecutiveSixes : 0;

  return {
    ...state,
    tokens: updatedTokens,
    currentTurn: nextPlayerId,
    diceValue: null,
    diceRolledBy: null,
    consecutiveSixes: newConsecutiveSixes,
    validMoves: [],
    turnCount: state.turnCount + 1,
    lastEventId: clientEventId,
    sequenceNumber: state.sequenceNumber + 1,
  };
}

export function assignColorsToPlayers(
  players: Array<{ playerId: string; userId: string; socketId: string; name: string; avatar: string; mood: any }>,
  existingColors: PlayerColor[] = [],
): Player[] {
  const availableColors = COLOR_ORDER.filter((c) => !existingColors.includes(c));
  return players.map((p, idx): Player => ({
    ...p,
    color: availableColors[idx],
    isReady: false,
    isConnected: true,
    isHost: idx === 0,
  }));
}

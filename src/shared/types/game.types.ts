export type PlayerColor = 'red' | 'green' | 'yellow' | 'blue';
export type TokenState = 'base' | 'active' | 'home_column' | 'finished';
export type GamePhase = 'waiting' | 'playing' | 'finished';
export type MoodType = 'Happy' | 'Angry' | 'Missing';
export type ReactionType = 'heart' | 'laugh' | 'angry' | 'kiss' | 'wow' | 'cry';
export type GiftType = 'rose' | 'chocolate' | 'ring' | 'teddy' | 'fireworks';
export type TriggerCondition = 'on_win' | 'on_capture' | 'on_six' | 'manual';

export interface Token {
  tokenId: string; // e.g. 'red_0', 'red_1'
  playerId: string;
  color: PlayerColor;
  state: TokenState;
  position: number; // 0-51 main ring, 52-71 home columns, 72 center
  homeColumnIndex: number; // -1 if not in home column, 0-4 if in home column
}

export interface Player {
  playerId: string;
  userId: string;
  socketId: string;
  color: PlayerColor;
  name: string;
  avatar: string;
  mood: MoodType;
  isReady: boolean;
  isConnected: boolean;
  isHost: boolean;
  isBot?: boolean;
}

export interface Team {
  teamId: string;
  name: string;
  playerIds: string[];
  colors: PlayerColor[];
}

export interface GameConfig {
  maxPlayers: 2 | 4;
  tokensPerPlayer: 2 | 4;
  allowTeams: boolean;
  turnTimeoutSeconds: number; // 0 = no timeout
  enableGifts: boolean;
  enableReactions: boolean;
  enableSecretMessages: boolean;
  enableVoiceChat: boolean;
}

export interface GameRules {
  requireSixToStart: boolean;
  extraTurnOnSix: boolean;
  extraTurnOnCapture: boolean;
  maxConsecutiveSixes: number; // default 3; hitting limit skips the turn
  teamMode: boolean;
}

export interface GameState {
  roomId: string;
  players: Player[];
  teams: Team[] | null;
  tokens: Token[];
  currentTurn: string; // playerId
  diceValue: number | null;
  diceRolledBy: string | null;
  phase: GamePhase;
  config: GameConfig;
  rules: GameRules;
  turnCount: number;
  consecutiveSixes: number;
  validMoves: string[]; // tokenIds that can be moved this turn
  lastEventId: string | null;
  sequenceNumber: number;
  startedAt: Date | null;
  isBotGame?: boolean;
}

export interface MoveValidationResult {
  valid: boolean;
  reason?: string;
  newPosition?: number;
  newState?: TokenState;
  newHomeColumnIndex?: number;
  capturedTokenId?: string | null;
  isWin?: boolean;
  extraTurn?: boolean;
}

export const DEFAULT_GAME_CONFIG: GameConfig = {
  maxPlayers: 2,
  tokensPerPlayer: 4,
  allowTeams: false,
  turnTimeoutSeconds: 0,
  enableGifts: true,
  enableReactions: true,
  enableSecretMessages: true,
  enableVoiceChat: true,
};

export const DEFAULT_GAME_RULES: GameRules = {
  requireSixToStart: true,
  extraTurnOnSix: true,
  extraTurnOnCapture: false,
  maxConsecutiveSixes: 3,
  teamMode: false,
};

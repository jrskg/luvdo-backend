import {
  GameConfig,
  GameRules,
  GameState,
  GiftType,
  MoodType,
  Player,
  ReactionType,
  Token,
  TriggerCondition,
} from './game.types';

export const SOCKET_EVENTS = {
  // Client → Server
  CREATE_ROOM: 'create_room',
  CREATE_BOT_GAME: 'create_bot_game',
  JOIN_ROOM: 'join_room',
  PLAYER_READY: 'player_ready',
  ROLL_DICE: 'roll_dice',
  MOVE_TOKEN: 'move_token',
  SEND_REACTION: 'send_reaction',
  SEND_GIFT: 'send_gift',
  SEND_SECRET_MESSAGE: 'send_secret_message',
  SET_GAME_RULE: 'set_game_rule',
  UPDATE_GAME_CONFIG: 'update_game_config',
  REQUEST_STATE_SYNC: 'request_state_sync',
  UPDATE_MOOD: 'update_mood',

  // WebRTC Signaling (Client → Server → Target)
  WEBRTC_OFFER: 'webrtc_offer',
  WEBRTC_ANSWER: 'webrtc_answer',
  WEBRTC_ICE_CANDIDATE: 'webrtc_ice_candidate',
  WEBRTC_LEAVE: 'webrtc_leave',

  // Server → Client
  ROOM_JOINED: 'room_joined',
  PLAYER_JOINED: 'player_joined',
  GAME_STARTED: 'game_started',
  DICE_ROLLED: 'dice_rolled',
  TOKEN_MOVED: 'token_moved',
  STATE_UPDATED: 'state_updated',
  STATE_SYNC: 'state_sync',
  PLAYER_TURN: 'player_turn',
  REACTION_RECEIVED: 'reaction_received',
  GIFT_RECEIVED: 'gift_received',
  SECRET_MESSAGE_TRIGGERED: 'secret_message_triggered',
  GAME_FINISHED: 'game_finished',
  GAME_ERROR: 'game_error',
  PLAYER_DISCONNECTED: 'player_disconnected',
  PLAYER_RECONNECTED: 'player_reconnected',
  MOOD_UPDATED: 'mood_updated',
} as const;

export type SocketEvent = (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];

// ─── Client → Server Payloads ───────────────────────────────────────────────

export interface CreateRoomPayload {
  roomName: string;
  config?: Partial<GameConfig>;
  rules?: Partial<GameRules>;
}

export interface JoinRoomPayload {
  roomName: string;
}

export interface RollDicePayload {
  clientEventId: string;
  sequenceNumber: number;
}

export interface MoveTokenPayload {
  tokenId: string;
  clientEventId: string;
  sequenceNumber: number;
}

export interface SendReactionPayload {
  reactionType: ReactionType;
  targetPlayerId?: string;
}

export interface SendGiftPayload {
  giftType: GiftType;
  targetPlayerId: string;
  message?: string;
}

export interface SendSecretMessagePayload {
  message: string;
  triggerCondition: TriggerCondition;
}

export interface SetGameRulePayload {
  rules: Partial<GameRules>;
}

export interface UpdateGameConfigPayload {
  config: Partial<GameConfig>;
}

export interface UpdateMoodPayload {
  mood: MoodType;
}

// ─── Server → Client Payloads ────────────────────────────────────────────────

export interface RoomJoinedPayload {
  roomId: string;
  roomName: string;
  players: Player[];
  config: GameConfig;
  rules: GameRules;
  isHost: boolean;
}

export interface GameStartedPayload {
  gameState: GameState;
}

export interface DiceRolledPayload {
  playerId: string;
  diceValue: number;
  validMoves: string[]; // tokenIds
  gameState: GameState;
}

export interface TokenMovedPayload {
  tokenId: string;
  fromPosition: number;
  toPosition: number;
  capturedTokenId: string | null;
  capturedToken: Token | null;
  isWin: boolean;
  extraTurn: boolean;
  gameState: GameState;
}

export interface PlayerTurnPayload {
  playerId: string;
  playerName: string;
  timeoutSeconds: number;
  sequenceNumber: number;
}

export interface ReactionReceivedPayload {
  reactionType: ReactionType;
  fromPlayerId: string;
  fromPlayerName: string;
}

export interface GiftReceivedPayload {
  giftType: GiftType;
  fromPlayerId: string;
  fromPlayerName: string;
  message?: string;
}

export interface SecretMessageTriggeredPayload {
  message: string;
  fromPlayerId: string;
  fromPlayerName: string;
  triggerCondition: TriggerCondition;
}

export interface GameFinishedPayload {
  winnerId: string;
  winnerName: string;
  gameState: GameState;
  durationSeconds: number;
}

export interface GameErrorPayload {
  code: string;
  message: string;
}

// ─── WebRTC Signaling Payloads ────────────────────────────────────────────────

export interface WebRTCOfferPayload {
  targetSocketId: string;
  offer: RTCSessionDescriptionInit;
}

export interface WebRTCAnswerPayload {
  targetSocketId: string;
  answer: RTCSessionDescriptionInit;
}

export interface WebRTCIceCandidatePayload {
  targetSocketId: string;
  candidate: RTCIceCandidateInit;
}

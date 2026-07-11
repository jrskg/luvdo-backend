import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import {
  DEFAULT_GAME_CONFIG,
  DEFAULT_GAME_RULES,
  GameConfig,
  GameRules,
  GameState,
  MoodType,
  Player,
  PlayerColor,
  Token,
} from '../shared/types/game.types';
import { COLOR_ORDER } from '../shared/constants/board.constants';
import {
  applyDiceRoll,
  applyTokenMove,
  initializeGameState,
} from '../shared/utils/game-state.utils';
import {
  getValidMoves,
} from '../shared/utils/board.utils';
import {
  validateDiceRoll,
  validateTokenMove,
  validateRoomAction,
} from '../shared/utils/validation.utils';
import { GameRoom, GameRoomDocument } from './schemas/game-room.schema';
import { UsersService } from '../users/users.service';
import { HistoryService } from '../history/history.service';

interface CachedEventResult {
  result: unknown;
  expiresAt: number;
}

@Injectable()
export class GameService {
  // Active game states in memory for O(1) access per event
  private activeGames = new Map<string, GameState>();
  // Idempotency cache: clientEventId → cached result (TTL 30s)
  private processedEvents = new Map<string, CachedEventResult>();

  constructor(
    @InjectModel(GameRoom.name) private roomModel: Model<GameRoomDocument>,
    private readonly usersService: UsersService,
    private readonly historyService: HistoryService,
  ) {
    // Cleanup expired idempotency entries every 60s
    setInterval(() => this.cleanupExpiredEvents(), 60_000);
  }

  // ─── Room Management ─────────────────────────────────────────────────────────

  async createBotGame(
    userId: string,
    socketId: string,
  ): Promise<{ gameState: GameState; roomId: string; hostPlayer: Player; botPlayer: Player }> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const roomName = `bot_${uuidv4().slice(0, 8)}`;
    const config = { ...DEFAULT_GAME_CONFIG };
    const rules = { ...DEFAULT_GAME_RULES };

    const hostPlayer: Player = {
      playerId: uuidv4(),
      userId,
      socketId,
      color: COLOR_ORDER[0],
      name: user.name,
      avatar: user.avatar,
      mood: user.mood,
      isReady: true,
      isConnected: true,
      isHost: true,
    };

    const botPlayer: Player = {
      playerId: uuidv4(),
      userId: 'bot',
      socketId: 'bot',
      color: COLOR_ORDER[1],
      name: 'Ludo Bot',
      avatar: '🤖',
      mood: 'Happy',
      isReady: true,
      isConnected: true,
      isHost: false,
      isBot: true,
    };

    const room = await new this.roomModel({
      roomName,
      players: [hostPlayer, botPlayer],
      config,
      rules,
      status: 'playing',
      startedAt: new Date(),
    }).save();

    const roomId = String(room._id);
    const gameState = initializeGameState(roomId, [hostPlayer, botPlayer], config, rules);
    gameState.isBotGame = true;
    this.activeGames.set(roomId, gameState);

    room.gameState = gameState as unknown as Record<string, unknown>;
    await room.save();

    return { gameState, roomId, hostPlayer, botPlayer };
  }

  async createRoom(
    userId: string,
    socketId: string,
    roomName: string,
    config?: Partial<GameConfig>,
    rules?: Partial<GameRules>,
  ): Promise<{ room: GameRoomDocument; hostPlayer: Player }> {
    const existing = await this.roomModel.findOne({ roomName, status: { $ne: 'finished' } });
    if (existing) throw new BadRequestException('Room name already taken');

    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const mergedConfig = { ...DEFAULT_GAME_CONFIG, ...config };
    const mergedRules = { ...DEFAULT_GAME_RULES, ...rules };

    const hostPlayer: Player = {
      playerId: uuidv4(),
      userId,
      socketId,
      color: COLOR_ORDER[0],
      name: user.name,
      avatar: user.avatar,
      mood: user.mood,
      isReady: false,
      isConnected: true,
      isHost: true,
    };

    const room = await new this.roomModel({
      roomName,
      players: [hostPlayer],
      config: mergedConfig,
      rules: mergedRules,
      status: 'waiting',
    }).save();

    return { room, hostPlayer };
  }

  async joinRoom(
    userId: string,
    socketId: string,
    roomName: string,
  ): Promise<{ room: GameRoomDocument; player: Player; gameState: GameState | null }> {
    const room = await this.roomModel.findOne({ roomName, status: { $ne: 'finished' } });
    if (!room) throw new NotFoundException('Room not found');

    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    // Check if user is rejoining
    const existingPlayerIdx = room.players.findIndex((p) => p.userId === userId);
    let player: Player;

    if (existingPlayerIdx >= 0) {
      // Rejoin — update socket id and connection status
      room.players[existingPlayerIdx] = {
        ...room.players[existingPlayerIdx],
        socketId,
        isConnected: true,
      };
      player = room.players[existingPlayerIdx];
    } else {
      if (room.players.length >= room.config.maxPlayers) {
        throw new BadRequestException('Room is full');
      }

      const usedColors = room.players.map((p) => p.color) as PlayerColor[];
      const nextColor = COLOR_ORDER.find((c) => !usedColors.includes(c))!;

      player = {
        playerId: uuidv4(),
        userId,
        socketId,
        color: nextColor,
        name: user.name,
        avatar: user.avatar,
        mood: user.mood,
        isReady: false,
        isConnected: true,
        isHost: false,
      };
      room.players.push(player);
    }

    room.markModified('players');
    await room.save();

    // Return existing in-memory game state if game is live
    const gameState = this.activeGames.get(String(room._id)) ?? null;

    // Also update socketId in active game state
    if (gameState) {
      const pIdx = gameState.players.findIndex((p) => p.userId === userId);
      if (pIdx >= 0) {
        gameState.players[pIdx].socketId = socketId;
        gameState.players[pIdx].isConnected = true;
      }
    }

    return { room, player, gameState };
  }

  async setPlayerReady(
    roomId: string,
    playerId: string,
  ): Promise<{ allReady: boolean; room: GameRoomDocument }> {
    const room = await this.roomModel.findById(roomId);
    if (!room) throw new NotFoundException('Room not found');

    const playerIdx = room.players.findIndex((p) => p.playerId === playerId);
    if (playerIdx < 0) throw new BadRequestException('Player not in room');

    room.players[playerIdx].isReady = true;
    room.markModified('players');
    await room.save();

    const allReady =
      room.players.length >= 2 &&
      room.players.every((p) => p.isReady);

    return { allReady, room };
  }

  async startGame(roomId: string): Promise<GameState> {
    const room = await this.roomModel.findById(roomId);
    if (!room) throw new NotFoundException('Room not found');

    const gameState = initializeGameState(
      roomId,
      room.players,
      room.config,
      room.rules,
    );

    this.activeGames.set(roomId, gameState);

    room.status = 'playing';
    room.startedAt = new Date();
    room.gameState = gameState as unknown as Record<string, unknown>;
    await room.save();

    return gameState;
  }

  // ─── Game Actions ─────────────────────────────────────────────────────────────

  processRollDice(
    roomId: string,
    playerId: string,
    clientEventId: string,
  ): { diceValue: number; validMoves: string[]; gameState: GameState } {
    const cached = this.getFromCache(clientEventId);
    if (cached) return cached as ReturnType<typeof this.processRollDice>;

    const gameState = this.getActiveGame(roomId);
    const validation = validateDiceRoll(gameState, playerId, clientEventId);
    if (!validation.valid) throw new BadRequestException(validation.reason);

    const diceValue = this.rollDice();
    const newState = applyDiceRoll(gameState, diceValue, playerId, clientEventId);
    this.activeGames.set(roomId, newState);

    const result = { diceValue, validMoves: newState.validMoves, gameState: newState };
    this.cacheEvent(clientEventId, result);
    return result;
  }

  processMoveToken(
    roomId: string,
    playerId: string,
    tokenId: string,
    clientEventId: string,
  ): {
    tokenId: string;
    fromPosition: number;
    toPosition: number;
    capturedTokenId: string | null;
    capturedToken: Token | null;
    isWin: boolean;
    extraTurn: boolean;
    gameState: GameState;
  } {
    const cached = this.getFromCache(clientEventId);
    if (cached) return cached as ReturnType<typeof this.processMoveToken>;

    const gameState = this.getActiveGame(roomId);
    const validation = validateTokenMove(gameState, playerId, tokenId, clientEventId);
    if (!validation.valid) throw new BadRequestException(validation.reason);

    const token = gameState.tokens.find((t) => t.tokenId === tokenId)!;
    const fromPosition = token.position;

    const newState = applyTokenMove(gameState, tokenId, validation, clientEventId);
    this.activeGames.set(roomId, newState);

    const capturedToken = validation.capturedTokenId
      ? gameState.tokens.find((t) => t.tokenId === validation.capturedTokenId) ?? null
      : null;

    const result = {
      tokenId,
      fromPosition,
      toPosition: validation.newPosition ?? fromPosition,
      capturedTokenId: validation.capturedTokenId ?? null,
      capturedToken,
      isWin: validation.isWin ?? false,
      extraTurn: validation.extraTurn ?? false,
      gameState: newState,
    };

    this.cacheEvent(clientEventId, result);

    // Async persist (non-blocking)
    void this.persistGameState(roomId, newState);

    if (validation.isWin) {
      void this.finishGame(roomId, playerId, newState);
    }

    return result;
  }

  // ─── State Helpers ────────────────────────────────────────────────────────────

  getActiveGame(roomId: string): GameState {
    const state = this.activeGames.get(roomId);
    if (!state) throw new NotFoundException('No active game for this room');
    return state;
  }

  getActiveGameOrNull(roomId: string): GameState | null {
    return this.activeGames.get(roomId) ?? null;
  }

  async getRoomByName(roomName: string): Promise<GameRoomDocument | null> {
    return this.roomModel.findOne({ roomName, status: { $ne: 'finished' } });
  }

  async getRoomById(roomId: string): Promise<GameRoomDocument | null> {
    return this.roomModel.findById(roomId);
  }

  markPlayerDisconnected(roomId: string, socketId: string): void {
    const state = this.activeGames.get(roomId);
    if (!state) return;
    const player = state.players.find((p) => p.socketId === socketId);
    if (player) player.isConnected = false;
  }

  markPlayerReconnected(roomId: string, userId: string, socketId: string): void {
    const state = this.activeGames.get(roomId);
    if (!state) return;
    const player = state.players.find((p) => p.userId === userId);
    if (player) {
      player.isConnected = true;
      player.socketId = socketId;
    }
  }

  getPlayerBySocketId(roomId: string, socketId: string): Player | null {
    const state = this.activeGames.get(roomId);
    return state?.players.find((p) => p.socketId === socketId) ?? null;
  }

  async findActiveRoomBySocketId(socketId: string): Promise<{ roomId: string; player: Player } | null> {
    for (const [roomId, state] of this.activeGames) {
      const player = state.players.find((p) => p.socketId === socketId);
      if (player) return { roomId, player };
    }
    // Fall back to DB for rooms in 'playing' state
    const room = await this.roomModel.findOne({
      'players.socketId': socketId,
      status: 'playing',
    });
    if (room) {
      const player = room.players.find((p) => p.socketId === socketId);
      if (player) return { roomId: String(room._id), player };
    }
    return null;
  }

  updatePlayerMood(roomId: string, playerId: string, mood: MoodType): GameState | null {
    const state = this.activeGames.get(roomId);
    if (!state) return null;
    const player = state.players.find((p) => p.playerId === playerId);
    if (player) player.mood = mood;
    return state;
  }

  // ─── Persistence ─────────────────────────────────────────────────────────────

  private async persistGameState(roomId: string, state: GameState): Promise<void> {
    try {
      await this.roomModel.findByIdAndUpdate(roomId, {
        gameState: state as unknown as Record<string, unknown>,
      });
    } catch (_e) {
      // Non-critical — game continues in memory
    }
  }

  private async finishGame(roomId: string, winnerId: string, state: GameState): Promise<void> {
    try {
      const winner = state.players.find((p) => p.playerId === winnerId)!;
      const durationSeconds = state.startedAt
        ? Math.floor((Date.now() - new Date(state.startedAt).getTime()) / 1000)
        : 0;

      await this.roomModel.findByIdAndUpdate(roomId, {
        status: 'finished',
        finishedAt: new Date(),
        gameState: state as unknown as Record<string, unknown>,
      });

      await this.historyService.saveGameHistory({
        roomId,
        roomName: (await this.roomModel.findById(roomId).exec())?.roomName ?? roomId,
        winnerId,
        winnerName: winner.name,
        players: state.players.map((p) => ({ userId: p.userId, name: p.name, color: p.color })),
        moves: [],
        events: [],
        durationSeconds,
      });

      // Update win/loss stats (skip bot players)
      for (const player of state.players) {
        if (player.isBot) continue;
        await this.usersService.incrementStats(player.userId, player.playerId === winnerId);
      }

      this.activeGames.delete(roomId);
    } catch (_e) {
      // Log in production
    }
  }

  // ─── Idempotency Cache ────────────────────────────────────────────────────────

  private getFromCache(clientEventId: string): unknown | null {
    const entry = this.processedEvents.get(clientEventId);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.processedEvents.delete(clientEventId);
      return null;
    }
    return entry.result;
  }

  private cacheEvent(clientEventId: string, result: unknown): void {
    this.processedEvents.set(clientEventId, { result, expiresAt: Date.now() + 30_000 });
  }

  private cleanupExpiredEvents(): void {
    const now = Date.now();
    for (const [key, entry] of this.processedEvents) {
      if (now > entry.expiresAt) this.processedEvents.delete(key);
    }
  }

  // ─── Utilities ────────────────────────────────────────────────────────────────

  private rollDice(): number {
    return Math.floor(Math.random() * 6) + 1;
  }
}

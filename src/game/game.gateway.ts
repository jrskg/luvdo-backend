import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { WsJwtGuard } from '../auth/ws-jwt.guard';
import { GameService } from './game.service';
import { SOCKET_EVENTS } from '../shared/types/socket-events.types';
import { getBotMove } from '../shared/utils/board.utils';
import {
  CreateRoomPayload,
  JoinRoomPayload,
  MoveTokenPayload,
  RollDicePayload,
  SendGiftPayload,
  SendReactionPayload,
  SendSecretMessagePayload,
  SetGameRulePayload,
  UpdateGameConfigPayload,
  UpdateMoodPayload,
} from '../shared/types/socket-events.types';

@WebSocketGateway({
  cors: { origin: '*', credentials: false },
  namespace: '/game',
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // Turn timers: roomId -> NodeJS.Timeout
  private turnTimers = new Map<string, NodeJS.Timeout>();

  constructor(private readonly gameService: GameService) {}

  // ─── Connection Lifecycle ─────────────────────────────────────────────────────

  async handleConnection(client: Socket) {
    // Auth is handled per-message via WsJwtGuard.
    // On connect we just note the socket; auth happens on first guarded message.
  }

  async handleDisconnect(client: Socket) {
    const entry = await this.gameService.findActiveRoomBySocketId(client.id);
    if (!entry) return;

    const { roomId, player } = entry;
    this.gameService.markPlayerDisconnected(roomId, client.id);

    this.server.to(roomId).emit(SOCKET_EVENTS.PLAYER_DISCONNECTED, {
      playerId: player.playerId,
      playerName: player.name,
    });
  }

  // ─── Room Events ─────────────────────────────────────────────────────────────

  @UseGuards(WsJwtGuard)
  @SubscribeMessage(SOCKET_EVENTS.CREATE_ROOM)
  async handleCreateRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: CreateRoomPayload,
  ) {
    try {
      const user = client.data.user;
      const { room, hostPlayer } = await this.gameService.createRoom(
        String(user._id),
        client.id,
        payload.roomName,
        payload.config,
        payload.rules,
      );

      client.join(String(room._id));
      client.data.roomId = String(room._id);
      client.data.playerId = hostPlayer.playerId;

      client.emit(SOCKET_EVENTS.ROOM_JOINED, {
        roomId: String(room._id),
        roomName: room.roomName,
        players: room.players,
        config: room.config,
        rules: room.rules,
        isHost: true,
      });
    } catch (err: any) {
      client.emit(SOCKET_EVENTS.GAME_ERROR, { code: 'CREATE_ROOM_FAILED', message: err.message });
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage(SOCKET_EVENTS.CREATE_BOT_GAME)
  async handleCreateBotGame(@ConnectedSocket() client: Socket) {
    try {
      const user = client.data.user;
      const { gameState, roomId, hostPlayer } = await this.gameService.createBotGame(
        String(user._id),
        client.id,
      );

      client.join(roomId);
      client.data.roomId = roomId;
      client.data.playerId = hostPlayer.playerId;

      client.emit(SOCKET_EVENTS.ROOM_JOINED, {
        roomId,
        roomName: 'vs Ludo Bot',
        players: gameState.players,
        config: gameState.config,
        rules: gameState.rules,
        isHost: true,
        isBotGame: true,
      });

      client.emit(SOCKET_EVENTS.GAME_STARTED, { gameState });
      this.emitPlayerTurn(roomId, gameState);
    } catch (err: any) {
      client.emit(SOCKET_EVENTS.GAME_ERROR, { code: 'BOT_GAME_FAILED', message: err.message });
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage(SOCKET_EVENTS.JOIN_ROOM)
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinRoomPayload,
  ) {
    try {
      const user = client.data.user;
      const { room, player, gameState } = await this.gameService.joinRoom(
        String(user._id),
        client.id,
        payload.roomName,
      );

      const roomId = String(room._id);
      client.join(roomId);
      client.data.roomId = roomId;
      client.data.playerId = player.playerId;

      client.emit(SOCKET_EVENTS.ROOM_JOINED, {
        roomId,
        roomName: room.roomName,
        players: room.players,
        config: room.config,
        rules: room.rules,
        isHost: player.isHost,
      });

      // Notify others
      client.to(roomId).emit(SOCKET_EVENTS.PLAYER_JOINED, {
        player,
        totalPlayers: room.players.length,
      });

      // If game is live, send full state sync for reconnect
      if (gameState) {
        client.emit(SOCKET_EVENTS.STATE_SYNC, { gameState });
      }
    } catch (err: any) {
      client.emit(SOCKET_EVENTS.GAME_ERROR, { code: 'JOIN_ROOM_FAILED', message: err.message });
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage(SOCKET_EVENTS.PLAYER_READY)
  async handlePlayerReady(@ConnectedSocket() client: Socket) {
    try {
      const roomId: string = client.data.roomId;
      const playerId: string = client.data.playerId;

      const { allReady, room } = await this.gameService.setPlayerReady(roomId, playerId);

      this.server.to(roomId).emit(SOCKET_EVENTS.STATE_UPDATED, {
        players: room.players,
      });

      if (allReady) {
        const gameState = await this.gameService.startGame(roomId);
        this.server.to(roomId).emit(SOCKET_EVENTS.GAME_STARTED, { gameState });
        this.emitPlayerTurn(roomId, gameState);
      }
    } catch (err: any) {
      client.emit(SOCKET_EVENTS.GAME_ERROR, { code: 'READY_FAILED', message: err.message });
    }
  }

  // ─── Game Action Events ───────────────────────────────────────────────────────

  @UseGuards(WsJwtGuard)
  @SubscribeMessage(SOCKET_EVENTS.ROLL_DICE)
  handleRollDice(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: RollDicePayload,
  ) {
    try {
      const roomId: string = client.data.roomId;
      const playerId: string = client.data.playerId;

      this.clearTurnTimer(roomId);

      const { diceValue, validMoves, gameState } = this.gameService.processRollDice(
        roomId,
        playerId,
        payload.clientEventId,
      );

      this.server.to(roomId).emit(SOCKET_EVENTS.DICE_ROLLED, {
        playerId,
        diceValue,
        validMoves,
        gameState,
      });

      // Auto-advance if no valid moves
      if (validMoves.length === 0) {
        this.emitPlayerTurn(roomId, gameState);
      }
    } catch (err: any) {
      client.emit(SOCKET_EVENTS.GAME_ERROR, { code: 'ROLL_FAILED', message: err.message });
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage(SOCKET_EVENTS.MOVE_TOKEN)
  handleMoveToken(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: MoveTokenPayload,
  ) {
    try {
      const roomId: string = client.data.roomId;
      const playerId: string = client.data.playerId;

      const result = this.gameService.processMoveToken(
        roomId,
        playerId,
        payload.tokenId,
        payload.clientEventId,
      );

      this.server.to(roomId).emit(SOCKET_EVENTS.TOKEN_MOVED, result);

      if (result.isWin) {
        this.clearTurnTimer(roomId);
        const winner = result.gameState.players.find((p) => p.playerId === playerId)!;
        const durationSeconds = result.gameState.startedAt
          ? Math.floor((Date.now() - new Date(result.gameState.startedAt).getTime()) / 1000)
          : 0;
        this.server.to(roomId).emit(SOCKET_EVENTS.GAME_FINISHED, {
          winnerId: playerId,
          winnerName: winner.name,
          gameState: result.gameState,
          durationSeconds,
        });
      } else {
        this.emitPlayerTurn(roomId, result.gameState);
      }
    } catch (err: any) {
      client.emit(SOCKET_EVENTS.GAME_ERROR, { code: 'MOVE_FAILED', message: err.message });
    }
  }

  // ─── Couple-Centric Events ────────────────────────────────────────────────────

  @UseGuards(WsJwtGuard)
  @SubscribeMessage(SOCKET_EVENTS.SEND_REACTION)
  handleReaction(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SendReactionPayload,
  ) {
    const roomId: string = client.data.roomId;
    const gameState = this.gameService.getActiveGameOrNull(roomId);
    if (!gameState) return;

    const sender = gameState.players.find((p) => p.playerId === client.data.playerId);
    if (!sender) return;

    this.server.to(roomId).emit(SOCKET_EVENTS.REACTION_RECEIVED, {
      reactionType: payload.reactionType,
      fromPlayerId: sender.playerId,
      fromPlayerName: sender.name,
    });
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage(SOCKET_EVENTS.SEND_GIFT)
  handleGift(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SendGiftPayload,
  ) {
    const roomId: string = client.data.roomId;
    const gameState = this.gameService.getActiveGameOrNull(roomId);
    if (!gameState) return;

    const sender = gameState.players.find((p) => p.playerId === client.data.playerId);
    if (!sender) return;

    this.server.to(roomId).emit(SOCKET_EVENTS.GIFT_RECEIVED, {
      giftType: payload.giftType,
      fromPlayerId: sender.playerId,
      fromPlayerName: sender.name,
      message: payload.message,
    });
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage(SOCKET_EVENTS.SEND_SECRET_MESSAGE)
  handleSecretMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SendSecretMessagePayload,
  ) {
    const roomId: string = client.data.roomId;
    const gameState = this.gameService.getActiveGameOrNull(roomId);
    if (!gameState) return;

    const sender = gameState.players.find((p) => p.playerId === client.data.playerId);
    if (!sender) return;

    if (payload.triggerCondition === 'manual') {
      this.server.to(roomId).emit(SOCKET_EVENTS.SECRET_MESSAGE_TRIGGERED, {
        message: payload.message,
        fromPlayerId: sender.playerId,
        fromPlayerName: sender.name,
        triggerCondition: payload.triggerCondition,
      });
    } else {
      // Store on the game state player object for deferred delivery
      const player = gameState.players.find((p) => p.playerId === client.data.playerId);
      if (player) {
        (player as any).pendingSecretMessage = {
          message: payload.message,
          triggerCondition: payload.triggerCondition,
        };
      }
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage(SOCKET_EVENTS.SET_GAME_RULE)
  async handleSetRule(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SetGameRulePayload,
  ) {
    const roomId: string = client.data.roomId;
    const room = await this.gameService.getRoomById(roomId);
    if (!room || room.status !== 'waiting') return;

    const player = room.players.find((p) => p.playerId === client.data.playerId);
    if (!player?.isHost) return;

    Object.assign(room.rules, payload.rules);
    room.markModified('rules');
    await room.save();

    this.server.to(roomId).emit(SOCKET_EVENTS.STATE_UPDATED, {
      rules: room.rules,
    });
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage(SOCKET_EVENTS.UPDATE_GAME_CONFIG)
  async handleUpdateConfig(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: UpdateGameConfigPayload,
  ) {
    const roomId: string = client.data.roomId;
    const room = await this.gameService.getRoomById(roomId);
    if (!room || room.status !== 'waiting') return;

    const player = room.players.find((p) => p.playerId === client.data.playerId);
    if (!player?.isHost) return;

    Object.assign(room.config, payload.config);
    room.markModified('config');
    await room.save();

    this.server.to(roomId).emit(SOCKET_EVENTS.STATE_UPDATED, {
      config: room.config,
    });
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage(SOCKET_EVENTS.REQUEST_STATE_SYNC)
  handleStateSync(@ConnectedSocket() client: Socket) {
    const roomId: string = client.data.roomId;
    const gameState = this.gameService.getActiveGameOrNull(roomId);
    if (gameState) {
      client.emit(SOCKET_EVENTS.STATE_SYNC, { gameState });
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage(SOCKET_EVENTS.UPDATE_MOOD)
  handleUpdateMood(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: UpdateMoodPayload,
  ) {
    const roomId: string = client.data.roomId;
    const playerId: string = client.data.playerId;
    const gameState = this.gameService.updatePlayerMood(roomId, playerId, payload.mood);
    if (gameState) {
      this.server.to(roomId).emit(SOCKET_EVENTS.MOOD_UPDATED, {
        playerId,
        mood: payload.mood,
      });
    }
  }

  // ─── Turn Timer ───────────────────────────────────────────────────────────────

  private emitPlayerTurn(roomId: string, gameState: ReturnType<GameService['getActiveGameOrNull']> extends null ? never : NonNullable<ReturnType<GameService['getActiveGameOrNull']>>): void {
    if (!gameState || gameState.phase !== 'playing') return;

    const currentPlayer = gameState.players.find(
      (p) => p.playerId === gameState.currentTurn,
    );
    if (!currentPlayer) return;

    const timeoutSeconds = gameState.config.turnTimeoutSeconds;

    this.server.to(roomId).emit(SOCKET_EVENTS.PLAYER_TURN, {
      playerId: currentPlayer.playerId,
      playerName: currentPlayer.name,
      timeoutSeconds,
      sequenceNumber: gameState.sequenceNumber,
    });

    if (currentPlayer.isBot) {
      this.clearTurnTimer(roomId);
      const delay = 1200 + Math.random() * 800;
      const timer = setTimeout(() => this.autoRollForPlayer(roomId, currentPlayer.playerId), delay);
      this.turnTimers.set(roomId, timer);
      return;
    }

    if (timeoutSeconds > 0) {
      this.clearTurnTimer(roomId);
      const timer = setTimeout(() => {
        this.autoRollForPlayer(roomId, currentPlayer.playerId);
      }, timeoutSeconds * 1000);
      this.turnTimers.set(roomId, timer);
    }
  }

  private autoRollForPlayer(roomId: string, playerId: string): void {
    try {
      const clientEventId = `auto_${Date.now()}_${playerId}`;
      const { diceValue, validMoves, gameState } = this.gameService.processRollDice(
        roomId,
        playerId,
        clientEventId,
      );

      this.server.to(roomId).emit(SOCKET_EVENTS.DICE_ROLLED, {
        playerId,
        diceValue,
        validMoves,
        gameState,
      });

      // Delay move so the frontend can display the dice roll animation
      const moveDelay = 1200 + Math.random() * 400;
      setTimeout(() => {
        try {
          if (validMoves.length > 0) {
            const autoMoveEventId = `auto_move_${Date.now()}_${playerId}`;
            const chosenToken = getBotMove(validMoves, gameState.tokens, playerId);
            const moveResult = this.gameService.processMoveToken(
              roomId,
              playerId,
              chosenToken,
              autoMoveEventId,
            );
            this.server.to(roomId).emit(SOCKET_EVENTS.TOKEN_MOVED, moveResult);
            if (!moveResult.isWin) {
              this.emitPlayerTurn(roomId, moveResult.gameState);
            }
          } else {
            this.emitPlayerTurn(roomId, gameState);
          }
        } catch {
          // Game may have ended or state changed
        }
      }, moveDelay);
    } catch {
      // Game may have ended or state changed
    }
  }

  private clearTurnTimer(roomId: string): void {
    const timer = this.turnTimers.get(roomId);
    if (timer) {
      clearTimeout(timer);
      this.turnTimers.delete(roomId);
    }
  }
}

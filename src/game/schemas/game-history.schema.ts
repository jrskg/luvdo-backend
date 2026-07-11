import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { Player } from '../../shared/types/game.types';

export type GameHistoryDocument = GameHistory & Document;

export interface MoveRecord {
  playerId: string;
  tokenId: string;
  fromPosition: number;
  toPosition: number;
  diceValue: number;
  timestamp: Date;
}

export interface EventRecord {
  type: string;
  fromPlayerId: string;
  toPlayerId?: string;
  payload: Record<string, unknown>;
  timestamp: Date;
}

@Schema({ timestamps: true })
export class GameHistory {
  @Prop({ required: true })
  roomId: string;

  @Prop({ required: true })
  roomName: string;

  @Prop({ required: true })
  winnerId: string;

  @Prop({ required: true })
  winnerName: string;

  @Prop({ type: [Object], default: [] })
  players: Partial<Player>[];

  @Prop({ type: [Object], default: [] })
  moves: MoveRecord[];

  @Prop({ type: [Object], default: [] })
  events: EventRecord[];

  @Prop({ default: 0 })
  durationSeconds: number;
}

export const GameHistorySchema = SchemaFactory.createForClass(GameHistory);
GameHistorySchema.index({ roomId: 1 });
GameHistorySchema.index({ 'players.userId': 1 });

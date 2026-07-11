import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { GameConfig, GamePhase, GameRules, Player, Team } from '../../shared/types/game.types';

export type GameRoomDocument = GameRoom & Document;

@Schema({ timestamps: true })
export class GameRoom {
  @Prop({ required: true, unique: true, trim: true })
  roomName: string;

  @Prop({ type: [Object], default: [] })
  players: Player[];

  @Prop({ type: [Object], default: null })
  teams: Team[] | null;

  @Prop({ type: Object, default: {} })
  gameState: Record<string, unknown>;

  @Prop({ type: Object })
  config: GameConfig;

  @Prop({ type: Object })
  rules: GameRules;

  @Prop({ enum: ['waiting', 'playing', 'finished'], default: 'waiting' })
  status: GamePhase;

  @Prop()
  startedAt?: Date;

  @Prop()
  finishedAt?: Date;
}

export const GameRoomSchema = SchemaFactory.createForClass(GameRoom);

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { MoodType } from '../../shared/types/game.types';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, trim: true, lowercase: true })
  username: string;

  @Prop({ type: String, default: null })
  pinHash: string | null;

  @Prop({ required: true })
  avatar: string;

  @Prop({ enum: ['Happy', 'Angry', 'Missing'], default: 'Happy' })
  mood: MoodType;

  @Prop({ enum: ['local', 'google'], default: 'local' })
  authProvider: 'local' | 'google';

  @Prop({ type: String, default: null })
  googleId: string | null;

  @Prop({ default: 0 })
  gamesPlayed: number;

  @Prop({ default: 0 })
  gamesWon: number;
}

export const UserSchema = SchemaFactory.createForClass(User);

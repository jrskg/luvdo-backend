import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MoodType } from '../shared/types/game.types';
import { User, UserDocument } from './schemas/user.schema';

export interface CreateUserParams {
  name: string;
  username: string;
  pinHash: string | null;
  avatar: string;
  mood?: MoodType;
  authProvider?: 'local' | 'google';
  googleId?: string;
}

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async create(params: CreateUserParams): Promise<UserDocument> {
    const user = new this.userModel({
      name: params.name,
      username: params.username.toLowerCase(),
      pinHash: params.pinHash ?? null,
      avatar: params.avatar,
      mood: params.mood ?? 'Happy',
      authProvider: params.authProvider ?? 'local',
      googleId: params.googleId ?? null,
    });
    return user.save();
  }

  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  async findByUsername(username: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ username: username.toLowerCase() }).exec();
  }

  async findByGoogleId(googleId: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ googleId }).exec();
  }

  async updateMood(userId: string, mood: MoodType): Promise<UserDocument | null> {
    return this.userModel.findByIdAndUpdate(userId, { mood }, { new: true }).exec();
  }

  async updateAvatar(userId: string, avatar: string): Promise<UserDocument | null> {
    return this.userModel.findByIdAndUpdate(userId, { avatar }, { new: true }).exec();
  }

  async incrementStats(userId: string, won: boolean): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(userId, {
        $inc: { gamesPlayed: 1, ...(won ? { gamesWon: 1 } : {}) },
      })
      .exec();
  }
}

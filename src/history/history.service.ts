import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GameHistory, GameHistoryDocument, MoveRecord } from '../game/schemas/game-history.schema';

export interface CreateHistoryDto {
  roomId: string;
  roomName: string;
  winnerId: string;
  winnerName: string;
  players: Record<string, unknown>[];
  moves: MoveRecord[];
  events: Record<string, unknown>[];
  durationSeconds: number;
}

@Injectable()
export class HistoryService {
  constructor(
    @InjectModel(GameHistory.name)
    private readonly historyModel: Model<GameHistoryDocument>,
  ) {}

  async saveGameHistory(data: CreateHistoryDto): Promise<GameHistoryDocument> {
    return new this.historyModel(data).save();
  }

  async getPlayerHistory(userId: string, limit = 20): Promise<GameHistoryDocument[]> {
    return this.historyModel
      .find({ 'players.userId': userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  async getRoomHistory(roomId: string): Promise<GameHistoryDocument | null> {
    return this.historyModel.findOne({ roomId }).exec();
  }

  async addMoveRecord(roomId: string, move: MoveRecord): Promise<void> {
    await this.historyModel
      .findOneAndUpdate({ roomId }, { $push: { moves: move } })
      .exec();
  }
}

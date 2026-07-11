import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GameHistory, GameHistorySchema } from '../game/schemas/game-history.schema';
import { HistoryController } from './history.controller';
import { HistoryService } from './history.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: GameHistory.name, schema: GameHistorySchema }]),
    AuthModule,
  ],
  controllers: [HistoryController],
  providers: [HistoryService],
  exports: [HistoryService],
})
export class HistoryModule {}

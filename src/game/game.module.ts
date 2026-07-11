import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GameRoom, GameRoomSchema } from './schemas/game-room.schema';
import { GameHistory, GameHistorySchema } from './schemas/game-history.schema';
import { GameService } from './game.service';
import { GameGateway } from './game.gateway';
import { WebRTCGateway } from './webrtc.gateway';
import { UsersModule } from '../users/users.module';
import { HistoryModule } from '../history/history.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: GameRoom.name, schema: GameRoomSchema },
      { name: GameHistory.name, schema: GameHistorySchema },
    ]),
    UsersModule,
    HistoryModule,
    AuthModule,
  ],
  providers: [GameService, GameGateway, WebRTCGateway],
  exports: [GameService],
})
export class GameModule {}

import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { HistoryService } from './history.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('history')
@UseGuards(JwtAuthGuard)
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  @Get('me')
  getMyHistory(@Req() req: any) {
    return this.historyService.getPlayerHistory(String(req.user._id));
  }

  @Get(':roomId')
  getRoomHistory(@Param('roomId') roomId: string) {
    return this.historyService.getRoomHistory(roomId);
  }
}

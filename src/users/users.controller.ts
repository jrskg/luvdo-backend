import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MoodType } from '../shared/types/game.types';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':id')
  async getUser(@Param('id') id: string) {
    const user = await this.usersService.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  @Patch(':id/mood')
  async updateMood(@Param('id') id: string, @Body('mood') mood: MoodType) {
    const user = await this.usersService.updateMood(id, mood);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  @Patch(':id/avatar')
  async updateAvatar(@Param('id') id: string, @Body('avatar') avatar: string) {
    const user = await this.usersService.updateAvatar(id, avatar);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}

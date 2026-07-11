import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { MoodType } from '../../shared/types/game.types';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  avatar: string;

  @IsOptional()
  @IsEnum(['Happy', 'Angry', 'Missing'])
  mood?: MoodType;
}

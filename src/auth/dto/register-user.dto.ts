import { IsEnum, IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { MoodType } from '../../shared/types/game.types';

export class RegisterUserDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(20)
  @Matches(/^[a-z0-9_]+$/, { message: 'Username can only contain lowercase letters, numbers, and underscores' })
  username: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(4)
  @MaxLength(6)
  @Matches(/^\d+$/, { message: 'PIN must be digits only' })
  pin: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  avatar: string;

  @IsEnum(['Happy', 'Angry', 'Missing'])
  mood: MoodType;
}

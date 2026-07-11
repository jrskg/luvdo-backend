import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { UserDocument } from '../users/schemas/user.schema';
import { RegisterUserDto } from './dto/register-user.dto';
import { LoginUserDto } from './dto/login-user.dto';

export interface JwtPayload {
  sub: string;
  name: string;
}

export interface AuthResult {
  user: UserDocument;
  token: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterUserDto): Promise<AuthResult> {
    const existing = await this.usersService.findByUsername(dto.username);
    if (existing) throw new ConflictException('Username already taken');

    const pinHash = await bcrypt.hash(dto.pin, 10);
    const user = await this.usersService.create({
      name: dto.name,
      username: dto.username,
      pinHash,
      avatar: dto.avatar,
      mood: dto.mood,
      authProvider: 'local',
    });

    return { user, token: this.sign(user) };
  }

  async login(dto: LoginUserDto): Promise<AuthResult> {
    const user = await this.usersService.findByUsername(dto.username);
    if (!user || !user.pinHash) throw new UnauthorizedException('Invalid username or PIN');

    const valid = await bcrypt.compare(dto.pin, user.pinHash);
    if (!valid) throw new UnauthorizedException('Invalid username or PIN');

    return { user, token: this.sign(user) };
  }

  async validateToken(token: string): Promise<UserDocument | null> {
    try {
      const payload = this.jwtService.verify<JwtPayload>(token);
      return this.usersService.findById(payload.sub);
    } catch {
      return null;
    }
  }

  async verifyJwt(payload: JwtPayload): Promise<UserDocument> {
    const user = await this.usersService.findById(payload.sub);
    if (!user) throw new UnauthorizedException('User not found');
    return user;
  }

  private sign(user: UserDocument): string {
    const payload: JwtPayload = { sub: String(user._id), name: user.name };
    return this.jwtService.sign(payload);
  }
}

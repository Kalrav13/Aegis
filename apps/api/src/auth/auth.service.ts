import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { prisma } from '@testlens/db';
import * as bcrypt from 'bcrypt';
import { AppConfigService } from '../common/config/config.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: AppConfigService
  ) {}

  public async register(body: { email: string; password?: string; name?: string }) {
    const email = body.email.toLowerCase().trim();
    
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      throw new ConflictException('A user with this email address already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(body.password || 'password123', 10);

    // Save user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: body.name || null
      }
    });

    // Generate JWT token
    const token = this.generateToken(user.id, user.email);

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    };
  }

  public async login(body: { email: string; password?: string }) {
    const email = body.email.toLowerCase().trim();
    const password = body.password || '';

    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const token = this.generateToken(user.id, user.email);

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    };
  }

  private generateToken(userId: string, email: string): string {
    const payload = { sub: userId, email };
    return this.jwtService.sign(payload, {
      secret: this.configService.jwtSecret,
      expiresIn: '30d' // Session lasts long-term as requested
    });
  }

  public async validateUserById(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      name: user.name
    };
  }
}

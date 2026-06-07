import { Controller, Post, Body, Get, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  public async register(@Body() body: { email: string; password?: string; name?: string }) {
    return this.authService.register(body);
  }

  @Post('login')
  public async login(@Body() body: { email: string; password?: string }) {
    return this.authService.login(body);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  public async getProfile(@CurrentUser() user: any) {
    return user;
  }
}

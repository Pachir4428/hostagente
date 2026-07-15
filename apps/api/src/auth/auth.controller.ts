import { Controller, Post, Body, UseGuards, Request, Res, Get } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  private setRefreshCookie(res: Response, token: string) {
    res.cookie('refresh_token', token, {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === 'true',
      sameSite: (process.env.COOKIE_SAMESITE as any) || 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  @UseGuards(AuthGuard('local'))
  @Post('login')
  async login(@Request() req, @Res({ passthrough: true }) res: Response) {
    // If 2FA is on, email a code and require verification instead of signing in.
    // Checked defensively so a pending migration never blocks login.
    const twoFA = await this.authService.isTwoFactorEnabled(req.user?.id || req.user?.sub);
    if (twoFA) {
      const started = await this.authService.beginTwoFactor(req.user);
      if (started) return started; // { twoFactorRequired: true, tempToken }
    }
    const result = await this.authService.login(req.user);
    this.setRefreshCookie(res, result.refreshToken);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Post('2fa/verify')
  async verify2fa(@Body() body: { tempToken: string; code: string }, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.verifyTwoFactor(body.tempToken, body.code);
    this.setRefreshCookie(res, result.refreshToken);
    return { accessToken: result.accessToken, user: result.user };
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/toggle')
  async toggle2fa(@Request() req, @Body() body: { enabled: boolean }) {
    return this.authService.setTwoFactor(req.user.sub || req.user.id, !!body.enabled);
  }

  @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.register(dto.email, dto.password, dto.name, dto.businessName, dto.ref);
    res.cookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === 'true',
      sameSite: (process.env.COOKIE_SAMESITE as any) || 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    return { accessToken: result.accessToken, user: result.user };
  }

  @Post('refresh')
  async refresh(@Request() req, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.refresh_token;
    const result = await this.authService.refreshToken(token);
    res.cookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === 'true',
      sameSite: (process.env.COOKIE_SAMESITE as any) || 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    return { accessToken: result.accessToken, user: result.user };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('refresh_token');
    return { message: 'Logged out' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Request() req) {
    const enabled = await this.authService.isTwoFactorEnabled(req.user.sub || req.user.id);
    return { ...req.user, twoFactorEnabled: enabled };
  }
}

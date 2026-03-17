import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common'
import type { Request, Response } from 'express'
import { AuthService } from './auth.service'
import { LoginDto } from './dto/login.dto'

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('health')
  health() {
    return { status: 'ok' }
  }

  @Post('login')
  login(@Body() body: LoginDto, @Res({ passthrough: true }) res: Response) {
    const authResult = this.authService.login(body.username, body.password)

    // Store refresh token in secure httpOnly cookie
    res.cookie(authResult.refreshCookieName, authResult.refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: this.parseMaxAge(authResult.refreshTokenExpiresIn),
    })

    // Only return access token to client
    return {
      accessToken: authResult.accessToken,
      expiresIn: authResult.expiresIn,
      tokenType: authResult.tokenType,
    }
  }

  @Post('refresh')
  refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.[process.env.REFRESH_COOKIE_NAME ?? 'refreshToken']
    const authResult = this.authService.refresh(refreshToken)

    res.cookie(authResult.refreshCookieName, authResult.refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: this.parseMaxAge(authResult.refreshTokenExpiresIn),
    })

    return {
      accessToken: authResult.accessToken,
      expiresIn: authResult.expiresIn,
      tokenType: authResult.tokenType,
    }
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    this.authService.logout()
    res.clearCookie(process.env.REFRESH_COOKIE_NAME ?? 'refreshToken', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    })
    return { success: true }
  }

  private parseMaxAge(duration: string | number) {
    if (typeof duration === 'number') return duration

    // Supports formats like: 1h, 7d, 30m
    const match = duration.match(/^(\d+)([smhd])$/)
    if (!match) return undefined
    const value = Number(match[1])
    const unit = match[2]
    const multipliers: Record<string, number> = { s: 1000, m: 60000, h: 3600000, d: 86400000 }
    return value * (multipliers[unit] ?? 0)
  }
}

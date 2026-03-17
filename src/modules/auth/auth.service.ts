import { Injectable, UnauthorizedException } from '@nestjs/common'
import { Secret, sign, verify } from 'jsonwebtoken'
import type { StringValue } from 'ms'

export interface AuthTokenPayload {
  username: string
  role: 'admin'
  iat?: number
  exp?: number
}

@Injectable()
export class AuthService {
  private readonly adminUsername = process.env.ADMIN_USERNAME
  private readonly adminPassword = process.env.ADMIN_PASSWORD
  private readonly jwtSecret: Secret = process.env.JWT_SECRET ?? 'dev-secret'
  private readonly jwtExpiresIn: StringValue | number =
    (process.env.JWT_EXPIRES_IN as StringValue) ?? ('1h' as StringValue)
  private readonly refreshTokenExpiresIn: StringValue | number =
    (process.env.REFRESH_TOKEN_EXPIRES_IN as StringValue) ?? ('7d' as StringValue)
  private readonly refreshCookieName = process.env.REFRESH_COOKIE_NAME ?? 'refreshToken'

  // In-memory store for a single active refresh token (admin only)
  private currentRefreshToken?: string

  validateUser(username: string, password: string): boolean {
    return username === this.adminUsername && password === this.adminPassword
  }

  login(username: string, password: string) {
    if (!this.validateUser(username, password)) {
      throw new UnauthorizedException('Invalid credentials')
    }

    const accessToken = this.generateAccessToken(username)
    const refreshToken = this.generateRefreshToken(username)

    this.currentRefreshToken = refreshToken

    return {
      accessToken,
      refreshToken,
      expiresIn: this.jwtExpiresIn,
      tokenType: 'Bearer',
      refreshTokenExpiresIn: this.refreshTokenExpiresIn,
      refreshCookieName: this.refreshCookieName,
    }
  }

  refresh(refreshToken: string) {
    if (!refreshToken || refreshToken !== this.currentRefreshToken) {
      throw new UnauthorizedException('Invalid refresh token')
    }

    const payload = this.verifyRefreshToken(refreshToken)
    const accessToken = this.generateAccessToken(payload.username)
    const newRefreshToken = this.generateRefreshToken(payload.username)

    this.currentRefreshToken = newRefreshToken

    return {
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: this.jwtExpiresIn,
      tokenType: 'Bearer',
      refreshTokenExpiresIn: this.refreshTokenExpiresIn,
      refreshCookieName: this.refreshCookieName,
    }
  }

  logout() {
    this.currentRefreshToken = undefined
  }

  private generateAccessToken(username: string) {
    const payload: AuthTokenPayload = {
      username,
      role: 'admin',
    }
    return sign(payload, this.jwtSecret, {
      expiresIn: this.jwtExpiresIn,
    })
  }

  private generateRefreshToken(username: string) {
    const payload = { username } as const
    return sign(payload, this.jwtSecret, {
      expiresIn: this.refreshTokenExpiresIn,
    })
  }

  private verifyRefreshToken(token: string) {
    return verify(token, this.jwtSecret) as { username: string }
  }

  verifyToken(token: string): AuthTokenPayload {
    return verify(token, this.jwtSecret) as AuthTokenPayload
  }
}

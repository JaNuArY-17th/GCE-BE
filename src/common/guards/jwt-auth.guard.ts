import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { verify } from 'jsonwebtoken'

@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest()
    const authHeader = request.headers?.authorization

    if (!authHeader || typeof authHeader !== 'string') {
      throw new UnauthorizedException('Missing Authorization header')
    }

    const [scheme, token] = authHeader.split(' ')
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Invalid Authorization header')
    }

    try {
      const secret = process.env.JWT_SECRET ?? 'dev-secret'
      const payload = verify(token, secret)
      request.user = payload
      return true
    } catch (err) {
      throw new UnauthorizedException('Invalid or expired token')
    }
  }
}

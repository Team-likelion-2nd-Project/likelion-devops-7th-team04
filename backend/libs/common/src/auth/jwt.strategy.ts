import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthenticatedUser, JwtPayload } from './jwt-payload.interface';

// api-gateway에서 Authorization: Bearer <accessToken> 헤더를 검증하는 전략입니다.
// auth-service가 서명할 때 쓰는 것과 동일한 JWT_ACCESS_SECRET을 사용해야 합니다.
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret) {
      // 운영 환경에서 시크릿 누락을 조용히 넘기지 않기 위한 방어 로직
      console.warn('⚠️ JWT_ACCESS_SECRET이 설정되지 않아 개발용 기본값을 사용합니다.');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret || 'dev-access-secret',
    });
  }

  validate(payload: JwtPayload): AuthenticatedUser {
    if (!payload?.sub) {
      throw new UnauthorizedException('유효하지 않은 토큰입니다.');
    }
    return { userId: payload.sub, email: payload.email, role: payload.role };
  }
}

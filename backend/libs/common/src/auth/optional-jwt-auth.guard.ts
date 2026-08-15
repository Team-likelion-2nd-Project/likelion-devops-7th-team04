import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthenticatedUser } from './jwt-payload.interface';

// 라우트에 @UseGuards(OptionalJwtAuthGuard) 를 붙이면 Authorization 헤더의 JWT를 검증하되,
// 토큰이 없거나 유효하지 않아도 401을 던지지 않고 req.user 를 null로 둔 채 통과시킵니다.
// 로그인/비로그인 사용자를 모두 받아야 하는 라우트(예: 챗봇 메시지 전송)에서 사용합니다.
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = AuthenticatedUser>(
    _err: unknown,
    user: TUser | false,
  ): TUser | null {
    return user || null;
  }
}

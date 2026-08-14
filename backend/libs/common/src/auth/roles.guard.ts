import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import { AuthenticatedUser } from './jwt-payload.interface';

// JwtAuthGuard 뒤에 @UseGuards(JwtAuthGuard, RolesGuard) 순서로 붙여서 사용합니다.
// @Roles()가 없는 라우트는 그대로 통과시킵니다.
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;
    const hasRole = requiredRoles.includes(user?.role ?? '');

    // 레거시 users.role='ADMIN' 데이터로 발급된 토큰(type: 'USER')이 관리자 API를
    // 통과하지 못하도록, ADMIN 권한이 필요한 라우트는 admins DB를 거쳐 발급된
    // 토큰(type: 'ADMIN')인지도 함께 검사합니다.
    const isAdminTypeConsistent =
      !requiredRoles.includes('ADMIN') || user?.type === 'ADMIN';

    return hasRole && isAdminTypeConsistent;
  }
}

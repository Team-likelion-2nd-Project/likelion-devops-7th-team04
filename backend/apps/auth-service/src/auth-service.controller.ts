import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { AuthServiceService } from './auth-service.service';

@Controller()
export class AuthServiceController {
  constructor(private readonly authServiceService: AuthServiceService) {}

  // proto의 AuthService / Register 메서드와 매핑 (회원가입)
  @GrpcMethod('AuthService', 'Register')
  async register(data: {
    email: string;
    password: string;
    name: string;
    phoneNumber: string;
  }) {
    return this.authServiceService.register(data);
  }

  // proto의 AuthService / Login 메서드와 매핑 (로그인)
  @GrpcMethod('AuthService', 'Login')
  async login(data: { email: string; password: string }) {
    return this.authServiceService.login(data);
  }

  // proto의 AuthService / Refresh 메서드와 매핑 (토큰 재발급)
  @GrpcMethod('AuthService', 'Refresh')
  async refresh(data: { refreshToken: string }) {
    return this.authServiceService.refresh(data);
  }

  // proto의 AuthService / Logout 메서드와 매핑 (로그아웃: Redis의 리프레시 토큰 삭제)
  @GrpcMethod('AuthService', 'Logout')
  async logout(data: { userId: number }) {
    return this.authServiceService.logout(data);
  }
}

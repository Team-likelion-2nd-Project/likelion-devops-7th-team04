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
}

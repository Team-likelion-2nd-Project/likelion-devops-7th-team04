import { Controller, Get } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { UserServiceService } from './user-service.service';

@Controller()
export class UserServiceController {
  constructor(private readonly userServiceService: UserServiceService) {}

  // proto의 UserService / GetHello 메서드와 매핑
  @GrpcMethod('UserService', 'GetHello')
  getHello(): { message: string } {
    return { message: this.userServiceService.getHello() };
  }

  // auth-service가 회원가입 시 호출: 프로필 생성 (이메일 중복 시 에러)
  @GrpcMethod('UserService', 'CreateUser')
  async createUser(data: { email: string; name: string; phoneNumber: string }) {
    return this.userServiceService.createUser(data);
  }

  // auth-service가 로그인 시 호출: 이메일로 프로필 조회 (미가입 이메일이면 에러)
  @GrpcMethod('UserService', 'GetUserByEmail')
  async getUserByEmail(data: { email: string }) {
    return this.userServiceService.getUserByEmail(data.email);
  }

  // DB 연결 확인 엔드포인트 (GET /db-check)
  @Get('db-check')
  async checkDb() {
    return await this.userServiceService.testConnection();
  }
}

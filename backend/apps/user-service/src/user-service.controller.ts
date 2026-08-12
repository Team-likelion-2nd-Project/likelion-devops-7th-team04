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

  // api-gateway가 관리자 전용 "전체 유저 목록 조회"(GET /users)에서 호출
  @GrpcMethod('UserService', 'GetUsers')
  async getUsers() {
    return this.userServiceService.getUsers();
  }

  // api-gateway가 "내 정보 조회"(GET /users/me), 관리자 "특정 유저 조회"(GET /users/:userId)에서 호출
  @GrpcMethod('UserService', 'GetUserById')
  async getUserById(data: { id: number }) {
    return this.userServiceService.getUserById(data.id);
  }

  // api-gateway가 "내 정보 수정"(PUT /users/me)에서 호출
  @GrpcMethod('UserService', 'UpdateUser')
  async updateUser(data: { id: number; name: string; phoneNumber: string }) {
    return this.userServiceService.updateUser(data.id, {
      name: data.name,
      phoneNumber: data.phoneNumber,
    });
  }

  // auth-service가 "회원 탈퇴"(DELETE /api/users/me)에서 호출: users 레코드를 deleted_user 백업
  // 테이블로 옮긴 뒤 users 테이블에서 제거 (없으면 에러)
  @GrpcMethod('UserService', 'DeleteUser')
  async deleteUser(data: { id: number }) {
    return this.userServiceService.deleteUser(data.id);
  }

  // DB 연결 확인 엔드포인트 (GET /db-check)
  @Get('db-check')
  async checkDb() {
    return await this.userServiceService.testConnection();
  }
}

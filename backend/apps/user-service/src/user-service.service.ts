import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { RpcException } from '@nestjs/microservices';
import { DataSource, Repository } from 'typeorm';
import { User, UserRole, UserStatus } from './entities/user.entity';

// proto의 User 메시지와 1:1 대응되는 응답 형태
export interface UserGrpcResponse {
  id: number;
  email: string;
  name: string;
  phoneNumber: string;
  role: string;
  status: string;
}

@Injectable()
export class UserServiceService implements OnModuleInit {
  private readonly logger = new Logger(UserServiceService.name);

  // TypeORM의 DataSource를 주입받음
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
  ) {}

  // 서비스 모듈이 로드될 때 DB 연결 상태 자동 점검
  async onModuleInit() {
    try {
      if (this.dataSource.isInitialized) {
        this.logger.log('✅ MariaDB 데이터베이스 연결 성공!');
      } else {
        this.logger.error('❌ MariaDB 데이터베이스가 초기화되지 않았습니다.');
      }
    } catch (error) {
      this.logger.error('❌ MariaDB 데이터베이스 연결 오류:', error);
    }
  }

  getHello(): string {
    return 'User Hello World!';
  }

  async testConnection(): Promise<string> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      // MariaDB 버전 조회 쿼리 실행
      const result = await queryRunner.query('SELECT VERSION() AS version');
      return `DB Connection OK! MariaDB Version: ${result[0].version}`;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return `DB Connection Failed: ${errorMessage}`;
    } finally {
      await queryRunner.release();
    }
  }

  // auth-service 회원가입 요청으로 프로필 생성. 이메일 중복 시 RpcException.
  async createUser(data: {
    email: string;
    name: string;
    phoneNumber: string;
  }): Promise<UserGrpcResponse> {
    const existing = await this.userRepository.findOne({
      where: { email: data.email },
    });
    if (existing) {
      throw new RpcException('이미 가입된 이메일입니다.');
    }

    const user = this.userRepository.create({
      email: data.email,
      name: data.name,
      phoneNumber: data.phoneNumber,
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
    });
    const saved = await this.userRepository.save(user);
    return this.toGrpcResponse(saved);
  }

  // auth-service 로그인 요청으로 이메일 기준 프로필 조회. 미가입 이메일이면 RpcException.
  async getUserByEmail(email: string): Promise<UserGrpcResponse> {
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      throw new RpcException('가입되지 않은 이메일입니다.');
    }
    return this.toGrpcResponse(user);
  }

  // api-gateway 관리자 전용 "전체 유저 목록 조회" 요청.
  async getUsers(): Promise<{ users: UserGrpcResponse[] }> {
    const users = await this.userRepository.find();
    return { users: users.map((user) => this.toGrpcResponse(user)) };
  }

  // api-gateway "내 정보 조회"(JWT의 userId) 및 관리자 "특정 유저 조회" 요청. 없으면 RpcException.
  async getUserById(id: number): Promise<UserGrpcResponse> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new RpcException('존재하지 않는 유저입니다.');
    }
    return this.toGrpcResponse(user);
  }

  // api-gateway "내 정보 수정"(JWT의 userId) 요청. 없으면 RpcException.
  async updateUser(
    id: number,
    data: { name: string; phoneNumber: string },
  ): Promise<UserGrpcResponse> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new RpcException('존재하지 않는 유저입니다.');
    }

    user.name = data.name;
    user.phoneNumber = data.phoneNumber;
    const saved = await this.userRepository.save(user);
    return this.toGrpcResponse(saved);
  }

  private toGrpcResponse(user: User): UserGrpcResponse {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phoneNumber: user.phoneNumber,
      role: user.role,
      status: user.status,
    };
  }
}

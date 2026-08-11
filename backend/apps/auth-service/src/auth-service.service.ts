import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ClientGrpc, RpcException } from '@nestjs/microservices';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { Observable, firstValueFrom } from 'rxjs';
import * as bcrypt from 'bcrypt';
import { Credential } from './entities/credential.entity';

const SALT_ROUNDS = 10;

// libs/common/src/proto/user.proto의 User 메시지와 1:1 대응
interface UserGrpcResponse {
  id: number;
  email: string;
  name: string;
  phoneNumber: string;
  role: string;
  status: string;
}

interface UserGrpcService {
  createUser(data: { email: string; name: string; phoneNumber: string }): Observable<UserGrpcResponse>;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  userId: number;
  email: string;
  name: string;
  role: string;
}

@Injectable()
export class AuthServiceService implements OnModuleInit {
  private userService!: UserGrpcService;

  constructor(
    @InjectRepository(Credential) private readonly credentialRepository: Repository<Credential>,
    private readonly jwtService: JwtService,
    @Inject('USER_SERVICE') private readonly userClient: ClientGrpc,
  ) {}

  onModuleInit() {
    this.userService = this.userClient.getService<UserGrpcService>('UserService');
  }

  // 회원가입: user-service에 프로필 생성 → 비밀번호 해시 저장 → 토큰 발급
  async register(data: {
    email: string;
    password: string;
    name: string;
    phoneNumber: string;
  }): Promise<AuthTokens> {
    const user = await firstValueFrom(
      this.userService.createUser({
        email: data.email,
        name: data.name,
        phoneNumber: data.phoneNumber,
      }),
    ).catch((err) => {
      // user-service가 이메일 중복 등으로 던진 RpcException 메시지를 그대로 전달
      throw new RpcException(err?.details || err?.message || '회원가입에 실패했습니다.');
    });

    const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);
    const credential = this.credentialRepository.create({ userId: user.id, passwordHash });
    await this.credentialRepository.save(credential);

    return this.issueTokens(user);
  }

  private issueTokens(user: UserGrpcResponse): AuthTokens {
    const payload = { sub: user.id, email: user.email, role: user.role };

    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_ACCESS_SECRET || 'dev-access-secret',
      expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN || '15m') as JwtSignOptions['expiresIn'],
    });
    const refreshToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
      expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as JwtSignOptions['expiresIn'],
    });

    return {
      accessToken,
      refreshToken,
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
  }
}

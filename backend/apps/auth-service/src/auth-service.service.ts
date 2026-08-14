import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ClientGrpc, RpcException } from '@nestjs/microservices';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { Observable, firstValueFrom } from 'rxjs';
import * as bcrypt from 'bcrypt';
import Redis from 'ioredis';
import { REDIS_CLIENT, JwtPayload, PrincipalType, getRequiredEnv } from '@app/common';
import { Credential } from './entities/credential.entity';
import { AdminCredential } from './entities/admin-credential.entity';

const SALT_ROUNDS = 10;

// 이메일/비밀번호 불일치와 미가입 이메일을 동일 메시지로 응답해 계정 존재 여부가 노출되지 않도록 합니다.
const INVALID_CREDENTIALS_MESSAGE = '이메일 또는 비밀번호가 일치하지 않습니다.';
const INVALID_REFRESH_TOKEN_MESSAGE = '유효하지 않거나 만료된 리프레시 토큰입니다.';
const INVALID_CURRENT_PASSWORD_MESSAGE = '현재 비밀번호가 일치하지 않습니다.';

// Redis에 리프레시 토큰을 저장하는 키. principal 타입(user/admin)별로 네임스페이싱해서, users.id와
// admins.id가 같은 숫자여도(예: 둘 다 5) 리프레시 토큰이 서로 덮어쓰이지 않도록 합니다.
// 1 principal당 1개만 유지하며(재로그인 시 이전 토큰은 자동 무효화), 로그아웃 시 이 키를 삭제하면
// 이후 Refresh 요청이 거부됩니다.
const refreshTokenKey = (type: PrincipalType, id: number) =>
  `refresh:${type.toLowerCase()}:${id}`;

// libs/common/src/proto/user.proto의 User 메시지와 1:1 대응
interface UserGrpcResponse {
  id: number;
  email: string;
  name: string;
  phoneNumber: string;
  role: string;
  status: string;
}

// libs/common/src/proto/user.proto의 Admin 메시지와 1:1 대응
interface AdminGrpcResponse {
  id: number;
  email: string;
  name: string;
}

interface UserGrpcService {
  createUser(data: { email: string; name: string; phoneNumber: string }): Observable<UserGrpcResponse>;
  getUserByEmail(data: { email: string }): Observable<UserGrpcResponse>;
  deleteUser(data: { id: number }): Observable<{ success: boolean }>;
}

interface AdminGrpcService {
  getAdminByEmail(data: { email: string }): Observable<AdminGrpcResponse>;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  userId: number;
  email: string;
  name: string;
  role: string;
}

// 토큰 발급 대상(고객 또는 관리자)을 표현하는 공통 형태. issueTokens()가 principal 종류와 무관하게
// 동일한 방식으로 토큰을 만들 수 있도록 login()/adminLogin()/refresh()에서 이 형태로 변환해 넘깁니다.
interface Principal {
  id: number;
  email: string;
  name: string;
  role: string;
  type: PrincipalType;
}

@Injectable()
export class AuthServiceService implements OnModuleInit {
  private userService!: UserGrpcService;
  private adminService!: AdminGrpcService;

  constructor(
    @InjectRepository(Credential)
    private readonly credentialRepository: Repository<Credential>,
    @InjectRepository(AdminCredential)
    private readonly adminCredentialRepository: Repository<AdminCredential>,
    private readonly jwtService: JwtService,
    @Inject('USER_SERVICE') private readonly userClient: ClientGrpc,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  onModuleInit() {
    // user.proto 한 파일 안에 UserService(고객)와 AdminService(관리자)가 함께 정의되어 있어
    // 같은 gRPC 클라이언트에서 서비스 이름만 다르게 꺼내 씁니다.
    this.userService =
      this.userClient.getService<UserGrpcService>('UserService');
    this.adminService =
      this.userClient.getService<AdminGrpcService>('AdminService');
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
      throw new RpcException(
        err?.details || err?.message || '회원가입에 실패했습니다.',
      );
    });

    const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);
    const credential = this.credentialRepository.create({
      userId: user.id,
      passwordHash,
    });
    await this.credentialRepository.save(credential);

    return this.issueTokens({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      type: 'USER',
    });
  }

  // 로그인(고객): user-service에서 이메일로 프로필 조회 → 비밀번호 해시 검증 → 토큰 발급
  async login(data: { email: string; password: string }): Promise<AuthTokens> {
    const user = await firstValueFrom(this.userService.getUserByEmail({ email: data.email })).catch(() => {
      // 미가입 이메일도 동일한 메시지로 응답 (계정 존재 여부 비노출)
      throw new RpcException(INVALID_CREDENTIALS_MESSAGE);
    });

    const credential = await this.credentialRepository.findOne({ where: { userId: user.id } });
    if (!credential) {
      throw new RpcException(INVALID_CREDENTIALS_MESSAGE);
    }

    const isPasswordValid = await bcrypt.compare(data.password, credential.passwordHash);
    if (!isPasswordValid) {
      throw new RpcException(INVALID_CREDENTIALS_MESSAGE);
    }

    return this.issueTokens({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      type: 'USER',
    });
  }

  // 로그인(관리자): user-service의 AdminService에서 이메일로 관리자 계정 조회 → 비밀번호 해시 검증(AdminCredential)
  // → 토큰 발급. 고객과 완전히 다른 테이블(admins/admin_credentials)을 본다는 점만 다르고, 이후 토큰
  // 발급/검증(@Roles·RolesGuard 등) 로직은 login()과 동일하게 재사용됩니다.
  async adminLogin(data: { email: string; password: string }): Promise<AuthTokens> {
    const admin = await firstValueFrom(this.adminService.getAdminByEmail({ email: data.email })).catch(() => {
      // 미등록 이메일도 동일한 메시지로 응답 (계정 존재 여부 비노출)
      throw new RpcException(INVALID_CREDENTIALS_MESSAGE);
    });

    const credential = await this.adminCredentialRepository.findOne({ where: { adminId: admin.id } });
    if (!credential) {
      throw new RpcException(INVALID_CREDENTIALS_MESSAGE);
    }

    const isPasswordValid = await bcrypt.compare(data.password, credential.passwordHash);
    if (!isPasswordValid) {
      throw new RpcException(INVALID_CREDENTIALS_MESSAGE);
    }

    return this.issueTokens({
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: 'ADMIN',
      type: 'ADMIN',
    });
  }

  // 토큰 재발급: 리프레시 토큰 서명 검증 → Redis에 저장된 값과 대조 → payload.type에 따라 고객/관리자
  // 프로필을 다시 조회해 최신 정보로 토큰을 재발급(로테이션)합니다.
  // 로그아웃된(= Redis에서 삭제된) 리프레시 토큰은 서명이 유효해도 거부됩니다.
  async refresh(data: { refreshToken: string }): Promise<AuthTokens> {
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(data.refreshToken, {
        secret: getRequiredEnv('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new RpcException(INVALID_REFRESH_TOKEN_MESSAGE);
    }

    const storedToken = await this.redis.get(refreshTokenKey(payload.type, payload.sub));
    if (!storedToken || storedToken !== data.refreshToken) {
      throw new RpcException(INVALID_REFRESH_TOKEN_MESSAGE);
    }

    if (payload.type === 'ADMIN') {
      const admin = await firstValueFrom(this.adminService.getAdminByEmail({ email: payload.email })).catch(() => {
        throw new RpcException(INVALID_REFRESH_TOKEN_MESSAGE);
      });
      return this.issueTokens({
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: 'ADMIN',
        type: 'ADMIN',
      });
    }

    // 최신 프로필(이름/권한 변경 등)을 반영해 토큰을 재발급합니다.
    const user = await firstValueFrom(this.userService.getUserByEmail({ email: payload.email })).catch(() => {
      throw new RpcException(INVALID_REFRESH_TOKEN_MESSAGE);
    });

    return this.issueTokens({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      type: 'USER',
    });
  }

  // 로그아웃: Redis에서 리프레시 토큰을 삭제합니다. JWT는 무상태이므로 이미 발급된 액세스 토큰은
  // (기본 15분) 만료 시점까지는 계속 유효하지만, Refresh를 통한 재발급은 즉시 차단됩니다.
  // type으로 고객/관리자 중 어느 쪽 리프레시 토큰을 지울지 구분합니다(Redis 키 네임스페이싱).
  async logout(data: { userId: number; type: PrincipalType }): Promise<{ success: boolean }> {
    await this.redis.del(refreshTokenKey(data.type, data.userId));
    return { success: true };
  }

  // 비밀번호 변경(고객 전용): 현재 비밀번호 검증 → 새 비밀번호로 해시 교체 → 다른 기기/세션 강제 재로그인(리프레시 토큰 삭제)
  async changePassword(data: {
    userId: number;
    currentPassword: string;
    newPassword: string;
  }): Promise<{ success: boolean }> {
    const credential = await this.credentialRepository.findOne({ where: { userId: data.userId } });
    if (!credential) {
      throw new RpcException(INVALID_CURRENT_PASSWORD_MESSAGE);
    }

    const isCurrentPasswordValid = await bcrypt.compare(data.currentPassword, credential.passwordHash);
    if (!isCurrentPasswordValid) {
      throw new RpcException(INVALID_CURRENT_PASSWORD_MESSAGE);
    }

    credential.passwordHash = await bcrypt.hash(data.newPassword, SALT_ROUNDS);
    await this.credentialRepository.save(credential);

    // 비밀번호가 바뀌었으므로 기존에 발급된 리프레시 토큰은 무효화합니다(다른 기기/세션은 재로그인 필요).
    await this.redis.del(refreshTokenKey('USER', data.userId));

    return { success: true };
  }

  // 회원 탈퇴(고객 전용): user-service에 프로필 삭제(백업 테이블 이관 포함)를 요청한 뒤, 자격증명과 Redis의
  // 리프레시 토큰을 삭제해 더 이상 로그인/재발급이 불가능하도록 만듭니다.
  async withdraw(data: { userId: number }): Promise<{ success: boolean }> {
    await firstValueFrom(this.userService.deleteUser({ id: data.userId })).catch((err) => {
      throw new RpcException(err?.details || err?.message || '회원 탈퇴에 실패했습니다.');
    });

    await this.credentialRepository.delete({ userId: data.userId });
    await this.redis.del(refreshTokenKey('USER', data.userId));

    return { success: true };
  }

  private async issueTokens(principal: Principal): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: principal.id,
      email: principal.email,
      role: principal.role,
      type: principal.type,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: getRequiredEnv('JWT_ACCESS_SECRET'),
      expiresIn: getRequiredEnv(
        'JWT_ACCESS_EXPIRES_IN',
      ) as JwtSignOptions['expiresIn'],
    });
    const refreshToken = this.jwtService.sign(payload, {
      secret: getRequiredEnv('JWT_REFRESH_SECRET'),
      expiresIn: getRequiredEnv(
        'JWT_REFRESH_EXPIRES_IN',
      ) as JwtSignOptions['expiresIn'],
    });

    // 리프레시 토큰의 TTL을 JWT의 실제 만료 시각(exp)에 맞춰 Redis에 저장합니다
    // (principal당 1개, 재로그인 시 덮어씀. 키는 principal 타입별로 네임스페이싱되어 있음).
    const { exp } = this.jwtService.decode<{ exp: number }>(refreshToken);
    const ttlSeconds = Math.max(exp - Math.floor(Date.now() / 1000), 1);
    await this.redis.set(
      refreshTokenKey(principal.type, principal.id),
      refreshToken,
      'EX',
      ttlSeconds,
    );

    return {
      accessToken,
      refreshToken,
      userId: principal.id,
      email: principal.email,
      name: principal.name,
      role: principal.role,
    };
  }
}

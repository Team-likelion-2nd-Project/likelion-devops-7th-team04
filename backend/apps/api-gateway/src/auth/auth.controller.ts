import { BadRequestException, Body, Controller, Inject, OnModuleInit, Post, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { Observable, firstValueFrom } from 'rxjs';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ApiCommonResponses } from '@app/common/decorators/api-response.decorator';
import { JwtAuthGuard, CurrentUser, AuthenticatedUser } from '@app/common';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';

interface AuthTokenResponse {
  accessToken: string;
  refreshToken: string;
  userId: number;
  email: string;
  name: string;
  role: string;
}

// proto의 AuthService 스펙과 1:1 대응되는 TS 인터페이스
interface AuthService {
  register(data: RegisterDto): Observable<AuthTokenResponse>;
  login(data: LoginDto): Observable<AuthTokenResponse>;
  refresh(data: RefreshDto): Observable<AuthTokenResponse>;
  logout(data: { userId: number }): Observable<{ success: boolean }>;
}

@ApiTags('AuthService')
@ApiCommonResponses()
@Controller('api/auth')
export class AuthController implements OnModuleInit {
  private authService!: AuthService;

  constructor(
    @Inject('AUTH_SERVICE') private readonly client: ClientGrpc,
  ) {}

  // NestJS 생명주기: 모듈이 초기화될 때 gRPC 서비스 객체를 추출합니다.
  onModuleInit() {
    this.authService = this.client.getService<AuthService>('AuthService');
  }

  /**
   * POST http://localhost:3000/api/auth/register
   * 브라우저/프론트엔드 HTTP 요청 수신 -> auth-service gRPC 호출 -> user-service에 프로필 생성
   */
  @Post('register')
  @ApiOperation({
    summary: '신규 회원가입',
    description:
      '이메일/비밀번호/이름을 받아 auth-service에 회원가입을 요청합니다. auth-service는 gRPC로 ' +
      'user-service에 프로필을 생성하고, 비밀번호는 해시하여 자체 DB에 저장한 뒤 액세스/리프레시 토큰을 발급합니다.',
  })
  @ApiResponse({
    status: 201,
    description: '회원가입 성공 (액세스/리프레시 토큰 발급)',
  })
  async register(@Body() dto: RegisterDto) {
    return firstValueFrom(this.authService.register(dto)).catch((err) => {
      throw new BadRequestException(err?.details || err?.message || '회원가입에 실패했습니다.');
    });
  }

  /**
   * POST http://localhost:3000/api/auth/login
   * 브라우저/프론트엔드 HTTP 요청 수신 -> auth-service gRPC 호출 -> 이메일/비밀번호 검증 후 토큰 발급
   */
  @Post('login')
  @ApiOperation({
    summary: '로그인',
    description:
      '이메일/비밀번호를 받아 auth-service에 로그인을 요청합니다. auth-service는 gRPC로 user-service에서 ' +
      '프로필을 조회하고, 자체 DB의 비밀번호 해시와 대조한 뒤 액세스/리프레시 토큰을 발급합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '로그인 성공 (액세스/리프레시 토큰 발급)',
  })
  @ApiResponse({
    status: 401,
    description: '이메일 또는 비밀번호가 일치하지 않음',
  })
  async login(@Body() dto: LoginDto) {
    return firstValueFrom(this.authService.login(dto)).catch((err) => {
      throw new UnauthorizedException(err?.details || err?.message || '로그인에 실패했습니다.');
    });
  }

  /**
   * POST http://localhost:3000/api/auth/refresh
   * 브라우저/프론트엔드 HTTP 요청 수신 -> auth-service gRPC 호출 -> Redis에 저장된 리프레시 토큰과 대조 후 재발급
   */
  @Post('refresh')
  @ApiOperation({
    summary: '토큰 재발급',
    description:
      '리프레시 토큰을 받아 auth-service에 재발급을 요청합니다. auth-service는 서명을 검증하고 Redis에 ' +
      '저장된 값과 대조한 뒤 액세스/리프레시 토큰을 새로 발급합니다(로테이션). 로그아웃되었거나 만료된 ' +
      '리프레시 토큰은 거부됩니다.',
  })
  @ApiResponse({
    status: 200,
    description: '재발급 성공 (액세스/리프레시 토큰 발급)',
  })
  @ApiResponse({
    status: 401,
    description: '유효하지 않거나 만료된, 혹은 로그아웃된 리프레시 토큰',
  })
  async refresh(@Body() dto: RefreshDto) {
    return firstValueFrom(this.authService.refresh(dto)).catch((err) => {
      throw new UnauthorizedException(err?.details || err?.message || '토큰 재발급에 실패했습니다.');
    });
  }

  /**
   * POST http://localhost:3000/api/auth/logout
   * 액세스 토큰(Authorization: Bearer)이 유효한 사용자만 호출할 수 있습니다.
   * auth-service가 Redis에 저장된 리프레시 토큰을 삭제해 이후 재발급(Refresh)을 차단합니다.
   * 단, JWT는 무상태이므로 이미 발급된 액세스 토큰 자체는 만료 시간(기본 15분)까지는 계속 유효합니다.
   */
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '로그아웃',
    description:
      '유효한 액세스 토큰을 가진 사용자만 호출할 수 있습니다. auth-service가 gRPC로 Redis에 저장된 ' +
      '리프레시 토큰을 삭제하여 재발급을 차단합니다. 클라이언트는 응답 후 보관 중인 액세스/리프레시 토큰을 ' +
      '함께 삭제해야 합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '로그아웃 성공',
  })
  @ApiResponse({
    status: 401,
    description: '유효하지 않거나 만료된 토큰',
  })
  async logout(@CurrentUser() user: AuthenticatedUser) {
    await firstValueFrom(this.authService.logout({ userId: user.userId })).catch((err) => {
      throw new BadRequestException(err?.details || err?.message || '로그아웃에 실패했습니다.');
    });
    return { message: '로그아웃되었습니다.' };
  }
}

import {
  BadRequestException,
  Body,
  Controller,
  Inject,
  OnModuleInit,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { Observable, firstValueFrom } from 'rxjs';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import ms from 'ms';
import { ApiCommonResponses } from '@app/common/decorators/api-response.decorator';
import { JwtAuthGuard, CurrentUser, AuthenticatedUser } from '@app/common';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

interface AuthTokenResponse {
  accessToken: string;
  refreshToken: string;
  userId: number;
  email: string;
  name: string;
  role: string;
}

// 리프레시 토큰은 httpOnly 쿠키로만 전달하고, 응답 바디에는 액세스 토큰 + 사용자 정보만 내려줍니다.
// 액세스 토큰은 프론트엔드가 메모리(변수)에만 보관하고, 리프레시 토큰(쿠키)으로 재발급받습니다.
type AuthClientResponse = Omit<AuthTokenResponse, 'refreshToken'>;

// proto의 AuthService 스펙과 1:1 대응되는 TS 인터페이스
interface AuthService {
  register(data: RegisterDto): Observable<AuthTokenResponse>;
  login(data: LoginDto): Observable<AuthTokenResponse>;
  refresh(data: RefreshDto): Observable<AuthTokenResponse>;
  logout(data: { userId: number }): Observable<{ success: boolean }>;
  changePassword(data: {
    userId: number;
    currentPassword: string;
    newPassword: string;
  }): Observable<{ success: boolean }>;
}

// 리프레시 토큰 쿠키는 브라우저 JS가 절대 읽을 수 없도록 httpOnly로 발급합니다 (XSS로 인한 탈취 방지).
// 개발(HTTP)/운영(HTTPS)을 함께 지원하기 위해 secure는 NODE_ENV 기준으로 분기합니다.
const REFRESH_COOKIE_NAME = 'refreshToken';
const COOKIE_BASE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

@ApiTags('AuthService')
@ApiCommonResponses()
@Controller('api/auth')
export class AuthController implements OnModuleInit {
  private authService!: AuthService;

  constructor(@Inject('AUTH_SERVICE') private readonly client: ClientGrpc) {}

  // NestJS 생명주기: 모듈이 초기화될 때 gRPC 서비스 객체를 추출합니다.
  onModuleInit() {
    this.authService = this.client.getService<AuthService>('AuthService');
  }

  // 리프레시 토큰만 httpOnly 쿠키에 담아, 만료 시간을 auth-service의 JWT_REFRESH_EXPIRES_IN 설정과 일치시킵니다.
  private setRefreshCookie(res: Response, refreshToken: string) {
    // env 값은 런타임 string이라 ms.StringValue로 좁혀지지 않으므로 캐스팅합니다.
    // 형식이 잘못되면(오탈자 등) ms()가 NaN을 반환하므로 즉시 실패하도록 검증합니다.
    const maxAge = ms(
      (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as ms.StringValue,
    );
    if (Number.isNaN(maxAge)) {
      throw new Error('JWT_REFRESH_EXPIRES_IN 형식이 올바르지 않습니다.');
    }

    res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
      ...COOKIE_BASE_OPTIONS,
      maxAge,
    });
  }

  // 액세스 토큰 + 사용자 정보만 응답 바디로 내려줍니다. 프론트엔드는 이 값을 localStorage가 아닌
  // 메모리(변수)에만 보관해야 합니다. 리프레시 토큰은 위 setRefreshCookie로 이미 쿠키에 담겼습니다.
  private toClientResponse(tokens: AuthTokenResponse): AuthClientResponse {
    const { accessToken, userId, email, name, role } = tokens;
    return { accessToken, userId, email, name, role };
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
      'user-service에 프로필을 생성하고, 비밀번호는 해시하여 자체 DB에 저장한 뒤 액세스/리프레시 토큰을 발급합니다. ' +
      '리프레시 토큰은 httpOnly 쿠키로, 액세스 토큰은 응답 바디로 전달됩니다(프론트는 메모리에만 보관).',
  })
  @ApiResponse({
    status: 201,
    description:
      '회원가입 성공 (액세스 토큰은 응답 바디, 리프레시 토큰은 httpOnly 쿠키로 발급)',
  })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await firstValueFrom(this.authService.register(dto)).catch(
      (err) => {
        throw new BadRequestException(
          err?.details || err?.message || '회원가입에 실패했습니다.',
        );
      },
    );
    this.setRefreshCookie(res, tokens.refreshToken);
    return this.toClientResponse(tokens);
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
      '프로필을 조회하고, 자체 DB의 비밀번호 해시와 대조한 뒤 액세스/리프레시 토큰을 발급합니다. ' +
      '리프레시 토큰은 httpOnly 쿠키로, 액세스 토큰은 응답 바디로 전달됩니다(프론트는 메모리에만 보관).',
  })
  @ApiResponse({
    status: 200,
    description:
      '로그인 성공 (액세스 토큰은 응답 바디, 리프레시 토큰은 httpOnly 쿠키로 발급)',
  })
  @ApiResponse({
    status: 401,
    description: '이메일 또는 비밀번호가 일치하지 않음',
  })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await firstValueFrom(this.authService.login(dto)).catch(
      (err) => {
        throw new UnauthorizedException(
          err?.details || err?.message || '로그인에 실패했습니다.',
        );
      },
    );
    this.setRefreshCookie(res, tokens.refreshToken);
    return this.toClientResponse(tokens);
  }

  /**
   * POST http://localhost:3000/api/auth/refresh
   * 브라우저/프론트엔드 HTTP 요청 수신 -> auth-service gRPC 호출 -> Redis에 저장된 리프레시 토큰과 대조 후 재발급
   * 리프레시 토큰은 요청 바디가 아닌 httpOnly 쿠키에서 읽습니다 (JS로 접근 불가능하므로 body에 담을 수 없음).
   */
  @Post('refresh')
  @ApiOperation({
    summary: '토큰 재발급',
    description:
      'httpOnly 쿠키의 리프레시 토큰으로 auth-service에 재발급을 요청합니다. auth-service는 서명을 검증하고 ' +
      'Redis에 저장된 값과 대조한 뒤 액세스/리프레시 토큰을 새로 발급합니다(로테이션). 로그아웃되었거나 만료된 ' +
      '리프레시 토큰은 거부됩니다.',
  })
  @ApiResponse({
    status: 200,
    description:
      '재발급 성공 (새 액세스 토큰은 응답 바디, 리프레시 토큰은 httpOnly 쿠키로 갱신)',
  })
  @ApiResponse({
    status: 401,
    description: '유효하지 않거나 만료된, 혹은 로그아웃된 리프레시 토큰',
  })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!refreshToken) {
      throw new UnauthorizedException('리프레시 토큰이 없습니다.');
    }

    const tokens = await firstValueFrom(
      this.authService.refresh({ refreshToken }),
    ).catch((err) => {
      throw new UnauthorizedException(
        err?.details || err?.message || '토큰 재발급에 실패했습니다.',
      );
    });
    this.setRefreshCookie(res, tokens.refreshToken);
    return this.toClientResponse(tokens);
  }

  /**
   * POST http://localhost:3000/api/auth/logout
   * 액세스 토큰(Authorization: Bearer, 프론트가 메모리에서 꺼내 실어 보냄)이 유효한 사용자만 호출할 수 있습니다.
   * auth-service가 Redis에 저장된 리프레시 토큰을 삭제해 이후 재발급(Refresh)을 차단합니다.
   * 단, JWT는 무상태이므로 이미 발급된 액세스 토큰 자체는 만료 시간(기본 15분)까지는 계속 유효합니다
   * (프론트는 응답 후 메모리에 든 액세스 토큰을 즉시 버려야 합니다).
   */
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '로그아웃',
    description:
      '유효한 액세스 토큰을 가진 사용자만 호출할 수 있습니다. auth-service가 gRPC로 Redis에 저장된 ' +
      '리프레시 토큰을 삭제하여 재발급을 차단합니다. 서버가 refreshToken 쿠키를 삭제하고, 프론트는 ' +
      '메모리에 든 액세스 토큰을 함께 버려야 합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '로그아웃 성공',
  })
  @ApiResponse({
    status: 401,
    description: '유효하지 않거나 만료된 토큰',
  })
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    await firstValueFrom(
      this.authService.logout({ userId: user.userId }),
    ).catch((err) => {
      throw new BadRequestException(
        err?.details || err?.message || '로그아웃에 실패했습니다.',
      );
    });
    res.clearCookie(REFRESH_COOKIE_NAME, COOKIE_BASE_OPTIONS);
    return { message: '로그아웃되었습니다.' };
  }

  /**
   * PATCH http://localhost:3000/api/auth/password
   * 액세스 토큰(Authorization: Bearer, 프론트가 메모리에서 꺼내 실어 보냄)이 유효한 사용자 본인의 비밀번호를 변경합니다.
   * auth-service가 현재 비밀번호를 검증한 뒤 새 비밀번호로 해시를 교체하고, Redis의 리프레시 토큰을
   * 삭제해 다른 기기/세션은 재로그인이 필요하도록 만듭니다.
   */
  @Patch('password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '비밀번호 변경',
    description:
      '유효한 액세스 토큰을 가진 사용자 본인의 비밀번호를 변경합니다. 현재 비밀번호가 일치해야 하며, ' +
      '변경 성공 시 다른 기기/세션의 리프레시 토큰은 무효화되어 재로그인이 필요합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '비밀번호 변경 성공',
  })
  @ApiResponse({
    status: 401,
    description: '현재 비밀번호가 일치하지 않음',
  })
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ) {
    await firstValueFrom(
      this.authService.changePassword({ userId: user.userId, ...dto }),
    ).catch((err) => {
      throw new UnauthorizedException(
        err?.details || err?.message || '비밀번호 변경에 실패했습니다.',
      );
    });
    return { message: '비밀번호가 변경되었습니다.' };
  }
}

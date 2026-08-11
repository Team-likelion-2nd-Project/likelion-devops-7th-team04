import { BadRequestException, Body, Controller, Inject, OnModuleInit, Post } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { Observable, firstValueFrom } from 'rxjs';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ApiCommonResponses } from '@app/common/decorators/api-response.decorator';
import { RegisterDto } from './dto/register.dto';

// proto의 AuthService 스펙과 1:1 대응되는 TS 인터페이스
interface AuthService {
  register(data: RegisterDto): Observable<{
    accessToken: string;
    refreshToken: string;
    userId: number;
    email: string;
    name: string;
    role: string;
  }>;
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
}

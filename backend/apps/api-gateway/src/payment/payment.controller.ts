import {
  Body,
  Controller,
  Get,
  Inject,
  OnModuleInit,
  Post,
  UseGuards,
  BadGatewayException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { Observable, firstValueFrom } from 'rxjs';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ApiCommonResponses } from '@app/common/decorators/api-response.decorator';
import { JwtAuthGuard, CurrentUser, AuthenticatedUser } from '@app/common';
import { CreatePaymentRequestDto } from './dto/create-payment-request.dto';

// proto의 Payment 메시지와 1:1 대응되는 응답 형태
interface PaymentDto {
  paymentId: number;
  reservationId: number;
  approvalNumber: string;
  amount: number;
  paymentMethod: string;
  status: string;
  paidAt: string;
}

// proto의 PaymentService 스펙과 1:1 대응되는 TS 인터페이스
interface PaymentService {
  getHello(data: Record<string, never>): Observable<{ message: string }>;
  requestPayment(data: {
    reservationId: number;
    userId: number;
    paymentMethod: string;
  }): Observable<PaymentDto>;
}

// gRPC 클라이언트가 던지는 에러 형태 (nestjs/microservices의 RpcException을 클라이언트가
// 받으면 이 형태로 옴). 메시지는 details/message 둘 중 하나에 실려 온다.
interface GrpcErrorLike {
  details?: string;
  message?: string;
}

@ApiTags('PaymentService')
@ApiCommonResponses()
@Controller('api/payments')
export class PaymentController implements OnModuleInit {
  private paymentService!: PaymentService;

  constructor(@Inject('PAYMENT_SERVICE') private readonly client: ClientGrpc) {}

  // NestJS 생명주기: 모듈이 초기화될 때 gRPC 서비스 객체를 추출합니다.
  onModuleInit() {
    this.paymentService =
      this.client.getService<PaymentService>('PaymentService');
  }

  /**
   * GET http://localhost:3000/api/payment/hello
   * 브라우저/프론트엔드 HTTP 요청 수신 -> payment-service gRPC 호출
   */
  @Get('hello')
  @ApiOperation({
    summary: '결제 도메인 서버 헬스체크',
    description:
      'gRPC를 통해 payment-service 서버의 상태 및 Hello 메시지를 가져옵니다.',
  })
  @ApiResponse({
    status: 200,
    description: '{ Payment Hello World! 출력 }',
  })
  getHello(): Observable<{ message: string }> {
    return this.paymentService.getHello({});
  }

  /**
   * POST http://localhost:3000/api/payments
   * 로그인한 사용자 본인 명의의 예약에 대해 결제를 요청합니다. payment-service가 예약 금액을
   * 조회·검증하고 PG(mock)에 결제 승인을 동기로 요청한 뒤, 성공 시 결제내역을 저장합니다.
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '결제 요청',
    description:
      '유효한 액세스 토큰을 가진 사용자 본인 명의의 예약에 대해서만 결제를 요청할 수 있습니다. ' +
      'gRPC를 통해 payment-service가 예약 금액/소유자/상태를 검증하고, PG(mock)에 결제 생성+승인을 ' +
      '동기로 요청한 뒤 결제내역을 저장합니다.',
  })
  @ApiResponse({ status: 201, description: '결제 성공' })
  @ApiResponse({ status: 403, description: '본인의 예약이 아님' })
  @ApiResponse({ status: 404, description: '존재하지 않는 예약' })
  @ApiResponse({
    status: 409,
    description: '이미 결제되었거나 결제할 수 없는 예약 상태',
  })
  @ApiResponse({ status: 502, description: 'PG 서버 호출/승인 실패' })
  async requestPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePaymentRequestDto,
  ): Promise<PaymentDto> {
    return firstValueFrom(
      this.paymentService.requestPayment({
        reservationId: dto.reservationId,
        paymentMethod: dto.paymentMethod,
        userId: user.userId,
      }),
    ).catch((err: unknown) => {
      const grpcErr = err as GrpcErrorLike;
      const message =
        grpcErr.details || grpcErr.message || '결제 요청에 실패했습니다.';
      if (message.includes('존재하지 않는 예약')) {
        throw new NotFoundException(message);
      }
      if (message.includes('본인의 예약만')) {
        throw new ForbiddenException(message);
      }
      if (
        message.includes('이미 결제') ||
        message.includes('결제할 수 없는 예약 상태')
      ) {
        throw new ConflictException(message);
      }
      throw new BadGatewayException(message);
    });
  }
}

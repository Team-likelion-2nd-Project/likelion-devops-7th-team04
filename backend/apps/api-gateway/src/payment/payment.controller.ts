import { Controller, Get, Inject, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices'; 
import { Observable } from 'rxjs';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ApiCommonResponses } from '@app/common/decorators/api-response.decorator';

// proto의 BookingService 스펙과 1:1 대응되는 TS 인터페이스
interface PaymentService {
  getHello(data: {}): Observable<{ message: string }>;
}

@ApiTags('PaymentService')
@ApiCommonResponses()
@Controller('api/payments')
export class PaymentController implements OnModuleInit {
  private paymentService!: PaymentService;

  constructor(
    @Inject('PAYMENT_SERVICE') private readonly client: ClientGrpc,
  ) {}

  // NestJS 생명주기: 모듈이 초기화될 때 gRPC 서비스 객체를 추출합니다.
  onModuleInit() {
    this.paymentService = this.client.getService<PaymentService>('PaymentService');
  }

  /**
   * GET http://localhost:3000/api/payment/hello
   * 브라우저/프론트엔드 HTTP 요청 수신 -> payment-service gRPC 호출
   */
  @Get('hello')
  @ApiOperation({ 
    summary: '결제 도메인 서버 헬스체크', 
    description: 'gRPC를 통해 payment-service 서버의 상태 및 Hello 메시지를 가져옵니다.' 
  })
  @ApiResponse({ 
    status: 200, 
    description: '{ Payment Hello World! 출력 }' 
  })
  getHello(): Observable<{ message: string }> {
    return this.paymentService.getHello({});
  }
}
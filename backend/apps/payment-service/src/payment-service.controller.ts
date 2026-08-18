import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { PaymentServiceService } from './payment-service.service';

@Controller()
export class PaymentServiceController {
  constructor(private readonly paymentServiceService: PaymentServiceService) {}

  @GrpcMethod('PaymentService', 'GetHello')
  getHello(): { message: string } {
    return { message: this.paymentServiceService.getHello() };
  }

  // 유저 측 결제 요청. api-gateway가 JWT에서 추출한 userId와 함께 넘긴다.
  @GrpcMethod('PaymentService', 'RequestPayment')
  async requestPayment(data: {
    reservationId: number;
    userId: number;
    paymentMethod: string;
  }) {
    return this.paymentServiceService.requestPayment(data);
  }

  // PG 웹훅. 서명 검증은 api-gateway에서 이미 끝난 뒤 호출된다.
  @GrpcMethod('PaymentService', 'HandlePaymentWebhook')
  async handlePaymentWebhook(data: {
    eventType: string;
    paymentKey: string;
    orderId: string;
    amount: number;
    paymentMethod: string;
    approvalNumber: string;
    status: string;
    occurredAt: string;
  }) {
    await this.paymentServiceService.handlePaymentWebhook(data);
    return {};
  }
}

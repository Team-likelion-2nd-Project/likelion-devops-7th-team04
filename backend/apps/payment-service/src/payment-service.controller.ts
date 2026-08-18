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
}

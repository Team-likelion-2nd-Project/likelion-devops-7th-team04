import { Controller, Get } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { PaymentServiceService } from './payment-service.service';

@Controller()
export class PaymentServiceController {
  constructor(private readonly paymentServiceService: PaymentServiceService) {}

  @GrpcMethod('PaymentService', 'GetHello')
  getHello(): { message: string } {
    return { message: this.paymentServiceService.getHello() };
  }
}

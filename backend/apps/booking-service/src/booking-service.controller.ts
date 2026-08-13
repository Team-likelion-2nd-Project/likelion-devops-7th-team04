import { Controller, Get } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { BookingServiceService } from './booking-service.service';

@Controller()
export class BookingServiceController {
  constructor(private readonly bookingServiceService: BookingServiceService) {}

  @GrpcMethod('BookingService', 'GetHello')
  getHello(): { message: string } {
    return { message: this.bookingServiceService.getHello() };
  }
}

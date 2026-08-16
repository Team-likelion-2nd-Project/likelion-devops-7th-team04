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

  // 관리자 전용: 전체 예약 목록 조회
  @GrpcMethod('BookingService', 'GetBookings')
  async getBookings() {
    const bookings = await this.bookingServiceService.getBookings();
    return { bookings };
  }

  // 특정 유저의 예약 목록 조회 (/me, /:userId 양쪽에서 재사용)
  @GrpcMethod('BookingService', 'GetBookingsByUserId')
  async getBookingsByUserId(data: { userId: number }) {
    const bookings = await this.bookingServiceService.getBookingsByUserId(data.userId);
    return { bookings };
  }

  // 본인 예약 취소
  @GrpcMethod('BookingService', 'CancelBooking')
  async cancelBooking(data: { reservationId: number; userId: number }) {
    return this.bookingServiceService.cancelBooking(data.reservationId, data.userId);
  }
}

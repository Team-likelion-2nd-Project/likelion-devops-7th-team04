import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { BookingServiceService } from './booking-service.service';
import { ReservationFacilityService } from './reservation-facility.service';

@Controller()
export class BookingServiceController {
  constructor(
    private readonly bookingServiceService: BookingServiceService,
    private readonly reservationFacilityService: ReservationFacilityService,
  ) {}

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
    const bookings = await this.bookingServiceService.getBookingsByUserId(
      data.userId,
    );
    return { bookings };
  }

  // 본인 예약 취소
  @GrpcMethod('BookingService', 'CancelBooking')
  async cancelBooking(data: { reservationId: number; userId: number }) {
    return this.bookingServiceService.cancelBooking(
      data.reservationId,
      data.userId,
    );
  }

  // 단건 예약 조회 (payment-service가 결제 요청 검증용으로 호출)
  @GrpcMethod('BookingService', 'GetBookingById')
  async getBookingById(data: { reservationId: number }) {
    return this.bookingServiceService.getBookingById(data.reservationId);
  }

  // 신규 예약 생성
  @GrpcMethod('BookingService', 'CreateBooking')
  async createBooking(data: {
    userId: number;
    roomId: number;
    checkInDate: string;
    checkOutDate: string;
    guestCount: number;
    hasIndoorPool: boolean;
    hasLounge: boolean;
  }) {
    return this.bookingServiceService.createBooking(data);
  }

  // 결제 승인 완료 후 payment-service가 호출: PENDING_PAYMENT -> RESERVED로 전환.
  @GrpcMethod('BookingService', 'ConfirmBooking')
  async confirmBooking(data: { reservationId: number }) {
    return this.bookingServiceService.confirmBooking(data.reservationId);
  }

  // 특정 예약에 연결된 편의시설 이용 내역 목록 조회
  @GrpcMethod('BookingService', 'GetReservationFacilitiesByReservationId')
  async getReservationFacilitiesByReservationId(data: {
    reservationId: number;
  }) {
    const reservationFacilities =
      await this.reservationFacilityService.getReservationFacilitiesByReservationId(
        data.reservationId,
      );
    return { reservationFacilities };
  }
}

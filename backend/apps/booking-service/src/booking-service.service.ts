import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Reservation } from './entities/reservation.entity';

// proto의 Booking 메시지와 1:1 대응되는 응답 형태
export interface BookingGrpcResponse {
  reservationId: number;
  userId: number;
  roomId: number;
  checkInDate: string;
  checkOutDate: string;
  hasIndoorPool: boolean;
  hasLounge: boolean;
  totalAmount: number;
  status: string;
}

@Injectable()
export class BookingServiceService {
  constructor(
    @InjectRepository(Reservation)
    private readonly reservationRepository: Repository<Reservation>,
  ) {}

  getHello(): string {
    return 'Booking Hello World!';
  }

  // 전체 예약 목록 조회 (관리자 전용, 권한 검증은 api-gateway에서 수행)
  async getBookings(): Promise<BookingGrpcResponse[]> {
    const reservations = await this.reservationRepository.find({
      order: { createdAt: 'DESC' },
    });
    return reservations.map((reservation) => this.toGrpcResponse(reservation));
  }

  // 특정 유저의 예약 목록 조회. userId가 이 서비스의 DB에 존재하지 않아도(유저 존재 여부는
  // 검증할 수 없음, 서비스 간 DB 분리 원칙) 빈 배열을 그대로 반환한다.
  async getBookingsByUserId(userId: number): Promise<BookingGrpcResponse[]> {
    const reservations = await this.reservationRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    return reservations.map((reservation) => this.toGrpcResponse(reservation));
  }

  private toGrpcResponse(reservation: Reservation): BookingGrpcResponse {
    return {
      reservationId: reservation.reservationId,
      userId: reservation.userId,
      roomId: reservation.roomId,
      checkInDate: reservation.checkInDate,
      checkOutDate: reservation.checkOutDate,
      hasIndoorPool: reservation.hasIndoorPool,
      hasLounge: reservation.hasLounge,
      totalAmount: reservation.totalAmount,
      status: reservation.status,
    };
  }
}

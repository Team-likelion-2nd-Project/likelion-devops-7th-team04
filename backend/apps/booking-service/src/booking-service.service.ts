import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ClientGrpc, RpcException } from '@nestjs/microservices';
import { Observable, firstValueFrom } from 'rxjs';
import { Repository } from 'typeorm';
import { Reservation, ReservationStatus } from './entities/reservation.entity';

// libs/common/src/proto/hotel.proto의 HotelService / SetRoomAvailability와 1:1 대응
interface HotelGrpcService {
  setRoomAvailability(data: {
    roomId: number;
    startDate: string;
    endDate: string;
    isAvailable: boolean;
  }): Observable<{ success: boolean }>;
}

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
export class BookingServiceService implements OnModuleInit {
  private readonly logger = new Logger(BookingServiceService.name);
  private hotelService!: HotelGrpcService;

  constructor(
    @InjectRepository(Reservation)
    private readonly reservationRepository: Repository<Reservation>,
    @Inject('HOTEL_SERVICE') private readonly hotelClient: ClientGrpc,
  ) {}

  onModuleInit() {
    this.hotelService =
      this.hotelClient.getService<HotelGrpcService>('HotelService');
  }

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

  // 본인 예약 취소. reservationId가 존재하지 않으면, 혹은 요청자가 예약자 본인이 아니면 RpcException.
  // 이미 취소/완료된 예약도 재취소할 수 없다.
  // 1) Reservation.status를 CANCELLED로 먼저 확정한다 (이 서비스의 소스 오브 트루스).
  // 2) hotel-service에 room_availabilities 복구를 요청한다 — 체크아웃 당일은 다음 손님의 체크인일이므로
  //    막지 않고, 체크인일부터 체크아웃 전날까지만 되돌린다. 이 호출이 실패해도 예약 자체는 이미
  //    취소된 상태이므로 요청을 실패시키지 않고 로그만 남긴다(가용일 동기화는 별도로 복구 가능).
  async cancelBooking(reservationId: number, userId: number): Promise<BookingGrpcResponse> {
    const reservation = await this.reservationRepository.findOne({
      where: { reservationId },
    });
    if (!reservation) {
      throw new RpcException('존재하지 않는 예약입니다.');
    }
    if (reservation.userId !== userId) {
      throw new RpcException('본인의 예약만 취소할 수 있습니다.');
    }
    if (reservation.status !== ReservationStatus.RESERVED) {
      throw new RpcException('이미 취소되었거나 완료된 예약입니다.');
    }

    reservation.status = ReservationStatus.CANCELLED;
    const saved = await this.reservationRepository.save(reservation);

    try {
      await firstValueFrom(
        this.hotelService.setRoomAvailability({
          roomId: reservation.roomId,
          startDate: reservation.checkInDate,
          endDate: this.dayBefore(reservation.checkOutDate),
          isAvailable: true,
        }),
      );
    } catch (error) {
      this.logger.error(
        `예약(#${reservationId}) 취소 후 room_availabilities 복구 요청 실패`,
        error instanceof Error ? error.stack : String(error),
      );
    }

    // TODO(환불): 결제(payment-service) 연동 후, 여기서 해당 예약(totalAmount)에 대한 환불 요청을
    // 추가해야 한다. payment.proto에 아직 Refund RPC가 없으므로 별도 작업으로 구현 예정.
    // (room_availabilities 복구와 동일하게 실패해도 예약 취소 자체는 막지 않되, 환불 실패는 반드시
    // 로그/재시도 큐 등으로 추적되어야 함 — 단순 로그만 남기는 현재 방식으로는 부족할 수 있음)

    return this.toGrpcResponse(saved);
  }

  // 'YYYY-MM-DD' 문자열을 하루 전 날짜로 변환한다. date 컬럼은 시간 정보가 없으므로 UTC 기준으로
  // 계산해도 타임존에 따라 날짜가 밀리지 않는다.
  private dayBefore(dateStr: string): string {
    const date = new Date(dateStr);
    date.setUTCDate(date.getUTCDate() - 1);
    return date.toISOString().slice(0, 10);
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

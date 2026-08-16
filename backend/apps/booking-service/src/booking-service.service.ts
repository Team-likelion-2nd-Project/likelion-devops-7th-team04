import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ClientGrpc, RpcException } from '@nestjs/microservices';
import { Observable, firstValueFrom } from 'rxjs';
import { Repository } from 'typeorm';
import { Reservation, ReservationStatus } from './entities/reservation.entity';

// libs/common/src/proto/hotel.proto의 ReserveRoomAvailabilityResponse 메시지와 1:1 대응
interface ReserveRoomAvailabilityGrpcResponse {
  totalAmount: number;
}

interface HotelGrpcService {
  reserveRoomAvailability(data: {
    roomId: number;
    startDate: string;
    endDate: string;
  }): Observable<ReserveRoomAvailabilityGrpcResponse>;
}

// 'YYYY-MM-DD' 문자열에 일 단위 offset을 더한 'YYYY-MM-DD' 문자열을 반환한다 (UTC 기준 계산,
// date 컬럼은 시간대 정보가 없으므로 로컬 타임존에 영향받지 않도록 UTC로 계산한다).
function addDays(dateStr: string, offset: number): string {
  const date = new Date(`${dateStr}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
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

  // 신규 예약 생성. checkInDate~(checkOutDate 하루 전)까지가 실제로 묵는 기간(박 수)이므로,
  // hotel-service의 ReserveRoomAvailability도 이 기간을 기준으로 검증/전환한다.
  // hotel-service가 이미 원자적으로 검증+전환을 수행하므로, 여기서는 그 결과(totalAmount)를 받아
  // 예약 row를 저장하기만 하면 된다.
  async createBooking(data: {
    userId: number;
    roomId: number;
    checkInDate: string;
    checkOutDate: string;
    hasIndoorPool: boolean;
    hasLounge: boolean;
  }): Promise<BookingGrpcResponse> {
    if (data.checkInDate >= data.checkOutDate) {
      throw new RpcException('체크아웃 날짜는 체크인 날짜보다 이후여야 합니다.');
    }

    const lastNightDate = addDays(data.checkOutDate, -1);

    const { totalAmount } = await firstValueFrom(
      this.hotelService.reserveRoomAvailability({
        roomId: data.roomId,
        startDate: data.checkInDate,
        endDate: lastNightDate,
      }),
    ).catch((err) => {
      throw new RpcException(
        err?.details || err?.message || '예약 가능한 객실이 아닙니다.',
      );
    });

    const reservation = this.reservationRepository.create({
      userId: data.userId,
      roomId: data.roomId,
      checkInDate: data.checkInDate,
      checkOutDate: data.checkOutDate,
      hasIndoorPool: data.hasIndoorPool,
      hasLounge: data.hasLounge,
      totalAmount,
      status: ReservationStatus.RESERVED,
    });
    const saved = await this.reservationRepository.save(reservation);
    return this.toGrpcResponse(saved);
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

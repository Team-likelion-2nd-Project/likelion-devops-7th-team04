import {
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  NotFoundException,
  OnModuleInit,
  Param,
  ParseIntPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { Observable, firstValueFrom } from 'rxjs';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { ApiCommonResponses } from '@app/common/decorators/api-response.decorator';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser, AuthenticatedUser } from '@app/common';

// proto의 Booking 메시지와 1:1 대응되는 응답 형태
interface BookingDto {
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

// proto의 BookingService 스펙과 1:1 대응되는 TS 인터페이스
interface BookingService {
  getHello(data: {}): Observable<{ message: string }>;
  getBookings(data: {}): Observable<{ bookings: BookingDto[] }>;
  getBookingsByUserId(data: { userId: number }): Observable<{ bookings: BookingDto[] }>;
  cancelBooking(data: { reservationId: number; userId: number }): Observable<BookingDto>;
}

@ApiTags('BookingService')
@ApiCommonResponses()
@Controller('api/bookings')
export class BookingController implements OnModuleInit {
  private bookingService!: BookingService;

  constructor(@Inject('BOOKING_SERVICE') private readonly client: ClientGrpc) {}

  // NestJS 생명주기: 모듈이 초기화될 때 gRPC 서비스 객체를 추출합니다.
  onModuleInit() {
    this.bookingService =
      this.client.getService<BookingService>('BookingService');
  }

  /**
   * GET http://localhost:3000/api/booking/hello
   * 브라우저/프론트엔드 HTTP 요청 수신 -> booking-service gRPC 호출
   */
  @Get('hello')
  @ApiOperation({
    summary: '예약 도메인 서버 헬스체크',
    description:
      'gRPC를 통해 booking-service 서버의 상태 및 Hello 메시지를 가져옵니다.',
  })
  @ApiResponse({
    status: 200,
    description: 'Booking Hello World! 출력',
  })
  getHello(): Observable<{ message: string }> {
    return this.bookingService.getHello({});
  }

  /**
   * GET http://localhost:3000/api/bookings
   * 관리자 전용. 전체 예약 목록을 조회합니다.
   */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({
    summary: '전체 예약 목록 조회 (관리자 전용)',
    description: '관리자 권한을 가진 사용자만 호출할 수 있습니다. gRPC를 통해 booking-service의 전체 예약 목록을 가져옵니다.',
  })
  @ApiResponse({
    status: 200,
    description: '전체 예약 목록 조회 성공',
  })
  @ApiResponse({
    status: 403,
    description: '관리자 권한이 없음',
  })
  async getBookings(): Promise<{ bookings: BookingDto[] }> {
    return firstValueFrom(this.bookingService.getBookings({}));
  }

  /**
   * GET http://localhost:3000/api/bookings/me
   * 로그인한 사용자 본인의 예약 목록을 조회합니다.
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '내 예약 목록 조회',
    description: '유효한 액세스 토큰을 가진 사용자 본인의 예약 목록을 조회합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '내 예약 목록 조회 성공',
  })
  async getMyBookings(@CurrentUser() user: AuthenticatedUser): Promise<{ bookings: BookingDto[] }> {
    return firstValueFrom(this.bookingService.getBookingsByUserId({ userId: user.userId }));
  }

  /**
   * GET http://localhost:3000/api/bookings/:userId
   * 관리자 전용. 특정 유저의 예약 목록을 조회합니다.
   */
  @Get(':userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiParam({ name: 'userId', description: '조회할 유저의 ID', type: Number })
  @ApiOperation({
    summary: '특정 유저 예약 목록 조회 (관리자 전용)',
    description: '관리자 권한을 가진 사용자만 호출할 수 있습니다. userId로 특정 유저의 예약 목록을 조회합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '예약 목록 조회 성공',
  })
  @ApiResponse({
    status: 403,
    description: '관리자 권한이 없음',
  })
  async getBookingsByUserId(@Param('userId', ParseIntPipe) userId: number): Promise<{ bookings: BookingDto[] }> {
    return firstValueFrom(this.bookingService.getBookingsByUserId({ userId }));
  }

  /**
   * PUT http://localhost:3000/api/bookings/{reservationId}
   * 로그인한 사용자 본인의 예약을 취소합니다. status를 CANCELLED로 변경하고, 예약했던 기간의
   * 예약 가능일(room_availabilities)을 복구합니다.
   * TODO(환불): payment-service 연동 후 결제 환불 처리를 이 취소 흐름에 추가해야 한다.
   */
  @Put(':reservationId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiParam({ name: 'reservationId', description: '취소할 예약 PK ID', type: Number })
  @ApiOperation({
    summary: '예약 취소',
    description:
      '유효한 액세스 토큰을 가진 사용자 본인의 예약만 취소할 수 있습니다. gRPC를 통해 booking-service에 예약 상태 변경 및 예약 가능일 복구를 요청합니다.',
  })
  @ApiResponse({ status: 200, description: '예약 취소 성공' })
  @ApiResponse({ status: 403, description: '본인의 예약이 아님' })
  @ApiResponse({ status: 404, description: '존재하지 않는 예약' })
  @ApiResponse({ status: 409, description: '이미 취소되었거나 완료된 예약' })
  async cancelBooking(
    @Param('reservationId', ParseIntPipe) reservationId: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<BookingDto> {
    return firstValueFrom(
      this.bookingService.cancelBooking({ reservationId, userId: user.userId }),
    ).catch((err) => {
      const message = err?.details || err?.message || '예약 취소에 실패했습니다.';
      if (message.includes('본인의 예약만')) {
        throw new ForbiddenException(message);
      }
      if (message.includes('이미 취소')) {
        throw new ConflictException(message);
      }
      throw new NotFoundException(message);
    });
  }
}

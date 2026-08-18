import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ClientGrpc, RpcException } from '@nestjs/microservices';
import { Observable, firstValueFrom } from 'rxjs';
import { Repository } from 'typeorm';
import { Payment, PaymentStatus } from './entities/payment.entity';
import { PgMockClient } from './pg-mock/pg-mock.client';

// libs/common/src/proto/booking.proto의 BookingService / GetBookingById와 1:1 대응
interface BookingGrpcService {
  getBookingById(data: { reservationId: number }): Observable<{
    reservationId: number;
    userId: number;
    totalAmount: number;
    status: string;
  }>;
}

// proto의 Payment 메시지와 1:1 대응되는 응답 형태
export interface PaymentGrpcResponse {
  paymentId: number;
  reservationId: number;
  approvalNumber: string;
  amount: number;
  paymentMethod: string;
  status: string;
  paidAt: string;
}

@Injectable()
export class PaymentServiceService implements OnModuleInit {
  private readonly logger = new Logger(PaymentServiceService.name);
  private bookingService!: BookingGrpcService;

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @Inject('BOOKING_SERVICE') private readonly bookingClient: ClientGrpc,
    private readonly pgMockClient: PgMockClient,
  ) {}

  onModuleInit() {
    this.bookingService =
      this.bookingClient.getService<BookingGrpcService>('BookingService');
  }

  getHello(): string {
    return 'Payment Hello World!';
  }

  // 유저의 결제 요청을 처리한다.
  // 1) booking-service에서 예약을 조회해 금액/소유자/상태를 검증
  // 2) 이미 결제된 예약인지 확인 (중복 결제 방지)
  // 3) PG(pg-mock-service)에 결제 생성+승인을 동기로 요청
  // 4) 승인 응답을 그대로 결제내역(paid)으로 저장
  // 실제 PG의 confirm API도 서버-투-서버 동기 호출로 그 자리에서 승인 결과를 받는 방식이라
  // (웹훅은 가상계좌 등 비동기 결제수단이나 사후 상태 통보용 보조 수단), 여기서도 동일하게
  // 승인 응답을 기다렸다가 즉시 결제내역을 확정 상태로 저장한다.
  async requestPayment(data: {
    reservationId: number;
    userId: number;
    paymentMethod: string;
  }): Promise<PaymentGrpcResponse> {
    const booking = await firstValueFrom(
      this.bookingService.getBookingById({
        reservationId: data.reservationId,
      }),
    ).catch(() => {
      throw new RpcException('존재하지 않는 예약입니다.');
    });

    if (booking.userId !== data.userId) {
      throw new RpcException('본인의 예약만 결제할 수 있습니다.');
    }
    if (booking.status !== 'RESERVED') {
      throw new RpcException('결제할 수 없는 예약 상태입니다.');
    }

    const alreadyPaid = await this.paymentRepository.findOne({
      where: { reservationId: data.reservationId, status: PaymentStatus.PAID },
    });
    if (alreadyPaid) {
      throw new RpcException('이미 결제된 예약입니다.');
    }

    const result = await this.pgMockClient.createAndApprove({
      orderId: String(data.reservationId),
      amount: booking.totalAmount,
      orderName: `예약 #${data.reservationId} 결제`,
      paymentMethod: data.paymentMethod,
    });

    if (!result.approvalNumber) {
      // approve 성공 응답에는 항상 approvalNumber가 포함되므로(정상 흐름이라면) 도달하지
      // 않아야 하지만, PG 응답 계약이 깨진 경우를 대비한 방어 코드.
      this.logger.error(
        `PG 승인 응답에 approvalNumber가 없습니다. (reservationId=${data.reservationId})`,
      );
      throw new RpcException('결제 승인에 실패했습니다.');
    }

    const payment = this.paymentRepository.create({
      reservationId: data.reservationId,
      approvalNumber: result.approvalNumber,
      amount: booking.totalAmount,
      paymentMethod: data.paymentMethod,
      status: PaymentStatus.PAID,
      paidAt: result.approvedAt ? new Date(result.approvedAt) : new Date(),
    });
    const saved = await this.paymentRepository.save(payment);

    return this.toGrpcResponse(saved);
  }

  private toGrpcResponse(payment: Payment): PaymentGrpcResponse {
    return {
      paymentId: payment.paymentId,
      reservationId: payment.reservationId,
      approvalNumber: payment.approvalNumber,
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      status: payment.status,
      paidAt: payment.paidAt.toISOString(),
    };
  }
}

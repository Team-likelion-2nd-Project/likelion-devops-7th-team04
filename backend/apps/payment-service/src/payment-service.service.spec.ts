import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { of, throwError } from 'rxjs';
import { RpcException } from '@nestjs/microservices';
import { PaymentServiceService } from './payment-service.service';
import { Payment, PaymentStatus } from './entities/payment.entity';
import { PgMockClient } from './pg-mock/pg-mock.client';

describe('PaymentServiceService', () => {
  let service: PaymentServiceService;

  const getBookingByIdMock = jest.fn();
  const createAndApproveMock = jest.fn();
  const findOneMock = jest.fn();
  const createMock = jest.fn();
  const saveMock = jest.fn();

  const reservedBooking = {
    reservationId: 1,
    userId: 10,
    totalAmount: 50000,
    status: 'RESERVED',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentServiceService,
        {
          provide: getRepositoryToken(Payment),
          useValue: {
            findOne: findOneMock,
            create: createMock,
            save: saveMock,
          },
        },
        {
          provide: 'BOOKING_SERVICE',
          useValue: {
            getService: () => ({ getBookingById: getBookingByIdMock }),
          },
        },
        {
          provide: PgMockClient,
          useValue: { createAndApprove: createAndApproveMock },
        },
      ],
    }).compile();

    service = module.get<PaymentServiceService>(PaymentServiceService);
    service.onModuleInit();
  });

  it('정상 결제 요청을 처리하고 결제내역을 저장한다', async () => {
    getBookingByIdMock.mockReturnValue(of(reservedBooking));
    findOneMock.mockResolvedValue(null);
    createAndApproveMock.mockResolvedValue({
      approvalNumber: '12345678',
      approvedAt: '2026-08-18T02:00:05.000Z',
    });
    createMock.mockReturnValue({});
    saveMock.mockResolvedValue({
      paymentId: 1,
      reservationId: 1,
      approvalNumber: '12345678',
      amount: 50000,
      paymentMethod: 'CARD',
      status: PaymentStatus.PAID,
      paidAt: new Date('2026-08-18T02:00:05.000Z'),
    });

    const result = await service.requestPayment({
      reservationId: 1,
      userId: 10,
      paymentMethod: 'CARD',
    });

    expect(createAndApproveMock).toHaveBeenCalledWith({
      orderId: '1',
      amount: 50000,
      orderName: '예약 #1 결제',
      paymentMethod: 'CARD',
    });
    expect(result.status).toBe(PaymentStatus.PAID);
    expect(result.approvalNumber).toBe('12345678');
  });

  it('존재하지 않는 예약이면 RpcException을 던진다', async () => {
    getBookingByIdMock.mockReturnValue(
      throwError(() => new Error('not found')),
    );

    await expect(
      service.requestPayment({
        reservationId: 999,
        userId: 10,
        paymentMethod: 'CARD',
      }),
    ).rejects.toThrow(RpcException);
  });

  it('본인의 예약이 아니면 RpcException을 던진다', async () => {
    getBookingByIdMock.mockReturnValue(of({ ...reservedBooking, userId: 999 }));

    await expect(
      service.requestPayment({
        reservationId: 1,
        userId: 10,
        paymentMethod: 'CARD',
      }),
    ).rejects.toThrow(RpcException);
  });

  it('RESERVED 상태가 아니면 RpcException을 던진다', async () => {
    getBookingByIdMock.mockReturnValue(
      of({ ...reservedBooking, status: 'CANCELLED' }),
    );

    await expect(
      service.requestPayment({
        reservationId: 1,
        userId: 10,
        paymentMethod: 'CARD',
      }),
    ).rejects.toThrow(RpcException);
  });

  it('이미 결제된 예약이면 RpcException을 던진다', async () => {
    getBookingByIdMock.mockReturnValue(of(reservedBooking));
    findOneMock.mockResolvedValue({ paymentId: 1 });

    await expect(
      service.requestPayment({
        reservationId: 1,
        userId: 10,
        paymentMethod: 'CARD',
      }),
    ).rejects.toThrow(RpcException);
  });

  it('PG 승인 실패 시 RpcException이 그대로 전파된다', async () => {
    getBookingByIdMock.mockReturnValue(of(reservedBooking));
    findOneMock.mockResolvedValue(null);
    createAndApproveMock.mockRejectedValue(
      new RpcException('결제 승인에 실패했습니다.'),
    );

    await expect(
      service.requestPayment({
        reservationId: 1,
        userId: 10,
        paymentMethod: 'CARD',
      }),
    ).rejects.toThrow(RpcException);
  });

  describe('handlePaymentWebhook', () => {
    const webhookBase = {
      eventType: 'PAYMENT.APPROVED',
      orderId: '1',
      amount: 50000,
      paymentMethod: 'CARD',
      approvalNumber: '12345678',
    };

    it('APPROVED 웹훅인데 이미 결제내역이 있으면 무시한다(중복 생성 방지)', async () => {
      findOneMock.mockResolvedValue({ paymentId: 1 });

      await service.handlePaymentWebhook(webhookBase);

      expect(createMock).not.toHaveBeenCalled();
    });

    it('APPROVED 웹훅인데 결제내역이 없으면 새로 생성한다(동기 흐름 구제)', async () => {
      findOneMock.mockResolvedValue(null);
      createMock.mockReturnValue({});
      saveMock.mockResolvedValue({ paymentId: 1 });

      await service.handlePaymentWebhook(webhookBase);

      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({
          reservationId: 1,
          approvalNumber: '12345678',
          amount: 50000,
          paymentMethod: 'CARD',
          status: PaymentStatus.PAID,
        }),
      );
      expect(saveMock).toHaveBeenCalled();
    });

    it('CANCELED 웹훅이고 결제내역이 있으면 refunded로 바꾼다', async () => {
      const existing = { paymentId: 1, status: PaymentStatus.PAID };
      findOneMock.mockResolvedValue(existing);
      saveMock.mockResolvedValue({
        ...existing,
        status: PaymentStatus.REFUNDED,
      });

      await service.handlePaymentWebhook({
        ...webhookBase,
        eventType: 'PAYMENT.CANCELED',
      });

      expect(saveMock).toHaveBeenCalledWith(
        expect.objectContaining({ status: PaymentStatus.REFUNDED }),
      );
    });

    it('CANCELED 웹훅인데 대응하는 결제내역이 없으면 아무것도 하지 않는다', async () => {
      findOneMock.mockResolvedValue(null);

      await service.handlePaymentWebhook({
        ...webhookBase,
        eventType: 'PAYMENT.CANCELED',
      });

      expect(saveMock).not.toHaveBeenCalled();
      expect(createMock).not.toHaveBeenCalled();
    });

    it('orderId가 숫자가 아니면 아무것도 하지 않는다', async () => {
      await service.handlePaymentWebhook({
        ...webhookBase,
        orderId: 'not-a-number',
      });

      expect(findOneMock).not.toHaveBeenCalled();
    });
  });
});

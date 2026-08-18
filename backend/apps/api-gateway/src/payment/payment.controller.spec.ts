import { Test, TestingModule } from '@nestjs/testing';
import { of, throwError } from 'rxjs';
import {
  BadGatewayException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AuthenticatedUser } from '@app/common';
import { PaymentController } from './payment.controller';

describe('PaymentController', () => {
  let controller: PaymentController;

  const getHelloMock = jest.fn();
  const requestPaymentMock = jest.fn();

  const user: AuthenticatedUser = {
    userId: 10,
    email: 'user@example.com',
    role: 'USER',
    type: 'USER',
  };

  beforeEach(async () => {
    getHelloMock.mockReturnValue(of({ message: 'Payment Hello World!' }));

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentController],
      providers: [
        {
          provide: 'PAYMENT_SERVICE',
          useValue: {
            getService: () => ({
              getHello: getHelloMock,
              requestPayment: requestPaymentMock,
            }),
          },
        },
      ],
    }).compile();

    controller = module.get<PaymentController>(PaymentController);
    controller.onModuleInit();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('requestPayment', () => {
    it('결제 성공 시 payment-service의 응답을 그대로 반환한다', async () => {
      const payment = {
        paymentId: 1,
        reservationId: 5,
        approvalNumber: '12345678',
        amount: 50000,
        paymentMethod: 'CARD',
        status: 'paid',
        paidAt: '2026-08-18T02:00:05.000Z',
      };
      requestPaymentMock.mockReturnValue(of(payment));

      const result = await controller.requestPayment(user, {
        reservationId: 5,
        paymentMethod: 'CARD',
      });

      expect(requestPaymentMock).toHaveBeenCalledWith({
        reservationId: 5,
        paymentMethod: 'CARD',
        userId: 10,
      });
      expect(result).toEqual(payment);
    });

    it('"존재하지 않는 예약" 에러는 404로 변환한다', async () => {
      requestPaymentMock.mockReturnValue(
        throwError(() => ({ message: '존재하지 않는 예약입니다.' })),
      );

      await expect(
        controller.requestPayment(user, {
          reservationId: 999,
          paymentMethod: 'CARD',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('"본인의 예약만" 에러는 403으로 변환한다', async () => {
      requestPaymentMock.mockReturnValue(
        throwError(() => ({ message: '본인의 예약만 결제할 수 있습니다.' })),
      );

      await expect(
        controller.requestPayment(user, {
          reservationId: 5,
          paymentMethod: 'CARD',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('"이미 결제" 에러는 409로 변환한다', async () => {
      requestPaymentMock.mockReturnValue(
        throwError(() => ({ message: '이미 결제된 예약입니다.' })),
      );

      await expect(
        controller.requestPayment(user, {
          reservationId: 5,
          paymentMethod: 'CARD',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('그 외 에러는 502로 변환한다', async () => {
      requestPaymentMock.mockReturnValue(
        throwError(() => ({ message: '결제 승인에 실패했습니다.' })),
      );

      await expect(
        controller.requestPayment(user, {
          reservationId: 5,
          paymentMethod: 'CARD',
        }),
      ).rejects.toThrow(BadGatewayException);
    });
  });
});

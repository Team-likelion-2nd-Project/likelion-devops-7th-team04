import { Test, TestingModule } from '@nestjs/testing';
import { PaymentServiceController } from './payment-service.controller';
import { PaymentServiceService } from './payment-service.service';

describe('PaymentServiceController', () => {
  let controller: PaymentServiceController;

  const getHelloMock = jest.fn();
  const requestPaymentMock = jest.fn();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentServiceController],
      providers: [
        {
          provide: PaymentServiceService,
          useValue: {
            getHello: getHelloMock,
            requestPayment: requestPaymentMock,
          },
        },
      ],
    }).compile();

    controller = module.get<PaymentServiceController>(PaymentServiceController);
  });

  it('getHello는 서비스의 getHello 결과를 message로 감싸 반환한다', () => {
    getHelloMock.mockReturnValue('Payment Hello World!');

    expect(controller.getHello()).toEqual({
      message: 'Payment Hello World!',
    });
  });

  it('requestPayment는 서비스의 requestPayment에 위임한다', async () => {
    const data = { reservationId: 1, userId: 2, paymentMethod: 'CARD' };
    requestPaymentMock.mockResolvedValue({ paymentId: 1 });

    await controller.requestPayment(data);

    expect(requestPaymentMock).toHaveBeenCalledWith(data);
  });
});

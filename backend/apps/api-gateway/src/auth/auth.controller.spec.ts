import { Test, TestingModule } from '@nestjs/testing';
import { of } from 'rxjs';
import { AuthController } from './auth.controller';

describe('AuthController', () => {
  let controller: AuthController;
  const registerMock = jest.fn();

  beforeEach(async () => {
    registerMock.mockReturnValue(
      of({ accessToken: 'access', refreshToken: 'refresh' }),
    );

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: 'AUTH_SERVICE',
          useValue: { getService: () => ({ register: registerMock }) },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    controller.onModuleInit();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    it('should call auth-service via gRPC and return its response', async () => {
      const dto = {
        email: 'user@example.com',
        password: 'password123',
        name: '홍길동',
        phoneNumber: '010-1234-5678',
      };

      const result = await controller.register(dto);

      expect(registerMock).toHaveBeenCalledWith(dto);
      expect(result).toEqual({
        accessToken: 'access',
        refreshToken: 'refresh',
      });
    });
  });
});

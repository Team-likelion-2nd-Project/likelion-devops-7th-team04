import { Test, TestingModule } from '@nestjs/testing';
import { AuthServiceController } from './auth-service.controller';
import { AuthServiceService } from './auth-service.service';

describe('AuthServiceController', () => {
  let authServiceController: AuthServiceController;
  let authServiceService: { register: jest.Mock };

  beforeEach(async () => {
    authServiceService = {
      register: jest.fn(),
    };

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AuthServiceController],
      providers: [
        { provide: AuthServiceService, useValue: authServiceService },
      ],
    }).compile();

    authServiceController = app.get<AuthServiceController>(
      AuthServiceController,
    );
  });

  describe('register', () => {
    it('should delegate to AuthServiceService.register', async () => {
      const dto = {
        email: 'user@example.com',
        password: 'password123',
        name: '홍길동',
        phoneNumber: '010-1234-5678',
      };
      authServiceService.register.mockResolvedValue({
        accessToken: 'access',
        refreshToken: 'refresh',
      });

      const result = await authServiceController.register(dto);

      expect(authServiceService.register).toHaveBeenCalledWith(dto);
      expect(result).toEqual({
        accessToken: 'access',
        refreshToken: 'refresh',
      });
    });
  });
});

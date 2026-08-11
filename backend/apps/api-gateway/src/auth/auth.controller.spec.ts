import { Test, TestingModule } from '@nestjs/testing';
import { of, throwError } from 'rxjs';
import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';

describe('AuthController', () => {
  let controller: AuthController;
  const registerMock = jest.fn();
  const loginMock = jest.fn();
  const refreshMock = jest.fn();
  const logoutMock = jest.fn();
  const changePasswordMock = jest.fn();

  beforeEach(async () => {
    registerMock.mockReturnValue(of({ accessToken: 'access', refreshToken: 'refresh' }));
    loginMock.mockReturnValue(of({ accessToken: 'access', refreshToken: 'refresh' }));
    refreshMock.mockReturnValue(of({ accessToken: 'new-access', refreshToken: 'new-refresh' }));
    logoutMock.mockReturnValue(of({ success: true }));
    changePasswordMock.mockReturnValue(of({ success: true }));

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: 'AUTH_SERVICE',
          useValue: {
            getService: () => ({
              register: registerMock,
              login: loginMock,
              refresh: refreshMock,
              logout: logoutMock,
              changePassword: changePasswordMock,
            }),
          },
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

  describe('login', () => {
    it('should call auth-service via gRPC and return its response', async () => {
      const dto = { email: 'user@example.com', password: 'password123' };

      const result = await controller.login(dto);

      expect(loginMock).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ accessToken: 'access', refreshToken: 'refresh' });
    });
  });

  describe('refresh', () => {
    it('should call auth-service via gRPC and return the rotated tokens', async () => {
      const dto = { refreshToken: 'refresh' };

      const result = await controller.refresh(dto);

      expect(refreshMock).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ accessToken: 'new-access', refreshToken: 'new-refresh' });
    });
  });

  describe('logout', () => {
    it('should call auth-service via gRPC with the current user id and return a success message', async () => {
      const user = { userId: 1, email: 'user@example.com', role: 'USER' };

      const result = await controller.logout(user);

      expect(logoutMock).toHaveBeenCalledWith({ userId: 1 });
      expect(result).toEqual({ message: '로그아웃되었습니다.' });
    });
  });

  describe('changePassword', () => {
    it('should call auth-service via gRPC with the current user id and dto, and return a success message', async () => {
      const user = { userId: 1, email: 'user@example.com', role: 'USER' };
      const dto = { currentPassword: 'password123', newPassword: 'newPassword456' };

      const result = await controller.changePassword(user, dto);

      expect(changePasswordMock).toHaveBeenCalledWith({ userId: 1, ...dto });
      expect(result).toEqual({ message: '비밀번호가 변경되었습니다.' });
    });

    it('should throw UnauthorizedException when the current password is wrong', async () => {
      changePasswordMock.mockReturnValue(throwError(() => ({ message: '현재 비밀번호가 일치하지 않습니다.' })));
      const user = { userId: 1, email: 'user@example.com', role: 'USER' };
      const dto = { currentPassword: 'wrong-password', newPassword: 'newPassword456' };

      await expect(controller.changePassword(user, dto)).rejects.toThrow(UnauthorizedException);
    });
  });
});

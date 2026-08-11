import { Test, TestingModule } from '@nestjs/testing';
import { of, throwError } from 'rxjs';
import { NotFoundException } from '@nestjs/common';
import { UserController } from './user.controller';

describe('UserController', () => {
  let controller: UserController;
  const getHelloMock = jest.fn();
  const getUsersMock = jest.fn();
  const getUserByIdMock = jest.fn();

  beforeEach(async () => {
    getHelloMock.mockReturnValue(of({ message: 'User Hello World!' }));
    getUsersMock.mockReturnValue(of({ users: [] }));
    getUserByIdMock.mockReturnValue(
      of({ id: 1, email: 'user@example.com', name: '홍길동', phoneNumber: '010-1234-5678', role: 'USER', status: 'ACTIVE' }),
    );

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: 'USER_SERVICE',
          useValue: {
            getService: () => ({
              getHello: getHelloMock,
              getUsers: getUsersMock,
              getUserById: getUserByIdMock,
            }),
          },
        },
      ],
    }).compile();

    controller = module.get<UserController>(UserController);
    controller.onModuleInit();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getUsers', () => {
    it('should call user-service via gRPC and return the user list', async () => {
      const users = [{ id: 1, email: 'a@example.com', name: 'A', phoneNumber: '010', role: 'USER', status: 'ACTIVE' }];
      getUsersMock.mockReturnValue(of({ users }));

      const result = await controller.getUsers();

      expect(getUsersMock).toHaveBeenCalledWith({});
      expect(result).toEqual({ users });
    });
  });

  describe('getMe', () => {
    it('should look up the current user by the id from the JWT payload', async () => {
      const user = { userId: 1, email: 'user@example.com', role: 'USER' };

      const result = await controller.getMe(user);

      expect(getUserByIdMock).toHaveBeenCalledWith({ id: 1 });
      expect(result).toEqual({
        id: 1,
        email: 'user@example.com',
        name: '홍길동',
        phoneNumber: '010-1234-5678',
        role: 'USER',
        status: 'ACTIVE',
      });
    });

    it('should throw NotFoundException when the profile is missing', async () => {
      getUserByIdMock.mockReturnValue(throwError(() => ({ message: '존재하지 않는 유저입니다.' })));
      const user = { userId: 999, email: 'ghost@example.com', role: 'USER' };

      await expect(controller.getMe(user)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getUserById', () => {
    it('should look up a user by the userId path param', async () => {
      const result = await controller.getUserById(1);

      expect(getUserByIdMock).toHaveBeenCalledWith({ id: 1 });
      expect(result).toEqual({
        id: 1,
        email: 'user@example.com',
        name: '홍길동',
        phoneNumber: '010-1234-5678',
        role: 'USER',
        status: 'ACTIVE',
      });
    });

    it('should throw NotFoundException when the user does not exist', async () => {
      getUserByIdMock.mockReturnValue(throwError(() => ({ message: '존재하지 않는 유저입니다.' })));

      await expect(controller.getUserById(999)).rejects.toThrow(NotFoundException);
    });
  });
});

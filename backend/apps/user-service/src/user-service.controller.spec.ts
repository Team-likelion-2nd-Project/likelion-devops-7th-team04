import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { UserServiceController } from './user-service.controller';
import { UserServiceService } from './user-service.service';
import { User } from './entities/user.entity';

describe('UserServiceController', () => {
  let userServiceController: UserServiceController;
  let userRepository: { findOne: jest.Mock; find: jest.Mock; save: jest.Mock };

  beforeEach(async () => {
    userRepository = { findOne: jest.fn(), find: jest.fn(), save: jest.fn() };

    const app: TestingModule = await Test.createTestingModule({
      controllers: [UserServiceController],
      providers: [
        UserServiceService,
        { provide: DataSource, useValue: {} },
        { provide: getRepositoryToken(User), useValue: userRepository },
      ],
    }).compile();

    userServiceController = app.get<UserServiceController>(
      UserServiceController,
    );
  });

  describe('getHello', () => {
    it('should return "User Hello World!"', () => {
      expect(userServiceController.getHello()).toEqual({
        message: 'User Hello World!',
      });
    });
  });

  describe('getUserByEmail', () => {
    it('should return the profile when the email is registered', async () => {
      userRepository.findOne.mockResolvedValue({
        id: 1,
        email: 'user@example.com',
        name: '홍길동',
        phoneNumber: '010-1234-5678',
        role: 'USER',
        status: 'ACTIVE',
      });

      const result = await userServiceController.getUserByEmail({ email: 'user@example.com' });

      expect(userRepository.findOne).toHaveBeenCalledWith({ where: { email: 'user@example.com' } });
      expect(result).toEqual({
        id: 1,
        email: 'user@example.com',
        name: '홍길동',
        phoneNumber: '010-1234-5678',
        role: 'USER',
        status: 'ACTIVE',
      });
    });

    it('should throw when the email is not registered', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(userServiceController.getUserByEmail({ email: 'missing@example.com' })).rejects.toThrow();
    });
  });

  describe('getUsers', () => {
    it('should return every user mapped to the gRPC response shape', async () => {
      userRepository.find.mockResolvedValue([
        { id: 1, email: 'a@example.com', name: 'A', phoneNumber: '010-0000-0000', role: 'USER', status: 'ACTIVE' },
        { id: 2, email: 'b@example.com', name: 'B', phoneNumber: '010-1111-1111', role: 'ADMIN', status: 'ACTIVE' },
      ]);

      const result = await userServiceController.getUsers();

      expect(userRepository.find).toHaveBeenCalled();
      expect(result).toEqual({
        users: [
          { id: 1, email: 'a@example.com', name: 'A', phoneNumber: '010-0000-0000', role: 'USER', status: 'ACTIVE' },
          { id: 2, email: 'b@example.com', name: 'B', phoneNumber: '010-1111-1111', role: 'ADMIN', status: 'ACTIVE' },
        ],
      });
    });
  });

  describe('getUserById', () => {
    it('should return the profile when the id exists', async () => {
      userRepository.findOne.mockResolvedValue({
        id: 1,
        email: 'user@example.com',
        name: '홍길동',
        phoneNumber: '010-1234-5678',
        role: 'USER',
        status: 'ACTIVE',
      });

      const result = await userServiceController.getUserById({ id: 1 });

      expect(userRepository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(result).toEqual({
        id: 1,
        email: 'user@example.com',
        name: '홍길동',
        phoneNumber: '010-1234-5678',
        role: 'USER',
        status: 'ACTIVE',
      });
    });

    it('should throw when the id does not exist', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(userServiceController.getUserById({ id: 999 })).rejects.toThrow();
    });
  });

  describe('updateUser', () => {
    it('should update the name/phoneNumber and return the saved profile', async () => {
      const existing = {
        id: 1,
        email: 'user@example.com',
        name: '홍길동',
        phoneNumber: '010-1234-5678',
        role: 'USER',
        status: 'ACTIVE',
      };
      userRepository.findOne.mockResolvedValue(existing);
      userRepository.save.mockImplementation((user) => Promise.resolve(user));

      const result = await userServiceController.updateUser({
        id: 1,
        name: '김철수',
        phoneNumber: '010-9999-9999',
      });

      expect(userRepository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(userRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: '김철수', phoneNumber: '010-9999-9999' }),
      );
      expect(result).toEqual({
        id: 1,
        email: 'user@example.com',
        name: '김철수',
        phoneNumber: '010-9999-9999',
        role: 'USER',
        status: 'ACTIVE',
      });
    });

    it('should throw when the id does not exist', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        userServiceController.updateUser({ id: 999, name: '김철수', phoneNumber: '010-9999-9999' }),
      ).rejects.toThrow();
    });
  });
});

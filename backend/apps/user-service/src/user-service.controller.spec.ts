import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { UserServiceController } from './user-service.controller';
import { UserServiceService } from './user-service.service';
import { User } from './entities/user.entity';

describe('UserServiceController', () => {
  let userServiceController: UserServiceController;
  let userRepository: { findOne: jest.Mock };

  beforeEach(async () => {
    userRepository = { findOne: jest.fn() };

    const app: TestingModule = await Test.createTestingModule({
      controllers: [UserServiceController],
      providers: [
        UserServiceService,
        { provide: DataSource, useValue: {} },
        { provide: getRepositoryToken(User), useValue: userRepository },
      ],
    }).compile();

    userServiceController = app.get<UserServiceController>(UserServiceController);
  });

  describe('getHello', () => {
    it('should return "User Hello World!"', () => {
      expect(userServiceController.getHello()).toEqual({ message: 'User Hello World!' });
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
});

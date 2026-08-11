import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { UserServiceController } from './user-service.controller';
import { UserServiceService } from './user-service.service';
import { User } from './entities/user.entity';

describe('UserServiceController', () => {
  let userServiceController: UserServiceController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [UserServiceController],
      providers: [
        UserServiceService,
        { provide: DataSource, useValue: {} },
        { provide: getRepositoryToken(User), useValue: {} },
      ],
    }).compile();

    userServiceController = app.get<UserServiceController>(UserServiceController);
  });

  describe('getHello', () => {
    it('should return "User Hello World!"', () => {
      expect(userServiceController.getHello()).toEqual({ message: 'User Hello World!' });
    });
  });
});

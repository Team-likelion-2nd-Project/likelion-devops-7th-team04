import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { HotelServiceController } from './hotel-service.controller';
import { HotelServiceService } from './hotel-service.service';
import { RoomService } from './room.service';
import { Hotel } from './entities/hotel.entity';
import { Room } from './entities/room.entity';

describe('HotelServiceController', () => {
  let hotelServiceController: HotelServiceController;
  let hotelRepository: { findOne: jest.Mock; find: jest.Mock; save: jest.Mock };
  let roomRepository: {
    findOne: jest.Mock;
    find: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
  };

  const hotel = {
    hotelId: 1,
    name: '르메르디앙 서울',
    address: '서울시 강남구',
    phoneNumber: '02-1234-5678',
    description: '5성급 호텔',
  };
  const room = {
    roomId: 1,
    hotelId: 1,
    name: '디럭스 더블룸',
    capacity: 2,
    description: '시티뷰를 갖춘 넓은 더블룸입니다.',
  };

  beforeEach(async () => {
    hotelRepository = { findOne: jest.fn(), find: jest.fn(), save: jest.fn() };
    roomRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
    };

    const app: TestingModule = await Test.createTestingModule({
      controllers: [HotelServiceController],
      providers: [
        HotelServiceService,
        RoomService,
        { provide: DataSource, useValue: {} },
        { provide: getRepositoryToken(Hotel), useValue: hotelRepository },
        { provide: getRepositoryToken(Room), useValue: roomRepository },
      ],
    }).compile();

    hotelServiceController = app.get<HotelServiceController>(
      HotelServiceController,
    );
  });

  describe('root', () => {
    it('should return "Hotel Hello World!"', () => {
      expect(hotelServiceController.getHello()).toEqual({
        message: 'Hotel Hello World!',
      });
    });
  });

  describe('getRooms', () => {
    it('should return the room list when the hotel exists', async () => {
      hotelRepository.findOne.mockResolvedValue(hotel);
      roomRepository.find.mockResolvedValue([room]);

      const result = await hotelServiceController.getRooms({ hotelId: 1 });

      expect(hotelRepository.findOne).toHaveBeenCalledWith({
        where: { hotelId: 1 },
      });
      expect(roomRepository.find).toHaveBeenCalledWith({
        where: { hotelId: 1 },
      });
      expect(result).toEqual({
        rooms: [
          {
            roomId: 1,
            hotelId: 1,
            name: '디럭스 더블룸',
            capacity: 2,
            description: '시티뷰를 갖춘 넓은 더블룸입니다.',
          },
        ],
      });
    });

    it('should throw RpcException when the hotel does not exist', async () => {
      hotelRepository.findOne.mockResolvedValue(null);

      await expect(
        hotelServiceController.getRooms({ hotelId: 999 }),
      ).rejects.toThrow(RpcException);
    });
  });

  describe('getRoom', () => {
    it('should return the room when it exists', async () => {
      roomRepository.findOne.mockResolvedValue(room);

      const result = await hotelServiceController.getRoom({
        hotelId: 1,
        roomId: 1,
      });

      expect(roomRepository.findOne).toHaveBeenCalledWith({
        where: { hotelId: 1, roomId: 1 },
      });
      expect(result).toEqual({
        roomId: 1,
        hotelId: 1,
        name: '디럭스 더블룸',
        capacity: 2,
        description: '시티뷰를 갖춘 넓은 더블룸입니다.',
      });
    });

    it('should throw RpcException when the room does not exist', async () => {
      roomRepository.findOne.mockResolvedValue(null);

      await expect(
        hotelServiceController.getRoom({ hotelId: 1, roomId: 999 }),
      ).rejects.toThrow(RpcException);
    });
  });
});

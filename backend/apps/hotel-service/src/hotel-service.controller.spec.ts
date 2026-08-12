import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { HotelServiceController } from './hotel-service.controller';
import { HotelServiceService } from './hotel-service.service';
import { RoomService } from './room.service';
import { Hotel } from './entities/hotel.entity';
import { Room } from './entities/room.entity';
import { RoomAvailability } from './entities/room-availability.entity';

describe('HotelServiceController', () => {
  let hotelServiceController: HotelServiceController;
  let hotelRepository: { findOne: jest.Mock; find: jest.Mock; save: jest.Mock };
  let roomRepository: {
    findOne: jest.Mock;
    find: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
  };
  let roomAvailabilityRepository: { find: jest.Mock };

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
    roomAvailabilityRepository = { find: jest.fn() };

    const app: TestingModule = await Test.createTestingModule({
      controllers: [HotelServiceController],
      providers: [
        HotelServiceService,
        RoomService,
        { provide: DataSource, useValue: {} },
        { provide: getRepositoryToken(Hotel), useValue: hotelRepository },
        { provide: getRepositoryToken(Room), useValue: roomRepository },
        {
          provide: getRepositoryToken(RoomAvailability),
          useValue: roomAvailabilityRepository,
        },
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

  describe('updateHotel', () => {
    it('should update and save the hotel when it exists', async () => {
      const existingHotel = { ...hotel };
      hotelRepository.findOne.mockResolvedValue(existingHotel);
      hotelRepository.save.mockImplementation((h: typeof existingHotel) =>
        Promise.resolve(h),
      );

      const result = await hotelServiceController.updateHotel({
        hotelId: 1,
        name: '신라 스테이 서울',
        address: '서울시 중구',
        phoneNumber: '02-9876-5432',
        description: '수정된 설명입니다.',
      });

      expect(hotelRepository.findOne).toHaveBeenCalledWith({
        where: { hotelId: 1 },
      });
      expect(hotelRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          hotelId: 1,
          name: '신라 스테이 서울',
          address: '서울시 중구',
          phoneNumber: '02-9876-5432',
          description: '수정된 설명입니다.',
        }),
      );
      expect(result).toEqual({
        hotelId: 1,
        name: '신라 스테이 서울',
        address: '서울시 중구',
        phoneNumber: '02-9876-5432',
        description: '수정된 설명입니다.',
      });
    });

    it('should throw RpcException when the hotel does not exist', async () => {
      hotelRepository.findOne.mockResolvedValue(null);

      await expect(
        hotelServiceController.updateHotel({
          hotelId: 999,
          name: '신라 스테이 서울',
          address: '서울시 중구',
          phoneNumber: '02-9876-5432',
          description: '수정된 설명입니다.',
        }),
      ).rejects.toThrow(RpcException);
      expect(hotelRepository.save).not.toHaveBeenCalled();
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

  describe('updateRoom', () => {
    it('should update and save the room when it exists', async () => {
      const existingRoom = { ...room };
      roomRepository.findOne.mockResolvedValue(existingRoom);
      roomRepository.save.mockImplementation((r) => Promise.resolve(r));

      const result = await hotelServiceController.updateRoom({
        hotelId: 1,
        roomId: 1,
        name: '스탠다드 트윈룸',
        capacity: 3,
        description: '수정된 설명입니다.',
      });

      expect(roomRepository.findOne).toHaveBeenCalledWith({
        where: { hotelId: 1, roomId: 1 },
      });
      expect(roomRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          roomId: 1,
          hotelId: 1,
          name: '스탠다드 트윈룸',
          capacity: 3,
          description: '수정된 설명입니다.',
        }),
      );
      expect(result).toEqual({
        roomId: 1,
        hotelId: 1,
        name: '스탠다드 트윈룸',
        capacity: 3,
        description: '수정된 설명입니다.',
      });
    });

    it('should throw RpcException when the room does not exist', async () => {
      roomRepository.findOne.mockResolvedValue(null);

      await expect(
        hotelServiceController.updateRoom({
          hotelId: 1,
          roomId: 999,
          name: '스탠다드 트윈룸',
          capacity: 3,
          description: '수정된 설명입니다.',
        }),
      ).rejects.toThrow(RpcException);
      expect(roomRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('getRoomAvailability', () => {
    it('should report overall availability true when every day in range is available', async () => {
      roomRepository.findOne.mockResolvedValue(room);
      roomAvailabilityRepository.find.mockResolvedValue([
        { roomId: 1, date: '2026-08-20', price: 100000, isAvailable: true },
        { roomId: 1, date: '2026-08-21', price: 100000, isAvailable: true },
      ]);

      const result = await hotelServiceController.getRoomAvailability({
        hotelId: 1,
        roomId: 1,
        startDate: '2026-08-20',
        endDate: '2026-08-21',
      });

      expect(roomRepository.findOne).toHaveBeenCalledWith({
        where: { hotelId: 1, roomId: 1 },
      });
      expect(roomAvailabilityRepository.find).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        hotelId: 1,
        roomId: 1,
        startDate: '2026-08-20',
        endDate: '2026-08-21',
        isAvailable: true,
        availabilities: [
          { date: '2026-08-20', isAvailable: true, price: 100000 },
          { date: '2026-08-21', isAvailable: true, price: 100000 },
        ],
      });
    });

    it('should report overall availability false when a day is missing or unavailable', async () => {
      roomRepository.findOne.mockResolvedValue(room);
      // 2026-08-21 하루가 비어있어 구간(20~21) 전체가 아님 -> false
      roomAvailabilityRepository.find.mockResolvedValue([
        { roomId: 1, date: '2026-08-20', price: 100000, isAvailable: true },
      ]);

      const result = await hotelServiceController.getRoomAvailability({
        hotelId: 1,
        roomId: 1,
        startDate: '2026-08-20',
        endDate: '2026-08-21',
      });

      expect(result.isAvailable).toBe(false);
    });

    it('should throw RpcException when the room does not exist', async () => {
      roomRepository.findOne.mockResolvedValue(null);

      await expect(
        hotelServiceController.getRoomAvailability({
          hotelId: 1,
          roomId: 999,
          startDate: '2026-08-20',
          endDate: '2026-08-21',
        }),
      ).rejects.toThrow(RpcException);
      expect(roomAvailabilityRepository.find).not.toHaveBeenCalled();
    });
  });
});

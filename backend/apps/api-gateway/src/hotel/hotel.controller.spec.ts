import { Test, TestingModule } from '@nestjs/testing';
import { of, throwError } from 'rxjs';
import { NotFoundException } from '@nestjs/common';
import { HotelController } from './hotel.controller';

describe('HotelController', () => {
  let controller: HotelController;
  const getHelloMock = jest.fn();
  const getHotelsMock = jest.fn();
  const getHotelMock = jest.fn();
  const getRoomsMock = jest.fn();
  const getRoomMock = jest.fn();
  const createRoomMock = jest.fn();

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
    getHelloMock.mockReturnValue(of({ message: 'Hotel Hello World!' }));
    getHotelsMock.mockReturnValue(of({ hotels: [hotel] }));
    getHotelMock.mockReturnValue(of(hotel));
    getRoomsMock.mockReturnValue(of({ rooms: [room] }));
    getRoomMock.mockReturnValue(of(room));
    createRoomMock.mockReturnValue(of(room));

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HotelController],
      providers: [
        {
          provide: 'HOTEL_SERVICE',
          useValue: {
            getService: () => ({
              getHello: getHelloMock,
              getHotels: getHotelsMock,
              getHotel: getHotelMock,
              getRooms: getRoomsMock,
              getRoom: getRoomMock,
              createRoom: createRoomMock,
            }),
          },
        },
      ],
    }).compile();

    controller = module.get<HotelController>(HotelController);
    controller.onModuleInit();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getHotels', () => {
    it('should call hotel-service via gRPC and return the hotel list', async () => {
      const result = await new Promise((resolve) =>
        controller.getHotels().subscribe(resolve),
      );

      expect(getHotelsMock).toHaveBeenCalledWith({});
      expect(result).toEqual({ hotels: [hotel] });
    });
  });

  describe('getHotel', () => {
    it('should look up a hotel by the hotelId path param', async () => {
      const result = await controller.getHotel('1');

      expect(getHotelMock).toHaveBeenCalledWith({ hotelId: 1 });
      expect(result).toEqual(hotel);
    });

    it('should throw NotFoundException when the hotel does not exist', async () => {
      getHotelMock.mockReturnValue(
        throwError(() => ({ message: '존재하지 않는 호텔입니다.' })),
      );

      await expect(controller.getHotel('999')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getRooms', () => {
    it('should look up rooms by the hotelId path param', async () => {
      const result = await controller.getRooms(1);

      expect(getRoomsMock).toHaveBeenCalledWith({ hotelId: 1 });
      expect(result).toEqual({ rooms: [room] });
    });

    it('should throw NotFoundException when the hotel does not exist', async () => {
      getRoomsMock.mockReturnValue(
        throwError(() => ({ message: '존재하지 않는 호텔입니다.' })),
      );

      await expect(controller.getRooms(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getRoom', () => {
    it('should look up a room by the hotelId/roomId path params', async () => {
      const result = await controller.getRoom(1, 1);

      expect(getRoomMock).toHaveBeenCalledWith({ hotelId: 1, roomId: 1 });
      expect(result).toEqual(room);
    });

    it('should throw NotFoundException when the room does not exist', async () => {
      getRoomMock.mockReturnValue(
        throwError(() => ({ message: '존재하지 않는 객실입니다.' })),
      );

      await expect(controller.getRoom(1, 999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createRoom', () => {
    it('should register a new room under the hotel', async () => {
      const dto = {
        name: '디럭스 더블룸',
        capacity: 2,
        description: '시티뷰를 갖춘 넓은 더블룸입니다.',
      };

      const result = await controller.createRoom(1, dto);

      expect(createRoomMock).toHaveBeenCalledWith({ hotelId: 1, ...dto });
      expect(result).toEqual(room);
    });

    it('should throw NotFoundException when the hotel does not exist', async () => {
      createRoomMock.mockReturnValue(
        throwError(() => ({ message: '존재하지 않는 호텔입니다.' })),
      );
      const dto = { name: '디럭스 더블룸', capacity: 2 };

      await expect(controller.createRoom(999, dto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});

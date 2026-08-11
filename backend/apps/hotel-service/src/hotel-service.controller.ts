import { Controller, Get } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { HotelServiceService } from './hotel-service.service';
import { RoomService } from './room.service';

@Controller()
export class HotelServiceController {
  constructor(
    private readonly hotelServiceService: HotelServiceService,
    private readonly roomService: RoomService,
  ) {}

  // proto의 HotelService / GetHello 메서드와 매핑
  @GrpcMethod('HotelService', 'GetHello')
  getHello(): { message: string } {
    return { message: this.hotelServiceService.getHello() };
  }

  // proto의 HotelService / GetHotels 메서드와 매핑: 전체 호텔 목록 조회
  @GrpcMethod('HotelService', 'GetHotels')
  async getHotels() {
    const hotels = await this.hotelServiceService.getHotels();
    return { hotels };
  }

  // proto의 HotelService / GetHotel 메서드와 매핑: 단건 호텔 조회
  @GrpcMethod('HotelService', 'GetHotel')
  async getHotel(data: { hotelId: number }) {
    return this.hotelServiceService.getHotel(data.hotelId);
  }

  // proto의 HotelService / CreateRoom 메서드와 매핑: 신규 객실 등록 (관리자 전용, api-gateway에서 권한 검증)
  @GrpcMethod('HotelService', 'CreateRoom')
  async createRoom(data: {
    hotelId: number;
    name: string;
    capacity: number;
    description: string;
  }) {
    return this.roomService.createRoom(data);
  }

  // DB 연결 확인 엔드포인트 (GET /db-check)
  @Get('db-check')
  async checkDb() {
    return await this.hotelServiceService.testConnection();
  }
}

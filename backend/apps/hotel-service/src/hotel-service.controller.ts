import { Controller, Get } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { HotelServiceService } from './hotel-service.service';

@Controller()
export class HotelServiceController {
  constructor(private readonly hotelServiceService: HotelServiceService) {}

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

  // DB 연결 확인 엔드포인트 (GET /db-check)
  @Get('db-check')
  async checkDb() {
    return await this.hotelServiceService.testConnection();
  }
}

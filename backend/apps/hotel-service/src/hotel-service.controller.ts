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

  // DB 연결 확인 엔드포인트 (GET /db-check)
  @Get('db-check')
  async checkDb() {
    return await this.hotelServiceService.testConnection();
  }
}

import { Controller, Get } from '@nestjs/common';
import { HotelServiceService } from './hotel-service.service';

@Controller()
export class HotelServiceController {
  constructor(private readonly hotelServiceService: HotelServiceService) {}

  @Get()
  getHello(): string {
    return this.hotelServiceService.getHello();
  }

  // DB 연결 확인 엔드포인트 (GET /db-check)
  @Get('db-check')
  async checkDb() {
    return await this.hotelServiceService.testConnection();
  }
}

import { Controller, Get } from '@nestjs/common';
import { HotelServiceService } from './hotel-service.service';

@Controller()
export class HotelServiceController {
  constructor(private readonly hotelServiceService: HotelServiceService) {}

  @Get()
  getHello(): string {
    return this.hotelServiceService.getHello();
  }
}

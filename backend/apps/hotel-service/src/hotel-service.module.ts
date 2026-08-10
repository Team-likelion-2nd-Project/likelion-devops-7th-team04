import { Module } from '@nestjs/common';
import { HotelServiceController } from './hotel-service.controller';
import { HotelServiceService } from './hotel-service.service';

@Module({
  imports: [],
  controllers: [HotelServiceController],
  providers: [HotelServiceService],
})
export class HotelServiceModule {}

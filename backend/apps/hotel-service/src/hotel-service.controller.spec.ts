import { Test, TestingModule } from '@nestjs/testing';
import { HotelServiceController } from './hotel-service.controller';
import { HotelServiceService } from './hotel-service.service';

describe('HotelServiceController', () => {
  let hotelServiceController: HotelServiceController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [HotelServiceController],
      providers: [HotelServiceService],
    }).compile();

    hotelServiceController = app.get<HotelServiceController>(HotelServiceController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(hotelServiceController.getHello()).toBe('Hello World!');
    });
  });
});

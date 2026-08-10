import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions } from '@nestjs/microservices';
import { getGrpcOptions } from '@app/common';
import { HotelServiceModule } from './hotel-service.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    HotelServiceModule,
    getGrpcOptions('hotel', 'hotel.proto', '0.0.0.0:3002'),
  );
  await app.listen();
}
bootstrap();

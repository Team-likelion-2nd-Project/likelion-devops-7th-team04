import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions } from '@nestjs/microservices';
import { getGrpcOptions } from '@app/common';
import { BookingServiceModule } from './booking-service.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    BookingServiceModule,
    getGrpcOptions('booking', 'booking.proto', '0.0.0.0:3003'),
  );
  await app.listen();
}
bootstrap();

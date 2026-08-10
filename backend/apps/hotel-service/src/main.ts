import { NestFactory } from '@nestjs/core';
import { HotelServiceModule } from './hotel-service.module';

async function bootstrap() {
  const app = await NestFactory.create(HotelServiceModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();

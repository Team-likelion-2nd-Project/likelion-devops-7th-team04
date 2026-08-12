import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions } from '@nestjs/microservices';
import { getGrpcOptions } from '@app/common';
import { UserServiceModule } from './user-service.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    UserServiceModule,
    getGrpcOptions('user', 'user.proto', '0.0.0.0:3001'),
  );
  await app.listen();
}
bootstrap();

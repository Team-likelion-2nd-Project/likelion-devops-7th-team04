import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions } from '@nestjs/microservices';
import { getGrpcOptions } from '@app/common';
import { AuthServiceModule } from './auth-service.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AuthServiceModule,
    getGrpcOptions('auth', 'auth.proto', '0.0.0.0:3006'),
  );
  await app.listen();
}
bootstrap();

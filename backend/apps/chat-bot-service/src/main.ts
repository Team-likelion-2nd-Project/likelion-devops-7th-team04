import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions } from '@nestjs/microservices';
import { getGrpcOptions } from '@app/common';
import { ChatBotServiceModule } from './chat-bot-service.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    ChatBotServiceModule,
    getGrpcOptions('chatBot', 'chat-bot.proto', '0.0.0.0:3005'),
  );
  await app.listen();
}
bootstrap();

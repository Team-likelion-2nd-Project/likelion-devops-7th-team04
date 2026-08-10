import { NestFactory } from '@nestjs/core';
import { ChatBotServiceModule } from './chat-bot-service.module';

async function bootstrap() {
  const app = await NestFactory.create(ChatBotServiceModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();

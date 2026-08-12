import { Module } from '@nestjs/common';
import { ChatBotServiceController } from './chat-bot-service.controller';
import { ChatBotServiceService } from './chat-bot-service.service';

@Module({
  imports: [],
  controllers: [ChatBotServiceController],
  providers: [ChatBotServiceService],
})
export class ChatBotServiceModule {}

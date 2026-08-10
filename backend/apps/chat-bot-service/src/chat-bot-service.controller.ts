import { Controller, Get } from '@nestjs/common';
import { ChatBotServiceService } from './chat-bot-service.service';

@Controller()
export class ChatBotServiceController {
  constructor(private readonly chatBotServiceService: ChatBotServiceService) {}

  @Get()
  getHello(): string {
    return this.chatBotServiceService.getHello();
  }
}

import { Controller, Get } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { ChatBotServiceService } from './chat-bot-service.service';

@Controller()
export class ChatBotServiceController {
  constructor(private readonly chatBotServiceService: ChatBotServiceService) {}

  @GrpcMethod('ChatBotService', 'GetHello')
  getHello(): { message: string } {
    return { message: this.chatBotServiceService.getHello() };
  }
}

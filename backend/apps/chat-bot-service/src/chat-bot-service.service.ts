import { Injectable } from '@nestjs/common';

@Injectable()
export class ChatBotServiceService {
  getHello(): string {
    return 'Chat Bot Hello World!';
  }
}

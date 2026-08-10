import { Injectable } from '@nestjs/common';

@Injectable()
export class ChatBotServiceService {
  getHello(): string {
    return 'Hello World!';
  }
}

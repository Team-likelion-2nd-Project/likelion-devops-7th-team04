import { Controller, Get, Inject, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices'; 
import { Observable } from 'rxjs';

// proto의 BookingService 스펙과 1:1 대응되는 TS 인터페이스
interface ChatBotService {
  getHello(data: {}): Observable<{ message: string }>;
}

@Controller('api/chat-bots')
export class ChatBotController implements OnModuleInit {
  private chatBotService!: ChatBotService;

  constructor(
    @Inject('CHAT_BOT_SERVICE') private readonly client: ClientGrpc,
  ) {}

  // NestJS 생명주기: 모듈이 초기화될 때 gRPC 서비스 객체를 추출합니다.
  onModuleInit() {
    this.chatBotService = this.client.getService<ChatBotService>('ChatBotService');
  }

  /**
   * GET http://localhost:3000/api/chat-bot/hello
   * 브라우저/프론트엔드 HTTP 요청 수신 -> chat-bot-service gRPC 호출
   */
  @Get('hello')
  getHello(): Observable<{ message: string }> {
    return this.chatBotService.getHello({});
  }
}
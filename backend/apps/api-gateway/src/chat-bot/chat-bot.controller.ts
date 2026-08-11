import { Controller, Get, Inject, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { Observable } from 'rxjs';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ApiCommonResponses } from '@app/common/decorators/api-response.decorator';

// proto의 ChatBotService 스펙과 1:1 대응되는 TS 인터페이스
interface ChatBotService {
  getHello(data: {}): Observable<{ message: string }>;
}

@ApiTags('ChatBotService')
@ApiCommonResponses()
@Controller('api/chat-bots')
export class ChatBotController implements OnModuleInit {
  private chatBotService!: ChatBotService;

  constructor(
    @Inject('CHAT_BOT_SERVICE') private readonly client: ClientGrpc,
  ) {}

  // NestJS 생명주기: 모듈이 초기화될 때 gRPC 서비스 객체를 추출합니다.
  onModuleInit() {
    this.chatBotService =
      this.client.getService<ChatBotService>('ChatBotService');
  }

  /**
   * GET http://localhost:3000/api/chat-bot/hello
   * 브라우저/프론트엔드 HTTP 요청 수신 -> chat-bot-service gRPC 호출
   */
  @Get('hello')
  @ApiOperation({
    summary: '챗봇 도메인 서버 헬스체크',
    description:
      'gRPC를 통해 chat-bot-service 서버의 상태 및 Hello 메시지를 가져옵니다.',
  })
  @ApiResponse({
    status: 200,
    description: 'ChatBot Hello World! 출력',
  })
  getHello(): Observable<{ message: string }> {
    return this.chatBotService.getHello({});
  }
}

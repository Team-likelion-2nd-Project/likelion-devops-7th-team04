import { Test, TestingModule } from '@nestjs/testing';
import { ChatBotServiceController } from './chat-bot-service.controller';
import { ChatBotServiceService } from './chat-bot-service.service';

describe('ChatBotServiceController', () => {
  let chatBotServiceController: ChatBotServiceController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [ChatBotServiceController],
      providers: [ChatBotServiceService],
    }).compile();

    chatBotServiceController = app.get<ChatBotServiceController>(ChatBotServiceController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(chatBotServiceController.getHello()).toBe('Hello World!');
    });
  });
});

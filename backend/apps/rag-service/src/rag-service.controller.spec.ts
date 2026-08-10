import { Test, TestingModule } from '@nestjs/testing';
import { RagServiceController } from './rag-service.controller';
import { RagServiceService } from './rag-service.service';

describe('RagServiceController', () => {
  let ragServiceController: RagServiceController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [RagServiceController],
      providers: [RagServiceService],
    }).compile();

    ragServiceController = app.get<RagServiceController>(RagServiceController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(ragServiceController.getHello()).toBe('Hello World!');
    });
  });
});

import { Module } from '@nestjs/common';
import { RagServiceController } from './rag-service.controller';
import { RagServiceService } from './rag-service.service';

@Module({
  imports: [],
  controllers: [RagServiceController],
  providers: [RagServiceService],
})
export class RagServiceModule {}

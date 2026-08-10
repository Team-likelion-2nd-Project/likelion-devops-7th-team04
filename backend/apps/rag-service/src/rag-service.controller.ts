import { Controller, Get } from '@nestjs/common';
import { RagServiceService } from './rag-service.service';

@Controller()
export class RagServiceController {
  constructor(private readonly ragServiceService: RagServiceService) {}

  @Get()
  getHello(): string {
    return this.ragServiceService.getHello();
  }
}

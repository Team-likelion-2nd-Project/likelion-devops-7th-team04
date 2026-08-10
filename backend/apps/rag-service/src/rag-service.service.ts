import { Injectable } from '@nestjs/common';

@Injectable()
export class RagServiceService {
  getHello(): string {
    return 'Hello World!';
  }
}

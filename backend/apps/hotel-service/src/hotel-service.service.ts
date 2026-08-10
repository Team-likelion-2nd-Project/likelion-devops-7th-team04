import { Injectable } from '@nestjs/common';

@Injectable()
export class HotelServiceService {
  getHello(): string {
    return 'Hello World!';
  }
}

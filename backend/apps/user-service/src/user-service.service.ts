import { Injectable } from '@nestjs/common';

@Injectable()
export class UserServiceService {
  getHello(): string {
    return 'User Hello World!';
  }
}

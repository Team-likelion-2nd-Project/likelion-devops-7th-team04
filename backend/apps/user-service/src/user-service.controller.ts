import { Controller, Get } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { UserServiceService } from './user-service.service';

@Controller()
export class UserServiceController {
  constructor(private readonly userServiceService: UserServiceService) {}
  
  // proto의 UserService / GetHello 메서드와 매핑
  @GrpcMethod('UserService', 'GetHello')
  getHello(): { message: string } {
    return { message: this.userServiceService.getHello() };
  }
}

import { Module } from '@nestjs/common';
import { ClientsModule } from '@nestjs/microservices';
import { getGrpcOptions } from '@app/common';
import { UserController } from './user.controller';

@Module({
  imports: [
    // user-service gRPC 클라이언트 등록
    ClientsModule.register([
      {
        name: 'USER_SERVICE', // DI(의존성 주입)에 사용될 토큰 명
        ...getGrpcOptions(
          'user',       // user.proto의 package명
          'user.proto',  // proto 파일명
          process.env.USER_SERVICE_HOST || 'localhost:3001', // user-service gRPC 주소
        ),
      },
    ]),
  ],
  controllers: [UserController],
})
export class UserModule {}
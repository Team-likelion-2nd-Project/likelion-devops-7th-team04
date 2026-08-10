import { NestFactory } from '@nestjs/core';
import { UserServiceModule } from './user-service.module';

async function bootstrap() {
  const app = await NestFactory.create(UserServiceModule);
  // 1. 대문자 PORT 환경변수 사용 & user-service 기본 포트 지정 
  const port = process.env.PORT ?? 3001;

  // 2. 테스트를 위해 외부접속 허용
  await app.listen(port, '0.0.0.0');
}
bootstrap();

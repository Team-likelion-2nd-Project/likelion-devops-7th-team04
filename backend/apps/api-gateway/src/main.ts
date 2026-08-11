import { NestFactory } from '@nestjs/core';
import { ApiGatewayModule } from './api-gateway.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(ApiGatewayModule);
  
  app.enableCors({
    origin: 'http://localhost:5173',
  });

  const config = new DocumentBuilder()
    .setTitle('RAG 기반 챗봇 호텔 예약 웹서비스 API')
    .setDescription('API Gateway Swagger 문서입니다.')
    .setVersion('1.0')
    //.addBearerAuth() // JWT 토큰 인증 기능 (선택)
    .build();

  const document = SwaggerModule.createDocument(app, config);
  // http://localhost:3000/api-docs 로 접속하도록 설정
  SwaggerModule.setup('api-docs', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0');
}
bootstrap();

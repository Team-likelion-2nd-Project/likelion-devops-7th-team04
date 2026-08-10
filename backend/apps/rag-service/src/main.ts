import { NestFactory } from '@nestjs/core';
import { RagServiceModule } from './rag-service.module';

async function bootstrap() {
  const app = await NestFactory.create(RagServiceModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();

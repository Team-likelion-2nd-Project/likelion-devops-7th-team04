import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule } from '@nestjs/microservices';
import { JwtModule } from '@nestjs/jwt';
import { getGrpcOptions } from '@app/common';
import { AuthServiceController } from './auth-service.controller';
import { AuthServiceService } from './auth-service.service';
import { Credential } from './entities/credential.entity';

@Module({
  imports: [
    // 1. .env 환경변수 로드 설정
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // 2. TypeORM MariaDB 비동기 연결 설정
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'mariadb',
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 3306),
        username: configService.get<string>('DB_USERNAME', 'root'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_DATABASE'),
        // 🟢 nest-cli.json이 webpack: true로 번들링하므로, dist에는 개별 *.entity.js 파일이
        //    존재하지 않아 글롭(glob) 경로로는 엔티티를 찾지 못합니다. 클래스를 직접 등록합니다.
        entities: [Credential],
        synchronize: true, // ⚠️ 개발 환경(Dev)에서만 true 사용
        logging: true,     // SQL 실행 쿼리 로깅
      }),
    }),

    // 3. Credential 엔티티 리포지토리 등록
    TypeOrmModule.forFeature([Credential]),

    // 4. JwtModule은 옵션 없이 등록하고, sign() 호출 시마다 access/refresh용 secret과
    //    expiresIn을 각각 지정합니다 (AuthServiceService 참고).
    JwtModule.register({}),

    // 5. user-service gRPC 클라이언트 등록 (회원가입/로그인 시 프로필 생성·조회)
    ClientsModule.register([
      {
        name: 'USER_SERVICE',
        ...getGrpcOptions(
          'user',
          'user.proto',
          process.env.USER_SERVICE_HOST || 'localhost:3001',
        ),
      },
    ]),
  ],
  controllers: [AuthServiceController],
  providers: [AuthServiceService],
})
export class AuthServiceModule {}

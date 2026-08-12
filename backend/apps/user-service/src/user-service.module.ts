import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserServiceController } from './user-service.controller';
import { UserServiceService } from './user-service.service';
import { User } from './entities/user.entity';
import { DeletedUser } from './entities/deleted-user.entity';

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
        entities: [User, DeletedUser],
        synchronize: true, // ⚠️ 개발 환경(Dev)에서만 true 사용
        logging: true, // SQL 실행 쿼리 로깅
      }),
    }),

    // 3. User 엔티티 리포지토리 등록 (auth-service가 gRPC로 프로필 생성/조회 시 사용)
    // DeletedUser는 회원 탈퇴 트랜잭션에서 QueryRunner로 직접 다루므로 리포지토리 등록은 불필요합니다.
    TypeOrmModule.forFeature([User]),
  ],
  controllers: [UserServiceController],
  providers: [UserServiceService],
})
export class UserServiceModule {}

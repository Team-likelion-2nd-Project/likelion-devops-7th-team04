import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule } from '@nestjs/microservices';
import { getGrpcOptions } from '@app/common';
import { BookingServiceController } from './booking-service.controller';
import { BookingServiceService } from './booking-service.service';
import { Reservation } from './entities/reservation.entity';

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
        entities: [Reservation],
        synchronize: true, // ⚠️ 개발 환경(Dev)에서만 true 사용
        logging: true, // SQL 실행 쿼리 로깅
      }),
    }),

    // 3. 엔티티 리포지토리 등록
    TypeOrmModule.forFeature([Reservation]),

    // 4. hotel-service gRPC 클라이언트 등록 (예약 취소 시 예약 가능일 복구 요청)
    // 4. hotel-service gRPC 클라이언트 등록 (예약 생성 시 객실 예약 가능 여부 검증 및 가격 합산)
    ClientsModule.register([
      {
        name: 'HOTEL_SERVICE',
        ...getGrpcOptions(
          'hotel',
          'hotel.proto',
          process.env.HOTEL_SERVICE_HOST || 'localhost:3002',
        ),
      },
    ]),
  ],
  controllers: [BookingServiceController],
  providers: [BookingServiceService],
})
export class BookingServiceModule {}

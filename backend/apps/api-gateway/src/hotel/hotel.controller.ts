import { Controller, Get, Inject, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices'; 
import { Observable } from 'rxjs';

// proto의 HotelService 스펙과 1:1 대응되는 TS 인터페이스
interface HotelService {
  getHello(data: {}): Observable<{ message: string }>;
}

@Controller('api/hotels')
export class HotelController implements OnModuleInit {
  private hotelService!: HotelService;

  constructor(
    @Inject('HOTEL_SERVICE') private readonly client: ClientGrpc,
  ) {}

  // NestJS 생명주기: 모듈이 초기화될 때 gRPC 서비스 객체를 추출합니다.
  onModuleInit() {
    this.hotelService = this.client.getService<HotelService>('HotelService');
  }

  /**
   * GET http://localhost:3000/api/hotel/hello
   * 브라우저/프론트엔드 HTTP 요청 수신 -> user-service gRPC 호출
   */
  @Get('hello')
  getHello(): Observable<{ message: string }> {
    return this.hotelService.getHello({});
  }
}
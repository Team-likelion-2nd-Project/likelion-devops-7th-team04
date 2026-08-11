import {
  Controller,
  Get,
  Inject,
  NotFoundException,
  OnModuleInit,
  Param,
} from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { Observable, firstValueFrom } from 'rxjs';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { ApiCommonResponses } from '@app/common/decorators/api-response.decorator';

// proto의 Hotel 메시지와 1:1 대응되는 응답 형태
interface HotelDto {
  hotelId: number;
  name: string;
  address: string;
  phoneNumber: string;
  description: string;
}

// proto의 HotelService 스펙과 1:1 대응되는 TS 인터페이스
interface HotelService {
  getHello(data: {}): Observable<{ message: string }>;
  getHotels(data: {}): Observable<{ hotels: HotelDto[] }>;
  getHotel(data: { hotelId: number }): Observable<HotelDto>;
}

@ApiTags('HotelService')
@ApiCommonResponses()
@Controller('api/hotels')
export class HotelController implements OnModuleInit {
  private hotelService!: HotelService;

  constructor(@Inject('HOTEL_SERVICE') private readonly client: ClientGrpc) {}

  // NestJS 생명주기: 모듈이 초기화될 때 gRPC 서비스 객체를 추출합니다.
  onModuleInit() {
    this.hotelService = this.client.getService<HotelService>('HotelService');
  }

  /**
   * GET http://localhost:3000/api/hotel/hello
   * 브라우저/프론트엔드 HTTP 요청 수신 -> hotel-service gRPC 호출
   */
  @Get('hello')
  @ApiOperation({
    summary: '호텔 도메인 서버 헬스체크',
    description:
      'gRPC를 통해 hotel-service 서버의 상태 및 Hello 메시지를 가져옵니다.',
  })
  @ApiResponse({
    status: 200,
    description: 'Hotel Hello World! 출력',
  })
  getHello(): Observable<{ message: string }> {
    return this.hotelService.getHello({});
  }

  /**
   * GET http://localhost:3000/api/hotels
   * 브라우저/프론트엔드 HTTP 요청 수신 -> hotel-service gRPC 호출 -> 전체 호텔 목록 조회
   */
  @Get()
  @ApiOperation({
    summary: '모든 호텔 정보 조회',
    description:
      'gRPC를 통해 hotel-service에서 등록된 모든 호텔 목록을 조회합니다.',
  })
  @ApiResponse({ status: 200, description: '호텔 목록 조회 성공' })
  getHotels(): Observable<{ hotels: HotelDto[] }> {
    return this.hotelService.getHotels({});
  }

  /**
   * GET http://localhost:3000/api/hotels/{hotelId}
   * 브라우저/프론트엔드 HTTP 요청 수신 -> hotel-service gRPC 호출 -> 단건 호텔 조회
   */
  @Get(':hotelId')
  @ApiOperation({
    summary: '특정 호텔 정보 조회',
    description:
      '호텔 PK ID를 바탕으로 gRPC를 통해 hotel-service에서 호텔 상세 정보를 조회합니다.',
  })
  @ApiParam({ name: 'hotelId', description: '호텔 PK ID', example: '1' })
  @ApiResponse({ status: 200, description: '호텔 조회 성공' })
  @ApiResponse({ status: 404, description: '존재하지 않는 호텔' })
  async getHotel(@Param('hotelId') hotelId: string): Promise<HotelDto> {
    return firstValueFrom(
      this.hotelService.getHotel({ hotelId: Number(hotelId) }),
    ).catch((err) => {
      throw new NotFoundException(
        err?.details || err?.message || '존재하지 않는 호텔입니다.',
      );
    });
  }
}

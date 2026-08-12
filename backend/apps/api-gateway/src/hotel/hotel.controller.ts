import {
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  OnModuleInit,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { Observable, firstValueFrom } from 'rxjs';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ApiCommonResponses } from '@app/common/decorators/api-response.decorator';
import { JwtAuthGuard, RolesGuard, Roles } from '@app/common';
import { CreateRoomDto } from './dto/create-room.dto';

// proto의 Hotel 메시지와 1:1 대응되는 응답 형태
interface HotelDto {
  hotelId: number;
  name: string;
  address: string;
  phoneNumber: string;
  description: string;
}

// proto의 Room 메시지와 1:1 대응되는 응답 형태
interface RoomDto {
  roomId: number;
  hotelId: number;
  name: string;
  capacity: number;
  description: string;
}

// proto의 HotelService 스펙과 1:1 대응되는 TS 인터페이스
interface HotelService {
  getHello(data: {}): Observable<{ message: string }>;
  getHotels(data: {}): Observable<{ hotels: HotelDto[] }>;
  getHotel(data: { hotelId: number }): Observable<HotelDto>;
  getRooms(data: { hotelId: number }): Observable<{ rooms: RoomDto[] }>;
  getRoom(data: { hotelId: number; roomId: number }): Observable<RoomDto>;
  createRoom(data: {
    hotelId: number;
    name: string;
    capacity: number;
    description?: string;
  }): Observable<RoomDto>;
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

  /**
   * GET http://localhost:3000/api/hotels/{hotelId}/rooms
   * 브라우저/프론트엔드 HTTP 요청 수신 -> hotel-service gRPC 호출 -> 특정 호텔의 전체 객실 목록 조회
   */
  @Get(':hotelId/rooms')
  @ApiOperation({
    summary: '특정 호텔의 전체 객실 조회',
    description:
      '호텔 PK ID를 바탕으로 gRPC를 통해 hotel-service에서 해당 호텔에 등록된 모든 객실 목록을 조회합니다.',
  })
  @ApiParam({
    name: 'hotelId',
    description: '호텔 PK ID',
    type: Number,
    example: 1,
  })
  @ApiResponse({ status: 200, description: '객실 목록 조회 성공' })
  @ApiResponse({ status: 404, description: '존재하지 않는 호텔' })
  async getRooms(
    @Param('hotelId', ParseIntPipe) hotelId: number,
  ): Promise<{ rooms: RoomDto[] }> {
    return firstValueFrom(this.hotelService.getRooms({ hotelId })).catch(
      (err) => {
        throw new NotFoundException(
          err?.details || err?.message || '존재하지 않는 호텔입니다.',
        );
      },
    );
  }

  /**
   * GET http://localhost:3000/api/hotels/{hotelId}/rooms/{roomId}
   * 브라우저/프론트엔드 HTTP 요청 수신 -> hotel-service gRPC 호출 -> 단건 객실 조회
   */
  @Get(':hotelId/rooms/:roomId')
  @ApiOperation({
    summary: '특정 객실 조회',
    description:
      '호텔 PK ID와 객실 PK ID를 바탕으로 gRPC를 통해 hotel-service에서 객실 상세 정보를 조회합니다.',
  })
  @ApiParam({
    name: 'hotelId',
    description: '호텔 PK ID',
    type: Number,
    example: 1,
  })
  @ApiParam({
    name: 'roomId',
    description: '객실 PK ID',
    type: Number,
    example: 1,
  })
  @ApiResponse({ status: 200, description: '객실 조회 성공' })
  @ApiResponse({ status: 404, description: '존재하지 않는 객실' })
  async getRoom(
    @Param('hotelId', ParseIntPipe) hotelId: number,
    @Param('roomId', ParseIntPipe) roomId: number,
  ): Promise<RoomDto> {
    return firstValueFrom(this.hotelService.getRoom({ hotelId, roomId })).catch(
      (err) => {
        throw new NotFoundException(
          err?.details || err?.message || '존재하지 않는 객실입니다.',
        );
      },
    );
  }

  /**
   * POST http://localhost:3000/api/hotels/{hotelId}/rooms
   * 관리자 전용. 특정 호텔에 신규 객실을 등록합니다.
   */
  @Post(':hotelId/rooms')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiParam({
    name: 'hotelId',
    description: '호텔 PK ID',
    type: Number,
    example: 1,
  })
  @ApiOperation({
    summary: '신규 객실 등록 (관리자 전용)',
    description:
      '관리자 권한을 가진 사용자만 호출할 수 있습니다. gRPC를 통해 hotel-service에 신규 객실 정보를 등록합니다.',
  })
  @ApiResponse({ status: 201, description: '객실 등록 성공' })
  @ApiResponse({ status: 403, description: '관리자 권한이 없음' })
  @ApiResponse({ status: 404, description: '존재하지 않는 호텔' })
  async createRoom(
    @Param('hotelId', ParseIntPipe) hotelId: number,
    @Body() dto: CreateRoomDto,
  ): Promise<RoomDto> {
    return firstValueFrom(
      this.hotelService.createRoom({ hotelId, ...dto }),
    ).catch((err) => {
      throw new NotFoundException(
        err?.details || err?.message || '존재하지 않는 호텔입니다.',
      );
    });
  }
}

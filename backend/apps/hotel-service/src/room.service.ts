import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { RpcException } from '@nestjs/microservices';
import { Between, Repository } from 'typeorm';
import { Room } from './entities/room.entity';
import { Hotel } from './entities/hotel.entity';
import { RoomAvailability } from './entities/room-availability.entity';

// proto의 Room 메시지와 1:1 대응되는 응답 형태
export interface RoomGrpcResponse {
  roomId: number;
  hotelId: number;
  name: string;
  capacity: number;
  description: string;
}

// proto의 RoomAvailabilityResponse 메시지와 1:1 대응되는 응답 형태
export interface RoomAvailabilityGrpcResponse {
  hotelId: number;
  roomId: number;
  startDate: string;
  endDate: string;
  isAvailable: boolean;
  availabilities: { date: string; isAvailable: boolean; price: number }[];
}

@Injectable()
export class RoomService {
  constructor(
    @InjectRepository(Room) private readonly roomRepository: Repository<Room>,
    @InjectRepository(Hotel)
    private readonly hotelRepository: Repository<Hotel>,
    @InjectRepository(RoomAvailability)
    private readonly roomAvailabilityRepository: Repository<RoomAvailability>,
  ) {}

  // 신규 객실 등록. hotelId가 존재하지 않으면 RpcException.
  async createRoom(data: {
    hotelId: number;
    name: string;
    capacity: number;
    description?: string;
  }): Promise<RoomGrpcResponse> {
    const hotel = await this.hotelRepository.findOne({
      where: { hotelId: data.hotelId },
    });
    if (!hotel) {
      throw new RpcException('존재하지 않는 호텔입니다.');
    }

    const room = this.roomRepository.create({
      hotelId: data.hotelId,
      name: data.name,
      capacity: data.capacity,
      description: data.description,
    });
    const saved = await this.roomRepository.save(room);
    return this.toGrpcResponse(saved);
  }

  // 특정 호텔의 전체 객실 목록 조회. hotelId가 존재하지 않으면 RpcException.
  async getRoomsByHotel(hotelId: number): Promise<RoomGrpcResponse[]> {
    const hotel = await this.hotelRepository.findOne({
      where: { hotelId },
    });
    if (!hotel) {
      throw new RpcException('존재하지 않는 호텔입니다.');
    }

    const rooms = await this.roomRepository.find({ where: { hotelId } });
    return rooms.map((room) => this.toGrpcResponse(room));
  }

  // 단건 객실 조회. hotelId/roomId 조합이 존재하지 않으면 RpcException.
  async getRoomById(
    hotelId: number,
    roomId: number,
  ): Promise<RoomGrpcResponse> {
    const room = await this.roomRepository.findOne({
      where: { hotelId, roomId },
    });
    if (!room) {
      throw new RpcException('존재하지 않는 객실입니다.');
    }
    return this.toGrpcResponse(room);
  }

  // 기존 객실 정보 수정. hotelId/roomId 조합이 존재하지 않으면 RpcException.
  async updateRoom(
    hotelId: number,
    roomId: number,
    data: { name: string; capacity: number; description?: string },
  ): Promise<RoomGrpcResponse> {
    const room = await this.roomRepository.findOne({
      where: { hotelId, roomId },
    });
    if (!room) {
      throw new RpcException('존재하지 않는 객실입니다.');
    }

    room.name = data.name;
    room.capacity = data.capacity;
    room.description = data.description;
    const saved = await this.roomRepository.save(room);
    return this.toGrpcResponse(saved);
  }

  // 특정 기간 예약 가능 여부 조회. hotelId/roomId 조합이 존재하지 않으면 RpcException.
  // 구간(startDate~endDate, 둘 다 포함) 전체에 대해 room_availabilities 행이 하루도 빠짐없이
  // 존재하고 전부 isAvailable=true일 때만 overall isAvailable을 true로 판단한다.
  async getRoomAvailability(
    hotelId: number,
    roomId: number,
    startDate: string,
    endDate: string,
  ): Promise<RoomAvailabilityGrpcResponse> {
    const room = await this.roomRepository.findOne({
      where: { hotelId, roomId },
    });
    if (!room) {
      throw new RpcException('존재하지 않는 객실입니다.');
    }

    const rows = await this.roomAvailabilityRepository.find({
      where: { roomId, date: Between(startDate, endDate) },
      order: { date: 'ASC' },
    });

    const dayMs = 24 * 60 * 60 * 1000;
    const totalDays =
      Math.round(
        (new Date(endDate).getTime() - new Date(startDate).getTime()) / dayMs,
      ) + 1;
    const isAvailable =
      rows.length === totalDays && rows.every((row) => row.isAvailable);

    return {
      hotelId,
      roomId,
      startDate,
      endDate,
      isAvailable,
      availabilities: rows.map((row) => ({
        date: row.date,
        isAvailable: row.isAvailable,
        price: row.price,
      })),
    };
  }

  private toGrpcResponse(room: Room): RoomGrpcResponse {
    return {
      roomId: room.roomId,
      hotelId: room.hotelId,
      name: room.name,
      capacity: room.capacity,
      description: room.description ?? '',
    };
  }
}

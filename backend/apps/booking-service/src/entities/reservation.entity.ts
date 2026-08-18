import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ReservationStatus {
  RESERVED = 'RESERVED', // 예약 확정 (기본값)
  CANCELLED = 'CANCELLED', // 예약 취소
  COMPLETED = 'COMPLETED', // 체크아웃 완료
}

// 서비스 간 DB가 분리되어 있으므로 userId/roomId는 @ManyToOne 관계가 아니라
// 순수 정수 컬럼으로만 저장한다 (hotel-service의 Room.hotelId와 동일한 원칙).
@Entity('reservations')
export class Reservation {
  @PrimaryGeneratedColumn()
  reservationId!: number;

  @Column({ name: 'user_id' })
  userId!: number;

  @Column({ name: 'room_id' })
  roomId!: number;

  @Column({ name: 'check_in_date', type: 'date' })
  checkInDate!: string;

  @Column({ name: 'check_out_date', type: 'date' })
  checkOutDate!: string;

  @Column({ name: 'guest_count' })
  guestCount!: number;

  @Column({ name: 'has_indoor_pool', default: false })
  hasIndoorPool!: boolean;

  @Column({ name: 'has_lounge', default: false })
  hasLounge!: boolean;

  @Column({ name: 'total_amount' })
  totalAmount!: number;

  @Column({
    type: 'enum',
    enum: ReservationStatus,
    default: ReservationStatus.RESERVED,
  })
  status!: ReservationStatus;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

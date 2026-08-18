import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

// 서비스 간 DB가 분리되어 있으므로 facilityId는 @ManyToOne 관계가 아니라 순수 정수 컬럼으로만
// 저장한다 (hotel-service의 Room.hotelId와 동일한 원칙).
@Entity('reservation_facilities')
export class ReservationFacility {
  @PrimaryGeneratedColumn()
  reservationFacilityId!: number;

  @Column({ name: 'reservation_id' })
  reservationId!: number;

  // references hotel-service's Facility.facilityId (no FK constraint)
  @Column({ name: 'facility_id' })
  facilityId!: number;

  @Column({ name: 'guest_count' })
  guestCount!: number;

  @Column({ name: 'total_amount' })
  totalAmount!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

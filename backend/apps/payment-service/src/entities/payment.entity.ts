import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum PaymentStatus {
  PAID = 'paid',
  REFUNDED = 'refunded',
}

// 서비스 간 DB가 분리되어 있으므로 reservationId/userId는 @ManyToOne 관계가 아니라 순수 정수
// 컬럼으로만 저장한다 (booking-service의 Reservation.roomId와 동일한 원칙).
@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn()
  paymentId!: number;

  @Column({ name: 'reservation_id' })
  reservationId!: number;

  // 결제 소유자. booking-service를 거치지 않고도 /me, /{userId} 조회를 처리할 수 있도록
  // 결제 생성 시점(requestPayment) / 웹훅 구제 시점에 booking-service에서 조회한 값을 저장해둔다.
  @Column({ name: 'user_id' })
  userId!: number;

  @Column({ name: 'approval_number' })
  approvalNumber!: string;

  @Column({ name: 'amount' })
  amount!: number;

  @Column({ name: 'payment_method' })
  paymentMethod!: string;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PAID })
  status!: PaymentStatus;

  @Column({ name: 'paid_at', type: 'datetime' })
  paidAt!: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

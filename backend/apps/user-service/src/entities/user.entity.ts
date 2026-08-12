import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE', // 탈퇴 처리된 상태. 이 상태가 되면 DeletedUser로 옮기고 이 테이블에서는 제거합니다.
}

// 회원 프로필 정보만 소유합니다. 비밀번호 등 자격증명은 auth-service의 Credential이 별도로 소유합니다.
// 순수 TypeORM 도메인 모델로 유지합니다. Swagger 문서화는 api-gateway의 컨트롤러/DTO에서 담당합니다.
@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  email!: string;

  @Column()
  name!: string;

  @Column({ name: 'phone_number' })
  phoneNumber!: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role!: UserRole;

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.ACTIVE })
  status!: UserStatus;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

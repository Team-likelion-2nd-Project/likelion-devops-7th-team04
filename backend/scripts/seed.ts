import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Admin } from '../apps/user-service/src/admin/entities/admin.entity';
import { AdminCredential } from '../apps/auth-service/src/entities/admin-credential.entity';
import { Hotel } from '../apps/hotel-service/src/entities/hotel.entity';
import { Room } from '../apps/hotel-service/src/entities/room.entity';

// docker compose 기동 시(db-seed 서비스, scripts/Dockerfile.seed) 1회 실행되는 시딩 스크립트입니다.
// NestFactory 대신 TypeORM DataSource를 직접 열어 admins/admin_credentials/hotels/rooms에
// 필요한 초기 데이터를 넣습니다 — hotel-service에는 CreateHotel API가, auth-service에는
// 관리자 자격증명을 만드는 API가 아직 없어서(테스트 편의를 위한 시딩 목적상) 직접 DB에
// insert하는 방식을 택했습니다. 기존 서비스가 소유한 엔티티 클래스를 그대로 재사용합니다.
// 매번 재실행해도 안전하도록(멱등) 이미 존재하면 건너뜁니다.

const DB_HOST = process.env.DB_HOST ?? 'localhost';
const DB_PORT = Number(process.env.DB_PORT ?? 3306);
const DB_USERNAME = process.env.DB_USERNAME ?? 'root';
const DB_PASSWORD = process.env.DB_PASSWORD;
const DB_DATABASE = process.env.DB_DATABASE;

// admin_credentials 해시 방식은 auth-service.service.ts의 SALT_ROUNDS와 동일하게 맞춥니다.
const SALT_ROUNDS = 10;

const SEED_ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL;
const SEED_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD;
const SEED_ADMIN_NAME = process.env.SEED_ADMIN_NAME ?? '관리자';

interface HotelSeed {
  hotel: Pick<Hotel, 'name' | 'address' | 'phoneNumber' | 'description'>;
  room: Pick<Room, 'name' | 'capacity' | 'description'>;
}

// hotelId가 1/2/3 순서로 생성되도록(빈 테이블 기준 auto_increment) 배열 순서를 유지합니다.
// frontend/src/data/hotels.ts의 하드코딩 배열(서울점=1, 부산점=2, 제주점=3)과 맞물립니다.
const HOTEL_SEEDS: HotelSeed[] = [
  {
    hotel: {
      name: '서울점',
      address: '서울 강남구 테헤란로 123',
      phoneNumber: '02-1234-5678',
      description: '도심 속에서 누리는 조용한 휴식',
    },
    room: {
      name: '디럭스 더블룸',
      capacity: 2,
      description: '시티뷰를 갖춘 넓은 더블룸입니다.',
    },
  },
  {
    hotel: {
      name: '부산점',
      address: '부산 해운대구 해운대해변로 264',
      phoneNumber: '051-1234-5678',
      description: '오션뷰와 함께하는 여유로운 시간',
    },
    room: {
      name: '오션뷰 스위트룸',
      capacity: 2,
      description: '탁 트인 오션뷰를 자랑하는 스위트룸입니다.',
    },
  },
  {
    hotel: {
      name: '제주점',
      address: '제주 서귀포시 중문관광로72번길 100',
      phoneNumber: '064-1234-5678',
      description: '자연 속 프라이빗한 힐링 스테이',
    },
    room: {
      name: '가든뷰 트윈룸',
      capacity: 2,
      description: '아늑한 정원 전망의 트윈룸입니다.',
    },
  },
];

// mariadb 컨테이너가 healthy해도, 접속 직후 잠깐 연결이 튈 수 있어 짧게 재시도합니다.
async function createDataSourceWithRetry(
  maxAttempts = 5,
  delayMs = 2000,
): Promise<DataSource> {
  const dataSource = new DataSource({
    type: 'mariadb',
    host: DB_HOST,
    port: DB_PORT,
    username: DB_USERNAME,
    password: DB_PASSWORD,
    database: DB_DATABASE,
    entities: [Admin, AdminCredential, Hotel, Room],
    synchronize: true, // ⚠️ 개발 환경(Dev)에서만 사용 — 기존 서비스 모듈들과 동일한 패턴
  });

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await dataSource.initialize();
      return dataSource;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(
        `[seed] DB 연결 실패 (${attempt}/${maxAttempts}): ${message}`,
      );
      if (attempt === maxAttempts) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw new Error('unreachable');
}

async function seedAdmin(dataSource: DataSource): Promise<void> {
  if (!SEED_ADMIN_EMAIL || !SEED_ADMIN_PASSWORD) {
    console.warn(
      '[seed] SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD가 설정되지 않아 관리자 계정 시딩을 건너뜁니다.',
    );
    return;
  }

  const adminRepository = dataSource.getRepository(Admin);
  const credentialRepository = dataSource.getRepository(AdminCredential);

  const existing = await adminRepository.findOne({
    where: { email: SEED_ADMIN_EMAIL },
  });
  if (existing) {
    console.log(
      `[seed] 관리자 계정이 이미 존재합니다 (${SEED_ADMIN_EMAIL}) — 건너뜁니다.`,
    );
    return;
  }

  const admin = await adminRepository.save(
    adminRepository.create({ email: SEED_ADMIN_EMAIL, name: SEED_ADMIN_NAME }),
  );
  const passwordHash = await bcrypt.hash(SEED_ADMIN_PASSWORD, SALT_ROUNDS);
  await credentialRepository.save(
    credentialRepository.create({ adminId: admin.id, passwordHash }),
  );

  console.log(`[seed] 관리자 계정 생성 완료: ${SEED_ADMIN_EMAIL}`);
}

async function seedHotelsAndRooms(dataSource: DataSource): Promise<void> {
  const hotelRepository = dataSource.getRepository(Hotel);
  const roomRepository = dataSource.getRepository(Room);

  const hotelCount = await hotelRepository.count();
  if (hotelCount > 0) {
    console.log(
      '[seed] 호텔 데이터가 이미 존재합니다 — 호텔/객실 시딩을 건너뜁니다.',
    );
    return;
  }

  for (const seed of HOTEL_SEEDS) {
    const hotel = await hotelRepository.save(
      hotelRepository.create(seed.hotel),
    );
    await roomRepository.save(
      roomRepository.create({ hotelId: hotel.hotelId, ...seed.room }),
    );
    console.log(
      `[seed] 호텔/객실 생성 완료: ${seed.hotel.name} (hotelId=${hotel.hotelId})`,
    );
  }
}

async function main(): Promise<void> {
  const dataSource = await createDataSourceWithRetry();
  try {
    await seedAdmin(dataSource);
    await seedHotelsAndRooms(dataSource);
    console.log('[seed] 시딩 완료');
  } finally {
    await dataSource.destroy();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[seed] 시딩 실패:', err);
    process.exit(1);
  });

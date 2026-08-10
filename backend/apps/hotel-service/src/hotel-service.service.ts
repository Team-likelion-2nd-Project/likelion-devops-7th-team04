import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class HotelServiceService {
  private readonly logger = new Logger(HotelServiceService.name);
  
    // TypeORM의 DataSource를 주입받음
    constructor(private readonly dataSource: DataSource) {}
  
    // 서비스 모듈이 로드될 때 DB 연결 상태 자동 점검
    async onModuleInit() {
      try {
        if (this.dataSource.isInitialized) {
          this.logger.log('✅ MariaDB 데이터베이스 연결 성공!');
        } else {
          this.logger.error('❌ MariaDB 데이터베이스가 초기화되지 않았습니다.');
        }
      } catch (error) {
        this.logger.error('❌ MariaDB 데이터베이스 연결 오류:', error);
      }
    }
  
    getHello(): string {
      return 'Hotel Hello World!';
    }
    
    async testConnection(): Promise<string> {
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
  
      try {
        // MariaDB 버전 조회 쿼리 실행
        const result = await queryRunner.query('SELECT VERSION() AS version');
        return `DB Connection OK! MariaDB Version: ${result[0].version}`;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return `DB Connection Failed: ${errorMessage}`;
      } finally {
        await queryRunner.release();
      }
    }
}

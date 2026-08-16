import { IsBoolean, IsDateString, IsInt, IsOptional, Min } from 'class-validator';

export class CreateBookingDto {
  /**
   * 예약할 객실 PK ID
   * @example 1
   */
  @IsInt()
  @Min(1)
  roomId: number;

  /**
   * 체크인 날짜 (해당 날짜부터 숙박)
   * @example "2026-08-16"
   */
  @IsDateString()
  checkInDate: string;

  /**
   * 체크아웃 날짜 (이 날짜 전날까지 숙박, 체크인 날짜보다 이후여야 함)
   * @example "2026-08-20"
   */
  @IsDateString()
  checkOutDate: string;

  /**
   * 실내 수영장 이용 옵션 추가 여부
   * @example false
   */
  @IsOptional()
  @IsBoolean()
  hasIndoorPool?: boolean;

  /**
   * 라운지 이용 옵션 추가 여부
   * @example false
   */
  @IsOptional()
  @IsBoolean()
  hasLounge?: boolean;
}

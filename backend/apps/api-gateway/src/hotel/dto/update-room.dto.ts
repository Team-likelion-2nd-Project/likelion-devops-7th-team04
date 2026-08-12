import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateRoomDto {
  /**
   * 객실명
   * @example "디럭스 더블룸"
   */
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  /**
   * 최대 인원
   * @example 2
   */
  @IsInt()
  @Min(1)
  capacity: number;

  /**
   * 객실 설명
   * @example "시티뷰를 갖춘 넓은 더블룸입니다."
   */
  @IsOptional()
  @IsString()
  description?: string;
}

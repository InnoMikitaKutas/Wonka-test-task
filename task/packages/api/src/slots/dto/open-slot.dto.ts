import { IsISO8601, IsNotEmpty, IsString } from 'class-validator';

export class OpenSlotDto {
  @IsString()
  @IsNotEmpty()
  interviewer!: string;

  @IsISO8601()
  startsAt!: string;
}

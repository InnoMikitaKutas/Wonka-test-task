import { IsNotEmpty, IsString } from 'class-validator';

export class ScheduleInterviewDto {
  @IsString()
  @IsNotEmpty()
  candidateId!: string;
}

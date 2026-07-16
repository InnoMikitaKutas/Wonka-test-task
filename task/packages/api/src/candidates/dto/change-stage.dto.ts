import { IsInt, Max, Min } from 'class-validator';

// Stage indexes are 1-based, see docs/adr/0003.
export class ChangeStageDto {
  @IsInt()
  @Min(1)
  @Max(5)
  toStage!: number;
}

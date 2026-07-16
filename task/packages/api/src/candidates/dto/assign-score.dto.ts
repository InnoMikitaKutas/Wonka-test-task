import { IsNotEmpty, IsString, Matches } from 'class-validator';

// Scores are decimal strings with exactly two digits after the point,
// for example "87.50". See docs/adr/0003.
export class AssignScoreDto {
  @IsString()
  @Matches(/^\d{1,3}\.\d{2}$/)
  score!: string;

  @IsString()
  @IsNotEmpty()
  assessor!: string;
}

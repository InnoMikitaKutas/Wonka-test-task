import { IsNotEmpty, IsString } from 'class-validator';

export class CreateCandidateDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  position!: string;

  @IsString()
  @IsNotEmpty()
  source!: string;
}

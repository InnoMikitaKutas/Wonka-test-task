import { IsNotEmpty, IsString } from 'class-validator';

export class ExtendOfferDto {
  @IsString()
  @IsNotEmpty()
  note!: string;
}

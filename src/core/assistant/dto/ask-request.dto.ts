import { IsNotEmpty, IsString } from 'class-validator';

export class AskRequest {
  @IsString()
  @IsNotEmpty()
  text: string;
}

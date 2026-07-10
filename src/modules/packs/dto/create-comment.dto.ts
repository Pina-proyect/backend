import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateCommentDto {
  @IsNotEmpty({ message: 'El comentario no puede estar vacío' })
  @IsString()
  @MaxLength(500, { message: 'El comentario no puede exceder 500 caracteres' })
  content: string;
}

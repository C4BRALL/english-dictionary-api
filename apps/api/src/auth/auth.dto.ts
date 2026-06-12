import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length } from 'class-validator';

export class SignUpDto {
  @ApiProperty({ example: 'User 1' })
  @IsString()
  @Length(2, 100)
  name!: string;

  @ApiProperty({ example: 'example@email.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'password123', minLength: 8 })
  @IsString()
  @Length(8, 128)
  password!: string;
}

export class SignInDto {
  @ApiProperty({ example: 'example@email.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  password!: string;
}

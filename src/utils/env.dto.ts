import { IsInt, IsNotEmpty, IsNumber, IsPositive, IsString, IsUrl, Max, Min } from 'class-validator';

export class EnvironmentVariables {
  @IsString()
  @IsNotEmpty()
  readonly NODE_ENV: string;

  @IsString()
  @IsNotEmpty()
  readonly TRANSPORT_URL: string;

  @IsInt()
  @Min(0)
  @Max(65535)
  readonly HTTP_PORT: number;

  @IsUrl({}, { message: 'FRONTEND_URL must be a valid URL' })
  @IsNotEmpty()
  readonly FRONTEND_URL: string;

  @IsNumber()
  @IsNotEmpty()
  @IsPositive()
  readonly EMAIL_TOKEN_TTL: number;

  @IsNumber()
  @IsNotEmpty()
  @IsPositive()
  readonly PASSWORD_RESET_TOKEN_TTL: number;

  @IsUrl(
    { protocols: ['postgres', 'postgresql'], require_tld: false, require_protocol: true },
    { message: 'DATABASE_URL must be a valid Postgres URL' },
  )
  @IsNotEmpty()
  readonly DATABASE_URL: string;

  @IsString()
  @IsNotEmpty()
  readonly JWT_ACCESS_SECRET: string;

  @IsString()
  @IsNotEmpty()
  readonly JWT_REFRESH_SECRET: string;

  @IsNumber()
  @IsNotEmpty()
  @IsPositive()
  readonly JWT_ACCESS_EXPIRATION: number;

  @IsNumber()
  @IsNotEmpty()
  @IsPositive()
  readonly JWT_REFRESH_EXPIRATION: number;

  @IsString()
  @IsNotEmpty()
  readonly REDIS_HOST: string;

  @IsInt()
  @Min(0)
  @Max(65535)
  readonly REDIS_PORT: number;

  @IsInt()
  @Min(0)
  @Max(15)
  readonly REDIS_DB: number;

  @IsUrl({ protocols: ['amqp', 'amqps'], require_tld: false }, { message: 'RABBITMQ_URL must be a valid AMQP URL' })
  @IsNotEmpty()
  readonly RABBITMQ_URL: string;

  @IsString()
  @IsNotEmpty()
  readonly RABBITMQ_QUEUE: string;
}

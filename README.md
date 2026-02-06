# User Microservice

![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=flat&logo=nestjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat&logo=docker&logoColor=white)
![gRPC](https://img.shields.io/badge/gRPC-244C5A?style=flat&logo=google&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat&logo=postgresql&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=flat&logo=prisma&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=flat&logo=redis&logoColor=white)
![RabbitMQ](https://img.shields.io/badge/RabbitMQ-FF6600?style=flat&logo=rabbitmq&logoColor=white)
![JWT](https://img.shields.io/badge/JWT-000000?style=flat&logo=jsonwebtokens&logoColor=white)
![Prometheus](https://img.shields.io/badge/Prometheus-E6522C?style=flat&logo=prometheus&logoColor=white)
![OpenTelemetry](https://img.shields.io/badge/OpenTelemetry-7B61FF?style=flat&logo=opentelemetry&logoColor=white)
![Jest](https://img.shields.io/badge/Jest-C21325?style=flat&logo=jest&logoColor=white)
![ESLint](https://img.shields.io/badge/ESLint-4B32C3?style=flat&logo=eslint&logoColor=white)
![Prettier](https://img.shields.io/badge/Prettier-F7B93E?style=flat&logo=prettier&logoColor=black)

A NestJS-based microservice for user management and authentication, part of the CoffeeDoor microservices architecture.

## Overview

This microservice handles all user-related operations including authentication, user management, and authorization. It exposes gRPC endpoints for inter-service communication and provides comprehensive user lifecycle management.

## Tech Stack

- **Framework**: NestJS 11
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Transport**: gRPC (Google Remote Procedure Call)
- **Caching**: Redis (ioredis)
- **Message Broker**: RabbitMQ (AMQP)
- **Authentication**: JWT (Access & Refresh Tokens)
- **Password Hashing**: bcryptjs
- **Observability**: OpenTelemetry (Tracing), Prometheus (Metrics)

## Features

### Authentication Service (`AuthService`)
- User registration with email verification
- User sign-in with JWT token generation
- Email verification flow
- Password reset functionality
- Token refresh mechanism
- Resend confirmation/reset emails

### User Service (`UserService`)
- Get user by ID
- Update user profile (name, phone, avatar)
- Delete user account
- Password confirmation and change
- **Admin Operations**:
  - Get all users (paginated)
  - Ban/Unban users with reason tracking
  - Get banned users list
  - Get ban history by user ID
  - Change user roles

### Health Check Service (`HealthCheckService`)
- Application health status
- Database connectivity check

## Database Schema

### Models

**User**
- `id` - UUID primary key
- `name` - Optional display name
- `email` - Unique email address
- `phoneNumber` - Optional phone number
- `role` - User role (USER, ADMIN, MODERATOR, VISITOR)
- `avatarUrl` - Optional profile picture URL
- `passwordHash` - Hashed password
- `isEmailVerified` - Email verification status
- `lastLoginAt` - Last login timestamp
- `isBanned` - Ban status
- `createdAt` / `updatedAt` - Timestamps

**EmailVerificationToken**
- Linked to User
- Token with expiration
- Tracks verification status

**PasswordResetToken**
- Linked to User
- Token with expiration
- Tracks password change history

**BanDetails**
- Linked to User
- Tracks ban/unban actions
- Includes reason and duration

## gRPC Services

### Auth Service (`auth.v1`)
```protobuf
service AuthService {
  rpc SignUp(SignUpRequest) returns (User)
  rpc SignIn(SignInRequest) returns (AuthResponse)
  rpc VerifyEmail(Token) returns (AuthResponse)
  rpc ResendConfirmationEmail(Email) returns (StatusResponse)
  rpc RefreshTokens(Token) returns (RefreshTokensResponse)
  rpc InitResetPassword(Email) returns (StatusResponse)
  rpc ResendResetPasswordEmail(Email) returns (StatusResponse)
  rpc SetNewPassword(SetNewPasswordRequest) returns (StatusResponse)
}
```

### User Service (`user.v1`)
```protobuf
service UserService {
  // User operations
  rpc GetUserById(Id) returns (User)
  rpc UpdateUser(UpdateUserRequest) returns (User)
  rpc DeleteUser(Id) returns (StatusResponse)
  rpc ConfirmPassword(PasswordRequest) returns (StatusResponse)
  rpc ChangePassword(PasswordRequest) returns (StatusResponse)

  // Admin operations
  rpc GetAllUsers(AllUsersRequest) returns (AllUsersResponse)
  rpc BanUser(BanUserRequest) returns (User)
  rpc UnbanUser(BanUserRequest) returns (User)
  rpc GetBannedUsers(Empty) returns (GetBannedUsersResponse)
  rpc GetBanDetailsByUserId(Id) returns (BanDetailsResponse)
  rpc ChangeUserRole(UserRoleRequest) returns (User)
}
```

### Health Check Service (`health_check.v1`)
```protobuf
service HealthCheckService {
  rpc CheckAppHealth(Empty) returns (HealthCheckResponse)
  rpc CheckDatabaseConnection(Empty) returns (HealthCheckResponse)
}
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NODE_ENV` | Environment (development/production) |
| `TRANSPORT_URL` | gRPC server URL (e.g., `0.0.0.0:50051`) |
| `HTTP_PORT` | HTTP port for metrics endpoint |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | Secret for access token signing |
| `JWT_REFRESH_SECRET` | Secret for refresh token signing |
| `JWT_ACCESS_EXPIRATION` | Access token expiration (seconds) |
| `JWT_REFRESH_EXPIRATION` | Refresh token expiration (seconds) |
| `REDIS_HOST` | Redis server host |
| `REDIS_PORT` | Redis server port |
| `RABBITMQ_URL` | RabbitMQ connection URL |
| `RABBITMQ_QUEUE` | RabbitMQ queue name |

## Project Setup

```bash
# Install dependencies
npm install

# Generate Prisma client
npm run db:generate

# Push database schema
npm run db:push

# Run migrations
npm run db:migrate
```

## Running the Service

```bash
# Development mode
npm run start:dev

# Debug mode
npm run start:debug

# Production mode
npm run build
npm run start:prod
```

## Database Commands

```bash
# Generate Prisma client
npm run db:generate

# Push schema changes to database
npm run db:push

# Run migrations
npm run db:migrate

# Open Prisma Studio (database GUI)
npm run prisma:studio
```

## Testing

```bash
# Unit tests
npm run test

# Watch mode
npm run test:watch

# Test coverage
npm run test:cov

# E2E tests
npm run test:e2e
```

## Code Quality

```bash
# Lint and fix
npm run lint

# Format code
npm run format
```

## Project Structure

```
user-microservice/
├── proto/                    # Protocol buffer definitions
│   ├── auth.proto
│   ├── user.proto
│   └── health-check.proto
├── prisma/
│   ├── schema.prisma        # Database schema
│   └── generated-types/     # Generated Prisma types
├── src/
│   ├── auth/                # Authentication module
│   ├── user/                # User management module
│   ├── health-check/        # Health check module
│   ├── hash/                # Password hashing service
│   ├── token/               # JWT token service
│   ├── redis/               # Redis caching service
│   ├── prisma/              # Database service
│   ├── transport/
│   │   └── message-broker/  # RabbitMQ integration
│   ├── supervision/
│   │   ├── metrics/         # Prometheus metrics
│   │   └── tracing/         # OpenTelemetry tracing
│   ├── utils/               # Utilities and filters
│   ├── generated-types/     # Generated proto types
│   ├── app.module.ts
│   └── main.ts
└── test/                    # E2E tests
```

## Generating Proto Types

```bash
# Generate TypeScript types from proto files
protoc -I ./proto ./proto/auth.proto --ts_proto_out=./src/generated-types \
  --ts_proto_opt=nestJs=true \
  --ts_proto_opt=useNullAsOptional=true \
  --ts_proto_opt=useDate=true

protoc -I ./proto ./proto/user.proto --ts_proto_out=./src/generated-types \
  --ts_proto_opt=nestJs=true \
  --ts_proto_opt=useNullAsOptional=true \
  --ts_proto_opt=useDate=true

protoc -I ./proto ./proto/health-check.proto --ts_proto_out=./src/generated-types \
  --ts_proto_opt=nestJs=true
```

## Security Features

- Password hashing with bcryptjs
- JWT-based authentication with access/refresh token rotation
- Refresh token stored as hash in Redis
- Email verification required for sign-in
- Token expiration and invalidation
- Ban system with detailed tracking

## License

UNLICENSED - Private project

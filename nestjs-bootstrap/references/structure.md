# Structure

## Layout

```
src/
  main.ts                     bootstrap only
  app.module.ts               root wiring
  common/
    config/                   env -> typed config, validated at boot
    constants/                i18n keys, salt rounds, TTLs
    exceptions/               AppException + domain exceptions
    filters/                  REST response + logging
    interceptors/             Prisma error mapping
    pagination/               PaginationArgs + Paginated() factory
    pipes/                    validation -> field-level errors
    health/                   GET /health
  core/
    gql/                      GraphQL config + error formatter
    jwt/                      JwtModule.registerAsync (global)
    redis/                    ConfigurableModuleBuilder + ioredis
  prisma/                     global PrismaModule + PrismaService
  guards/                     cross-cutting guards (GraphQL throttler)
  modules/<domain>/           feature modules (added later)
prisma/
  schema.prisma               generator + datasource
  models/*.prisma             one file per model group
  migrations/                 append-only
  seed.ts                     idempotent seed entrypoint
```

## Dependency direction

```
common  ←  core  ←  modules  ←  app.module/main
```

- `common/**` imports nothing from `core/**` or `modules/**`.
- `core/**` imports `common/**` and framework packages only.
- `modules/**` may import `common/**`, `core/**`, and services from other
  modules — never resolvers.
- Resolvers never touch Prisma; services never read `process.env`.
- Config is read only through `ConfigService<AppConfig>`.

## Naming

| Thing | Convention | Example |
|---|---|---|
| files | kebab-case, no spaces | `prisma-error.interceptor.ts` |
| classes | PascalCase, suffix by role | `PrismaService`, `CreateUserInput` |
| GraphQL types | singular entity name | `User`, `PaginatedUser` |
| Prisma tables | snake_case plural via `@@map` | `users`, `user_sessions` |
| env vars | SCREAMING_SNAKE | `DATABASE_URL` |
| migrations | verb-first snake_case | `add_user_sessions` |

## Boot chain

```
main.ts
 └─ AppModule
    ├─ ConfigModule.forRoot({ isGlobal, cache, load: [server, database, graphql, jwt, redis] })
    ├─ ThrottlerModule.forRoot([{ ttl: 5m, limit: 50 }])
    ├─ CoreModule (GraphQL + JWT + Redis)
    ├─ PrismaModule (@Global)
    └─ controllers: [HealthController]
       providers:  APP_GUARD GqlThrottlerGuard
                   APP_INTERCEPTOR PrismaErrorInterceptor
```

## File placement rules

| Adding | Where |
|---|---|
| config namespace | `common/config/<name>.config.ts` + `AppConfig` + `load` + `.env.example` |
| exception | `common/exceptions/<domain>/` + re-export from `index.ts` |
| reusable infra | `core/<name>/` + export from `CoreModule` |
| feature | `modules/<domain>/` + register in `AppModule` |
| Prisma model | `prisma/models/<model>.prisma` + migration + generate |

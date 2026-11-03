# Foundation invariants

## Config

Each namespace: `registerAs` + `validateConfig` (class-validator). The factory
throws at boot if a required variable is missing or invalid. Read values via
`ConfigService<AppConfig>` only.

- `NODE_ENV` is an enum (`development | test | production`); it drives helmet,
  CORS, cookie flags, and error verbosity.
- JWT secrets are `@MinLength(32)` and must differ.
- Port comes from `server.port`; never read `process.env.PORT` in `main.ts`.
- `.env.example` must list every required key; copying it must boot.

## Prisma

- Prisma 7: generator `prisma-client`, output `src/generated/prisma`,
  `moduleFormat = "cjs"`.
- Root `prisma.config.ts` supplies the schema folder, migrations path, and
  `DATABASE_URL`.
- `PrismaModule` is `@Global`; `PrismaService` implements `onModuleInit`
  (`$connect`) and `onModuleDestroy` (`$disconnect`).
- One pool for the process. Never provide `PrismaService` in feature modules.
- Generated client is gitignored and regenerated (`yarn prisma:generate`,
  `prebuild`).
- Models: `@@map` snake_case plural, timestamps, audit fields when the domain
  needs them, an index for every FK.
- Unique constraints with nullable columns do not deduplicate in PostgreSQL;
  use `NULLS NOT DISTINCT` or a sentinel.

## Errors

- `AppException(code, i18nKey, status, params)`; codes are the API contract
  (`UNAUTHENTICATED`, `FORBIDDEN`, `BAD_USER_INPUT`, `NOT_FOUND`, `CONFLICT`,
  `TOO_MANY_REQUESTS`, `INTERNAL_SERVER_ERROR`, `SERVICE_UNAVAILABLE`).
- GraphQL: `formatError` whitelists extensions, sets `errorId` for 5xx, logs
  once, and never leaks stacks (`includeStacktraceInErrorResponses: false`).
- REST: `AllExceptionsFilter` writes the response; for GraphQL it rethrows so
  Apollo's formatter handles it.
- Prisma errors are mapped in an interceptor (`P2002`/`P2003` → `CONFLICT`,
  `P2025` → `NOT_FOUND`, `P1001`/`P1002` → `SERVICE_UNAVAILABLE`).
- Validation returns every failing field:
  `extensions.params.fields = [{ field, rule, i18nKey }]`.
- Never expose whether an email/username exists on login-like endpoints.

## Runtime

- `main.ts`: helmet, CORS allowlist in production, cookie parser only if
  cookies are used, global pipe + filter, `enableShutdownHooks()`, `trust
  proxy` when behind a proxy, listen on validated port.
- `GET /health` returns `{ status: 'ok', uptime }` without hitting the DB.
- Redis connection closes with `quit()` on `onModuleDestroy`; keys are
  namespaced and always have a TTL.
- Throttler is GraphQL-aware; `throwThrottlingException` throws
  `AppException('TOO_MANY_REQUESTS')`.

## Build & deploy

- `tsconfig.build.json` includes `src/**/*`, excludes `prisma/`,
  `prisma.config.ts`, tests. Output is `dist/main.js`.
- `start:prod` = `node dist/main`.
- Docker: multi-stage, `yarn install --frozen-lockfile`, non-root, healthcheck,
  `prisma migrate deploy` in the release step (not in the image entrypoint).
- CI: install → prisma generate → build → test → `prisma migrate diff
  --exit-code` against the migrations.

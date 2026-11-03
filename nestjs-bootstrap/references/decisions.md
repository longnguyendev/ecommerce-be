# Decisions

Defaults are chosen to match the proven foundation of `yung-chang-erp-be`.
Change a decision **before** scaffolding, then adjust the templates and the
verification checklist in the same pass.

## Default stack

| Area | Default | Why | Cost / alternative |
|---|---|---|---|
| Runtime | Node 22, Nest 11, Express 5 | current LTS + Nest's default adapter | Fastify needs `@nestjs/platform-fastify` and a different bootstrap |
| API | GraphQL code-first (Apollo 5) | schema derived from decorators, no SDL drift | REST: replace `core/gql` with controllers + `class-validator`; keep DTOs |
| ORM | Prisma 7, `prisma-client` generator, multi-file schema | typed client, explicit migrations, models split by domain | TypeORM/Drizzle: rewrite `prisma/`, `PrismaModule`, error mapping |
| DB | PostgreSQL 14 | decimals, enums, partial/unique indexes | MySQL: change provider + `NULLS NOT DISTINCT` workarounds |
| Cache/session | Redis 7 via ioredis | token/session state, throttling, cache | Remove `core/redis`, `redis` config, and `REDIS_*` env |
| Auth | **JWT module configured, no strategies/guards** | foundation stays honest; auth is a feature | Add `modules/auth` + guard later (`extend.md`) |
| Validation | `class-validator` + whitelist + flatten | one error contract | — |
| Package manager | Yarn 1 (`yarn.lock`) | matches existing repos | pnpm/npm: regenerate lockfile, update Dockerfile/CI |
| Schema policy | in-memory `autoSchemaFile: true` | no committed artifact to drift | commit `src/schema.gql` and set the path explicitly — pick one |

## When to deviate

- **REST-only**: drop `@nestjs/graphql`, `@apollo/server`,
  `@as-integrations/express5`, `graphql-depth-limit`, `src/core/gql/`; add
  controllers and keep the same filter/pipe/error contract. The GraphQL
  throttler guard becomes the default `ThrottlerGuard`.
- **No Redis**: delete `src/core/redis/`, remove it from `CoreModule`, remove
  the `redis` config namespace, `REDIS_*` env, and the redis service from
  compose. Do this before the first commit — an unused global connection is a
  boot-time liability.
- **MySQL**: `provider = "mysql"`, replace `@db.Decimal`/enum usages, and
  re-check the unit-conversion unique constraint (NULL semantics differ).
- **No JWT yet**: remove `JwtConfigModule` and the `jwt` namespace. Keep it if
  auth is planned within the first sprint — otherwise it is dead config.
- **Monorepo**: keep one app under `apps/api`; Prisma schema and generated
  client stay app-local; do not share the generated client across apps.

## Non-negotiables

These are not preferences; they are what makes the foundation survive:

1. Config is validated at boot, one namespace per concern.
2. `PrismaService` is a single global provider with lifecycle hooks.
3. `dist/main.js` is the build output; `start:prod` runs it.
4. Generated Prisma client is gitignored.
5. One error shape for GraphQL (`formatError`) and one for REST (filter).
6. `GET /health` exists and is public.
7. Every FK has an index; every unique constraint accounts for NULLs.
8. Docker runs as non-root, installs from the lockfile, and has a healthcheck.

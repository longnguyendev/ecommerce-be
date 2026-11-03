---
name: nestjs-bootstrap
description: >-
  Start a new NestJS backend with a production-grade foundation: Nest 11,
  code-first GraphQL (Apollo 5), Prisma 7 with multi-file schema and the pg
  driver adapter, typed env config validated at boot, Redis core, JWT module,
  a single error/validation contract, a global Prisma module, health endpoint,
  graceful shutdown, multi-stage Docker image, and an audit script. Use when
  the user wants to create, scaffold, initialize, or bootstrap a new NestJS
  project/API/backend, start a new repo with NestJS + Prisma + GraphQL, or
  replicate the foundation of yung-chang-erp-be in a fresh project. Not for
  adding feature CRUD to an existing app and not for auth business logic.
argument-hint: "<target-dir> [--name package-name] [--force]"
user-invocable: true
---

# NestJS Bootstrap

You are creating a **new** NestJS repository with a foundation that is correct
on day one. The output compiles, builds, boots, and contains no feature code —
the user adds domains on top.

## What the scaffold contains

```
<target>/
├── src/
│   ├── main.ts                     # port from validated config, shutdown hooks
│   ├── app.module.ts               # config load, throttler, core, prisma, health
│   ├── common/
│   │   ├── config/                 # server, database, graphql, jwt, redis
│   │   ├── constants/              # i18n keys, salt rounds, TTLs
│   │   ├── exceptions/             # AppException(code, i18nKey, params)
│   │   ├── filters/                # REST error response + logging
│   │   ├── interceptors/           # Prisma P2002/P2003/P2025 mapping
│   │   ├── pagination/             # PaginationArgs + Paginated() factory
│   │   ├── pipes/                  # ValidationPipe with field-level errors
│   │   └── health/                 # GET /health
│   ├── core/                       # GraphQL config, JWT module, Redis module
│   ├── prisma/                     # global PrismaModule + PrismaService
│   └── guards/                     # GraphQL-aware throttler guard
├── prisma/                         # schema + models + idempotent seed
├── prisma.config.ts
├── Dockerfile, docker-compose.yml
├── .env.example, .gitignore, .dockerignore
├── .github/workflows/ci.yml
└── tsconfig*.json, nest-cli.json, package.json, README.md
```

Deliberately **not** included: auth strategies/guards, feature modules, RBAC,
file upload, email. `references/extend.md` shows how to add them without
breaking the foundation.

## Ground rules

1. **Never scaffold into a non-empty directory** without explicit `--force`,
   and even then do not delete existing files — the script refuses by default.
2. **Never invent a different stack.** The scaffold is pinned (Nest 11,
   GraphQL, Prisma 7 + PostgreSQL, Redis, Yarn). If the user wants REST-only or
   another database, read `references/decisions.md` and change it deliberately
   before scaffolding — do not mix.
3. **Never run migrations against an existing database.** For a new project,
   `prisma migrate dev --name init` against the local compose database only.
4. **Never print or commit secrets.** Generate `.env` locally from
   `.env.example`; `.env` stays gitignored.
5. **Verify before reporting success** (Phase 3). A scaffold that does not
   build is not done.

## Phase 0 — Confirm the target

Ask only for what is missing (one short question if needed):

- target directory (absolute or relative to cwd),
- package name (default: kebab-case of the directory name),
- package manager: **Yarn 1** by default; pnpm/npm only if the user asks.

Then check the target:

```bash
test -e <target> && ls -A <target>   # must be empty or absent
```

## Phase 1 — Scaffold

```bash
node scripts/scaffold.mjs <target> --name <package-name>
```

The script copies `assets/templates/`, replaces `{{PROJECT_NAME}}` and
`{{PROJECT_TITLE}}`, and prints the next steps. It does not install
dependencies and does not touch git.

Then, only if the user asked you to set the project up (not just generate
files):

```bash
cd <target>
cp .env.example .env        # then tell the user which values to fill
yarn install
docker compose up -d postgres redis
yarn db:migrate --name init
yarn db:seed
```

If Docker is unavailable, stop after `yarn install` + `yarn prisma:generate`
and report that the database step is pending.

## Phase 2 — Understand what was generated

Read, in this order, before touching anything:

1. `package.json` (scripts, versions), `tsconfig*.json`, `nest-cli.json`.
2. `src/main.ts` → `src/app.module.ts` → `src/core/core.module.ts`.
3. `src/common/config/*.ts` + `app.config.ts`.
4. `src/prisma/prisma.module.ts` + `prisma.service.ts` + `prisma/schema.prisma`.

The invariants behind these files are in `references/foundation.md`.

## Phase 3 — Verify (mandatory)

```bash
yarn prisma:generate
yarn build
test -f dist/main.js && echo "dist layout OK"
node scripts/audit-foundation.mjs .        # from this skill's scripts/
```

With Docker:

```bash
docker compose up -d postgres redis
yarn db:migrate --name init
yarn db:seed
node dist/main.js &                        # or yarn start:prod
curl -fsS http://127.0.0.1:3000/health
```

Expected: `{"status":"ok",...}`; no HIGH findings from the audit; boot logs the
listen port; `SIGTERM` closes Prisma/Redis cleanly.

If any step fails, fix the scaffold or the template — never leave the user with
a project that only "mostly" works.

## Phase 4 — Report (Vietnamese)

1. **Đã tạo** — path, stack, số file.
2. **Đã kiểm chứng** — command → kết quả thật.
3. **Cần làm tiếp** — `.env` values, first migration, first feature module.
4. **Không nằm trong scaffold** — auth, RBAC, feature CRUD (kèm reference).

## Adding the first domain

Follow `references/extend.md`:

1. `prisma/models/<domain>.prisma` + migration + generate.
2. `src/modules/<domain>/` with module/resolver/service/dto/entity.
3. Register the module in `app.module.ts`.
4. Pagination via `PaginationArgs` + `Paginated(Entity)`.
5. Errors via `AppException`; never throw bare `Error`.

## References

| File | Read when |
|---|---|
| `references/decisions.md` | choosing REST vs GraphQL, DB, Redis, removing pieces |
| `references/structure.md` | target layout, dependency rules, naming |
| `references/foundation.md` | config/Prisma/errors invariants and why |
| `references/extend.md` | first feature module, auth later, pagination |
| `references/verify.md` | exact acceptance checks and common failures |

Templates are the source of truth for code. If a template and a reference
disagree, fix the template and the reference in the same change.

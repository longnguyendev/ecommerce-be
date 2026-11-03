# {{PROJECT_TITLE}}

NestJS 11 + GraphQL (code-first) + Prisma 7 + PostgreSQL + Redis foundation.

## Requirements

- Node.js 22+
- Yarn 1.x
- Docker (PostgreSQL + Redis)

## Setup

```bash
cp .env.example .env      # fill in the JWT secrets
yarn install
docker compose up -d postgres redis
yarn db:migrate --name init
yarn db:seed
yarn start:dev
```

- GraphQL: http://localhost:3000/graphql
- Health: http://localhost:3000/health

## Scripts

| Command | Purpose |
|---|---|
| `yarn start:dev` | watch mode |
| `yarn build` / `yarn start:prod` | production build / run `dist/main.js` |
| `yarn prisma:generate` | regenerate the Prisma client |
| `yarn db:migrate --name <name>` | create + apply a migration |
| `yarn db:deploy` | apply migrations in CI/prod |
| `yarn db:seed` | idempotent seed |
| `yarn test` | unit tests |

## Structure

See `src/common` (config, errors, pagination, health), `src/core` (GraphQL,
JWT, Redis), `src/prisma` (global Prisma module), `prisma/models` (schema).

## Not included

Auth strategies/guards, RBAC, and feature modules are intentionally absent.
Add them on top of the foundation; see the bootstrap skill's `extend.md`.

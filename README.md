# E-commerce backend

NestJS 11 + GraphQL (code-first) + Prisma 7 + PostgreSQL + Redis foundation.

## Requirements

- Node.js 22+
- Yarn 1.x
- Docker (PostgreSQL + Redis)

## Setup

```bash
cp .env.example .env      # fill in the JWT secrets
yarn install
docker compose -f docker-compose.dev.yml up -d
yarn db:migrate --name init
yarn db:seed
yarn start:dev
```

- GraphQL: http://localhost:3000/graphql (`APP_PORT` in `.env`)
- Health: http://localhost:3000/health

## Docker

Two independent stacks:

- **Dev** — only Postgres + Redis; the app runs on the host with
  `yarn start:dev`, so hot reload and `node_modules` stay native.

  ```bash
  yarn docker:dev:up
  yarn docker:dev:down
  ```

- **Prod** — app image (multi-stage, non-root) + Postgres + Redis. Only the
  app port (`APP_PORT`) is published; the `migrate` service applies pending
  migrations (`prisma migrate deploy`) before the app container starts.

  ```bash
  yarn docker:prod:up      # build + start
  yarn docker:prod:down
  docker compose -f docker-compose.prod.yml logs -f app
  ```

  Seed once after the first prod start:

  ```bash
  docker compose -f docker-compose.prod.yml run --rm migrate yarn db:seed
  ```

  Notes: set strong `POSTGRES_PASSWORD` and `JWT_*` values in `.env` before
  deploying; the app container always listens on 3000 internally, `APP_PORT`
  only changes the host port; Postgres/Redis are not published to the host.

## Scripts

| Command                          | Purpose                                   |
| -------------------------------- | ----------------------------------------- |
| `yarn start:dev`                 | watch mode                                |
| `yarn build` / `yarn start:prod` | production build / run `dist/main.js`     |
| `yarn prisma:generate`           | regenerate the Prisma client              |
| `yarn db:migrate --name <name>`  | create + apply a migration                |
| `yarn db:deploy`                 | apply migrations in CI/prod               |
| `yarn db:seed`                   | idempotent seed                           |
| `yarn test`                      | unit tests                                |
| `yarn lint`                      | ESLint + Prettier autofix (`src`, `test`) |
| `yarn lint:check`                | ESLint without fixes (CI)                 |
| `yarn format`                    | Prettier whole repo + import sorting      |
| `yarn format:check`              | verify formatting without writing         |
| `yarn docker:dev:up`             | start Postgres + Redis for development    |
| `yarn docker:dev:down`           | stop the dev stack                        |
| `yarn docker:prod:up`            | build + start app, Postgres and Redis     |
| `yarn docker:prod:down`          | stop the prod stack                       |

## Git hooks

`yarn install` installs Husky (`prepare` script). On every commit,
`lint-staged` runs `prettier --write` + `eslint --fix` on staged files, so
formatting and import order are applied automatically; unfixable lint errors
block the commit.

- Import order (`.prettierrc`): builtin → third-party → `@/` alias → relative.
- `nestjs-bootstrap/`, `src/generated/`, `dist/`, `prisma/migrations/` are
  excluded from format/lint.

## Structure

See `src/common` (config, errors, pagination, health), `src/core` (GraphQL,
JWT, Redis), `src/prisma` (global Prisma module), `prisma/models` (schema).

## Not included

Auth strategies/guards, RBAC, and feature modules are intentionally absent.
Add them on top of the foundation; see the bootstrap skill's `extend.md`.

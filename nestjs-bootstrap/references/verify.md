# Verification

Run every step; report the real output, not an expectation.

## Static

```bash
yarn install
yarn prisma:generate
yarn build
test -f dist/main.js && echo "dist layout OK"
```

- `dist/main.js` must exist — `dist/src/main.js` means `tsconfig.build.json`
  is wrong.
- `yarn build` runs `prebuild: prisma generate`; if the generated client is
  missing, the build fails for the right reason.

## Database + runtime

```bash
docker compose up -d postgres redis
yarn db:migrate --name init
yarn db:seed
node dist/main.js
curl -fsS http://127.0.0.1:3000/health
```

Expected:

- migration folder contains `*_init/migration.sql` and `prisma migrate status`
  is clean;
- boot log shows the port from `APP_PORT`;
- `/health` returns `{"status":"ok","uptime":...}` with HTTP 200;
- `Ctrl+C`/SIGTERM logs a clean shutdown and exits 0.

## GraphQL

```bash
curl -fsS http://127.0.0.1:3000/graphql \
  -H 'content-type: application/json' \
  -d '{"query":"{ __typename }"}'
```

Expected `{"data":{"__typename":"Query"}}`. A 401 here means a global auth
guard was added without a `@Public()` path.

## Foundation audit

```bash
node <skill>/scripts/audit-foundation.mjs .
```

Expected: no HIGH. MEDIUM/LOW must be understood, not ignored.

## Common failures

| Symptom | Cause | Fix |
|---|---|---|
| `Cannot find module '@/generated/prisma/client'` | generate not run | `yarn prisma:generate` |
| `dist/main.js` missing | `tsconfig.build.json` includes `prisma/` | exclude it |
| boot fails: env validation | missing `.env` key | fill `.env` from `.env.example` |
| `P1001` on boot | Postgres not up / wrong `DATABASE_URL` | `docker compose up -d` |
| `/health` returns 401 | global auth guard without `@Public()` | mark the controller public |
| `ECONNREFUSED` Redis | `REDIS_HOST` is `localhost` inside compose | set `REDIS_HOST=redis` for the app container |
| migration creates `dist/` noise | `prisma` folder not excluded from build | exclude in `tsconfig.build.json` |

## Definition of done

- [ ] `yarn build` clean, `dist/main.js` exists
- [ ] `prisma migrate status` clean, seed runs twice without duplicates
- [ ] `/health` 200, GraphQL responds
- [ ] SIGTERM exits cleanly
- [ ] audit has no HIGH
- [ ] `.env` is gitignored, no secret in git
- [ ] Docker image builds and runs as non-root
- [ ] CI workflow green on the first push

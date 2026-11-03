# Extending the scaffold

## First feature module (15 minutes)

Example: `project`.

1. **Model** — `prisma/models/project.prisma`:

   ```prisma
   model Project {
     id        String   @id @default(cuid())
     code      String   @unique
     name      String
     createdAt DateTime @default(now())
     updatedAt DateTime @updatedAt

     @@map("projects")
   }
   ```

2. `yarn db:migrate --name add_project` then `yarn prisma:generate`.
3. Create `src/modules/project/`:
   - `dto/create-project.input.ts` (`@InputType` + class-validator)
   - `dto/update-project.input.ts` (`PartialType` + `id`)
   - `entities/project.entity.ts` (`@ObjectType`; expose only safe fields)
   - `project.service.ts` (Prisma calls; throw `AppException` / domain errors)
   - `project.resolver.ts` (`@Query`/`@Mutation`, `PaginationArgs`, `Paginated(Project)`)
   - `project.module.ts` (providers + exports service)
4. Register `ProjectModule` in `AppModule.imports`.

Pagination pattern:

```ts
@Query(() => PaginatedProject, { name: 'projects' })
findAll(@Args('pagination', { nullable: true }) pagination?: PaginationArgs) {
  return this.projectService.findAll({ ...pagination });
}
```

Service: `take = Math.min(args.take ?? 20, 100)`, always `orderBy`, fetch
`take + 1` to compute `hasNextPage`, count with the same `where`.

## Auth later

The scaffold configures `JwtModule` but deliberately ships no auth. When you add
it:

1. `prisma/models/user-session.prisma` (hashed refresh token, `familyId`,
   `expiresAt`, `revokedAt`, `@@index([userId])`).
2. `src/modules/auth/` with `auth.resolver.ts`, `auth.service.ts`,
   `strategies/jwt.strategy.ts`, `strategies/jwt-refresh.strategy.ts`,
   `guards/jwt-auth.guard.ts` (respect `@Public()`), `guards/jwt-refresh-auth.guard.ts`.
3. Access token 15 min, refresh 7–30 days, rotation with reuse detection
   (revoke the family on replay). Store only the refresh token hash.
4. Register `JwtAuthGuard` as `APP_GUARD` **after** `@Public()` works for
   `/health` and `signIn`.
5. Add RBAC (`@Roles()` + guard) before exposing destructive mutations.

Do not store raw access tokens in the database. Do not check the session table
on every request if you claim stateless JWT; choose one model and document it.

## Pagination

`src/common/pagination/pagination.args.ts` exposes `take` (max 100) and `skip`.
`Paginated(Entity)` builds `<Entity>Connection` with `nodes`, `edges`,
`totalCount`, `hasNextPage`. Keep one implementation — do not copy it per
service.

## Adding config

See `references/foundation.md` → Config. The five touchpoints are: config file,
`AppConfig`, `AppModule.load`, `.env.example`, consumer.

## Removing the GraphQL layer (REST-only)

1. Remove `core/gql/`, `@nestjs/graphql`, `@apollo/server`,
   `@as-integrations/express5`, `graphql-depth-limit` from `package.json`.
2. Replace `GqlThrottlerGuard` with the default `ThrottlerGuard`.
3. Keep `AppException`, the filter, the validation pipe, and the Prisma
   interceptor unchanged — the error contract still applies.

FROM node:22-alpine AS base
WORKDIR /app
# Hooks are host-only: skip Husky's prepare script inside the image.
ENV HUSKY=0
RUN corepack enable

FROM base AS deps
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

FROM deps AS build
COPY . .
# prisma.config.ts evaluates DATABASE_URL; generate does not connect.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN yarn prisma:generate && yarn build

FROM base AS prod-deps
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

# uid/gid cố định để chown thư mục bind mount trên host (1001:1001).
RUN addgroup -S -g 1001 app && adduser -S -u 1001 -G app app

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY package.json yarn.lock ./

# Thư mục ảnh upload: tạo sẵn và cấp quyền để named volume kế thừa đúng owner.
RUN mkdir -p uploads && chown -R app:app uploads

USER app
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1

CMD ["node", "dist/main.js"]

FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

FROM base AS deps
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/backend/package.json ./packages/backend/
COPY packages/backend/prisma ./packages/backend/prisma
RUN pnpm install --frozen-lockfile --filter=backend

FROM base AS builder
WORKDIR /app/packages/backend
COPY --from=deps /app/node_modules /app/node_modules
COPY --from=deps /app/packages/backend/node_modules ./node_modules
COPY packages/backend ./
RUN pnpm db:generate
RUN pnpm build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/packages/backend/dist ./dist
COPY --from=builder /app/packages/backend/node_modules ./node_modules
COPY --from=builder /app/packages/backend/prisma ./prisma
COPY --from=builder /app/packages/backend/package.json ./

EXPOSE 8080
CMD ["sh", "-c", "npx prisma migrate deploy && pnpm db:seed && node dist/index.js"]

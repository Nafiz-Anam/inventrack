# Multi-stage production build
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat openssl

# ── Install dependencies ──
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN corepack enable && corepack prepare pnpm@latest --activate \
    && pnpm install --frozen-lockfile || pnpm install

# ── Build ──
FROM base AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN pnpm build

# ── Production dependencies only ──
FROM base AS prod-deps
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN corepack enable && corepack prepare pnpm@latest --activate \
    && pnpm install --prod --frozen-lockfile || pnpm install --prod

# ── Runner ──
FROM node:22-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 appuser

# Production node_modules (smaller)
COPY --from=prod-deps /app/node_modules ./node_modules
# Built app
COPY --from=builder /app/build ./build
COPY --from=builder /app/package.json ./package.json
# Prisma schema + generated client
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

RUN chown -R appuser:nodejs /app
USER appuser

EXPOSE 8000
ENV PORT=8000

CMD ["node", "build/src/index.js"]

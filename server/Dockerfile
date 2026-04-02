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
ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL
RUN npx prisma generate
RUN pnpm build
# Remove devDependencies after build
RUN pnpm prune --prod

# ── Runner ──
FROM node:22-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 appuser

# Copy everything needed from builder (includes generated Prisma client in pnpm store)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/build ./build
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma

RUN chown -R appuser:nodejs /app
USER appuser

EXPOSE 8000
ENV PORT=8000

CMD ["node", "build/src/index.js"]

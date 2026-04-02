# Multi-stage build for production optimization
FROM node:22-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /usr/src/node-app

# Install dependencies with pnpm only
COPY package.json ./
RUN npm install -g pnpm@latest && pnpm install

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /usr/src/node-app
COPY --from=deps /usr/src/node-app/node_modules ./node_modules
COPY . .

# Generate Prisma client at build time
RUN pnpm dlx prisma generate

# Build the application
RUN pnpm build

# Production image, copy all the files and run the app
FROM node:22-alpine AS runner
WORKDIR /usr/src/node-app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

# Copy built application
COPY --from=builder /usr/src/node-app/dist ./dist
COPY --from=builder /usr/src/node-app/node_modules ./node_modules
COPY --from=builder /usr/src/node-app/package.json ./package.json
COPY --from=builder /usr/src/node-app/prisma ./prisma

# Create app directory and set permissions
RUN mkdir -p /usr/src/node-app && chown -R nodejs:nodejs /usr/src/node-app
USER nodejs

EXPOSE 8000

ENV PORT 8000

CMD ["pnpm", "start"]
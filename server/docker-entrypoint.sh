#!/bin/sh
set -e

echo "Waiting for database to be ready..."
sleep 3

echo "Generating Prisma client..."
npx prisma generate

echo "Pushing database schema..."
npx prisma db push

echo "Seeding database..."
npx ts-node prisma/seed.ts || echo "Seed may have already been applied, continuing..."

echo "Starting server..."
exec pnpm dev

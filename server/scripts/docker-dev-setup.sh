#!/bin/bash

# Docker Development Setup Script
# This script sets up the development environment with Docker

echo "🐳 Setting up Docker Development Environment..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please update the .env file with your actual configuration:"
    echo "   - DATABASE_URL (your Neon database URL)"
    echo "   - SMTP_* (your email configuration)"
    echo "   - JWT_SECRET (generate a secure secret)"
    echo ""
fi

# Build and start development environment
echo "🔨 Building Docker images..."
docker-compose -f docker-compose.yml -f docker-compose.dev.yml build

echo "🚀 Starting development environment..."
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check if services are running
if docker-compose -f docker-compose.yml -f docker-compose.dev.yml ps | grep -q "Up"; then
    echo "✅ Development environment is ready!"
    echo ""
    echo "🔗 Services:"
    echo "   - API: http://localhost:8000"
    echo "   - Redis: localhost:6379"
    echo "   - Health Check: http://localhost:8000/v1/health"
    echo "   - Email Health: http://localhost:8000/v1/health/email"
    echo ""
    echo "📝 Useful commands:"
    echo "   - View logs: docker-compose -f docker-compose.yml -f docker-compose.dev.yml logs -f"
    echo "   - Stop environment: npm run docker:dev-down"
    echo "   - Rebuild: npm run docker:dev-build && npm run docker:dev"
    echo ""
    echo "🔥 Hot reload is active - your changes will be reflected automatically!"
else
    echo "❌ Failed to start services. Check the logs:"
    docker-compose -f docker-compose.yml -f docker-compose.dev.yml logs
fi

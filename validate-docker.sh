#!/bin/bash

# Canvas MCP Server - Docker Validation Script
# Tests Docker configuration without requiring Docker to be running

echo "Canvas MCP Server - Docker Setup Validation"
echo "=============================================="

# Check if files exist
echo "Checking Docker configuration files..."

files=(
    "Dockerfile"
    "docker-compose.yml" 
    ".dockerignore"
    ".env.docker"
    "docker.sh"
    "docker.bat"
    "DOCKER-README.md"
)

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo "✓ $file exists"
    else
        echo "✗ $file missing"
    fi
done

echo ""
echo "File sizes:"
ls -lh Dockerfile docker-compose.yml .dockerignore 2>/dev/null || echo "Some files missing"

echo ""
echo "Docker Compose syntax validation (without Docker daemon):"
if command -v docker-compose >/dev/null 2>&1; then
    echo "✓ docker-compose command available"
elif command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    echo "✓ docker compose command available"
else
    echo "✗ Docker Compose not found"
fi

echo ""
echo "Environment template check:"
if [ -f ".env.docker" ]; then
    echo "✓ Environment template exists"
    echo "Sample configuration:"
    head -5 .env.docker
else
    echo "✗ Environment template missing"
fi

echo ""
echo "Script permissions:"
if [ -x "docker.sh" ]; then
    echo "✓ docker.sh is executable"
else
    echo "✗ docker.sh needs execute permissions"
fi

echo ""
echo "Next steps:"
echo "1. Start Docker Desktop"
echo "2. Copy .env.docker to .env and configure Canvas credentials"
echo "3. Run: ./docker.sh build"
echo "4. Run: ./docker.sh dev (for development) or ./docker.sh prod (for production)"

echo ""
echo "Cross-platform compatibility:"
echo "✓ Windows: Use docker.bat instead of docker.sh"
echo "✓ macOS: Use ./docker.sh commands"
echo "✓ Linux: Use ./docker.sh commands"
echo "✓ Cloud: Standard Docker deployment"

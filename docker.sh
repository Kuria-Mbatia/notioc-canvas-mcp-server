#!/bin/bash

# Canvas MCP Server - Docker Management Script
# Supports Windows, macOS, and Linux

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Docker Compose file
COMPOSE_FILE="docker-compose.yml"
ENV_FILE=".env"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is installed and running
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        print_error "Docker is not running. Please start Docker first."
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        print_error "Docker Compose is not available. Please install Docker Compose."
        exit 1
    fi
}

# Check environment file
check_env() {
    if [ ! -f "$ENV_FILE" ]; then
        if [ -f ".env.docker" ]; then
            print_warning "No .env file found. Copying from .env.docker template..."
            cp .env.docker .env
            print_warning "Please edit .env file with your Canvas API credentials before running."
            return 1
        else
            print_error "No environment file found. Please create .env file with Canvas API credentials."
            return 1
        fi
    fi
    return 0
}

# Build Docker images
build() {
    print_status "Building Canvas MCP Server Docker images..."
    docker-compose -f $COMPOSE_FILE build --no-cache
    print_success "Docker images built successfully!"
}

# Start development environment
dev() {
    print_status "Starting Canvas MCP Server in development mode..."
    if check_env; then
        docker-compose -f $COMPOSE_FILE --profile dev up --build
    else
        print_error "Please configure .env file first."
        exit 1
    fi
}

# Start production environment
prod() {
    print_status "Starting Canvas MCP Server in production mode..."
    if check_env; then
        docker-compose -f $COMPOSE_FILE --profile prod up -d --build
        print_success "Canvas MCP Server started in production mode!"
        print_status "Use 'docker-compose logs -f canvas-mcp-prod' to view logs"
    else
        print_error "Please configure .env file first."
        exit 1
    fi
}

# Start standalone mode (for Claude Desktop)
standalone() {
    print_status "Starting Canvas MCP Server in standalone mode..."
    if check_env; then
        docker-compose -f $COMPOSE_FILE --profile standalone up -d --build
        print_success "Canvas MCP Server started in standalone mode!"
        print_status "Use 'docker-compose logs -f canvas-mcp-standalone' to view logs"
    else
        print_error "Please configure .env file first."
        exit 1
    fi
}

# Stop all services
stop() {
    print_status "Stopping all Canvas MCP Server services..."
    docker-compose -f $COMPOSE_FILE down
    print_success "All services stopped!"
}

# Clean up (stop and remove containers, networks, volumes)
clean() {
    print_status "Cleaning up Canvas MCP Server Docker resources..."
    docker-compose -f $COMPOSE_FILE down -v --remove-orphans
    docker system prune -f
    print_success "Cleanup completed!"
}

# Show logs
logs() {
    local service=${1:-""}
    if [ -z "$service" ]; then
        print_status "Showing logs for all services..."
        docker-compose -f $COMPOSE_FILE logs -f
    else
        print_status "Showing logs for $service..."
        docker-compose -f $COMPOSE_FILE logs -f "$service"
    fi
}

# Show status
status() {
    print_status "Canvas MCP Server Docker Status:"
    docker-compose -f $COMPOSE_FILE ps
}

# Show help
show_help() {
    echo "Canvas MCP Server - Docker Management Script"
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  build      Build Docker images"
    echo "  dev        Start development environment"
    echo "  prod       Start production environment"
    echo "  standalone Start standalone mode (for Claude Desktop)"
    echo "  stop       Stop all services"
    echo "  clean      Stop and remove all containers, networks, volumes"
    echo "  logs       Show logs for all services"
    echo "  logs [svc] Show logs for specific service"
    echo "  status     Show service status"
    echo "  help       Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 dev                    # Start development environment"
    echo "  $0 prod                   # Start production environment"
    echo "  $0 logs canvas-mcp-prod   # Show production logs"
    echo "  $0 stop                   # Stop all services"
}

# Main execution
case "${1:-help}" in
    build)
        check_docker
        build
        ;;
    dev)
        check_docker
        dev
        ;;
    prod)
        check_docker
        prod
        ;;
    standalone)
        check_docker
        standalone
        ;;
    stop)
        check_docker
        stop
        ;;
    clean)
        check_docker
        clean
        ;;
    logs)
        check_docker
        logs "${2:-}"
        ;;
    status)
        check_docker
        status
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        print_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac

# Canvas MCP Server - Docker Setup

This directory contains Docker configuration for running the Canvas MCP Server across all platforms (Windows, macOS, Linux, Cloud).

## Quick Start

### Prerequisites

1. **Install Docker Desktop:**
   - **Windows**: Download from [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/)
   - **macOS**: Download from [Docker Desktop for Mac](https://www.docker.com/products/docker-desktop/)
   - **Linux**: Follow [Docker Engine installation guide](https://docs.docker.com/engine/install/)

2. **Configure Canvas API:**
   ```bash
   # Copy environment template
   cp .env.docker .env
   
   # Edit .env file with your Canvas credentials
   # CANVAS_BASE_URL=https://your-canvas-instance.instructure.com
   # CANVAS_ACCESS_TOKEN=your_canvas_access_token_here
   ```

3. **Configure Claude Desktop:**
   See the complete Claude Desktop setup in [SETUP.md](SETUP.md)

### Running the Server

#### Option 1: Using Management Scripts (Recommended)

**On macOS/Linux:**
```bash
# Start development environment
./docker.sh dev

# Start production environment
./docker.sh prod

# Start standalone mode (for Claude Desktop)
./docker.sh standalone
```

**On Windows:**
```cmd
# Start development environment
docker.bat dev

# Start production environment
docker.bat prod

# Start standalone mode (for Claude Desktop)
docker.bat standalone
```

#### Option 2: Direct Docker Compose

```bash
# Development mode
docker-compose --profile dev up --build

# Production mode
docker-compose --profile prod up -d --build

# Standalone mode
docker-compose --profile standalone up -d --build
```

## Available Commands

### Management Script Commands

| Command | Description |
|---------|-------------|
| `build` | Build Docker images |
| `dev` | Start development environment |
| `prod` | Start production environment |
| `standalone` | Start standalone mode (for Claude Desktop) |
| `stop` | Stop all services |
| `clean` | Remove containers, networks, volumes |
| `logs` | Show logs for all services |
| `status` | Show service status |

### Examples

```bash
# Build images
./docker.sh build

# View production logs
./docker.sh logs canvas-mcp-prod

# Check service status
./docker.sh status

# Clean up everything
./docker.sh clean
```

## Configuration

### Environment Variables

Create a `.env` file with the following variables:

```env
# Canvas LMS Configuration
CANVAS_API_URL=https://your-canvas-instance.instructure.com
CANVAS_ACCESS_TOKEN=your_canvas_access_token_here

# MCP Server Configuration
NODE_ENV=production
MCP_MODE=standalone
DEBUG=canvas-mcp:*
```

### Docker Compose Profiles

- **`dev`**: Development environment with hot reload
- **`prod`**: Production environment optimized for performance
- **`standalone`**: Standalone mode for Claude Desktop integration

## Docker Architecture

### Multi-Stage Build

The Dockerfile uses multi-stage builds for optimization:

1. **Builder Stage**: Compiles TypeScript and installs dependencies
2. **Production Stage**: Runs the application with minimal footprint

### Security Features

- Non-root user execution
- Minimal Alpine Linux base image
- Health checks included
- Proper signal handling with tini

### Persistent Data

- **Data Volume**: `/app/data` - Persistent application data
- **Logs Volume**: `/app/logs` - Application logs

## Troubleshooting

### Common Issues

1. **Docker not running:**
   ```bash
   # Check Docker status
   docker info
   ```

2. **Permission denied (Linux):**
   ```bash
   # Add user to docker group
   sudo usermod -aG docker $USER
   ```

3. **Port conflicts:**
   ```bash
   # Check port usage
   docker ps
   netstat -tulpn | grep :3000
   ```

4. **Environment not found:**
   ```bash
   # Copy template
   cp .env.docker .env
   # Edit with your credentials
   ```

### Windows-Specific Notes

- Ensure Docker Desktop is running
- Use PowerShell or Command Prompt as Administrator if needed
- WSL2 backend is recommended for better performance

### Logs and Debugging

```bash
# View all service logs
./docker.sh logs

# View specific service logs
docker-compose logs -f canvas-mcp-prod

# Debug container
docker exec -it canvas-mcp-production /bin/sh
```

## Cross-Platform Compatibility

This Docker setup ensures identical behavior across:

- **Windows 10/11** (with Docker Desktop)
- **macOS** (Intel and Apple Silicon)
- **Linux** (Ubuntu, CentOS, Debian, etc.)
- **Cloud Platforms** (AWS, Google Cloud, Azure)

## File Structure

```
├── Dockerfile              # Multi-stage production build
├── docker-compose.yml      # Service orchestration
├── .dockerignore           # Build optimization
├── .env.docker            # Environment template
├── docker.sh              # Management script (Unix)
├── docker.bat             # Management script (Windows)
└── DOCKER-README.md        # This file
```

## Deployment Options

### Local Development
```bash
./docker.sh dev
```

### Production Server
```bash
./docker.sh prod
```

### Claude Desktop Integration
```bash
./docker.sh standalone
```

### Cloud Deployment
```bash
# Build and push to registry
docker build -t your-registry/canvas-mcp-server .
docker push your-registry/canvas-mcp-server

# Deploy to cloud platform
docker run -d --env-file .env your-registry/canvas-mcp-server
```

## Security Considerations

- Never commit `.env` files with real credentials
- Use Docker secrets for production deployments
- Regularly update base images for security patches
- Run containers as non-root user (implemented)

## Support

If you encounter issues with the Docker setup:

1. Check the troubleshooting section above
2. Ensure Docker Desktop is running and up to date
3. Verify your `.env` file is properly configured
4. Check the logs using `./docker.sh logs`

The Docker setup is designed to work identically across all platforms, ensuring your Canvas MCP Server runs consistently whether you're on Windows, macOS, Linux, or in the cloud.

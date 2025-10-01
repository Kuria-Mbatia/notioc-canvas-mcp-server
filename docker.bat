@echo off
REM Canvas MCP Server - Docker Management Script for Windows
REM Supports Windows 10/11 with Docker Desktop

setlocal enabledelayedexpansion

set COMPOSE_FILE=docker-compose.yml
set ENV_FILE=.env

REM Function to print colored output (Windows doesn't support colors easily, so we use plain text)
echo Canvas MCP Server - Docker Management for Windows
echo ================================================

REM Check if Docker is installed and running
where docker >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Docker is not installed. Please install Docker Desktop first.
    pause
    exit /b 1
)

docker info >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Docker is not running. Please start Docker Desktop first.
    pause
    exit /b 1
)

where docker-compose >nul 2>nul
if %errorlevel% equ 0 goto :compose_found
docker compose version >nul 2>nul
if %errorlevel% equ 0 goto :compose_found
echo [ERROR] Docker Compose is not available. Please install Docker Compose.
pause
exit /b 1

:compose_found

REM Check environment file
if not exist "%ENV_FILE%" (
    if exist ".env.docker" (
        echo [WARNING] No .env file found. Copying from .env.docker template...
        copy .env.docker .env
        echo [WARNING] Please edit .env file with your Canvas API credentials before running.
        pause
        exit /b 1
    ) else (
        echo [ERROR] No environment file found. Please create .env file with Canvas API credentials.
        pause
        exit /b 1
    )
)

REM Parse command line argument
set COMMAND=%1
if "%COMMAND%"=="" set COMMAND=help

if "%COMMAND%"=="build" goto :build
if "%COMMAND%"=="dev" goto :dev
if "%COMMAND%"=="prod" goto :prod
if "%COMMAND%"=="standalone" goto :standalone
if "%COMMAND%"=="stop" goto :stop
if "%COMMAND%"=="clean" goto :clean
if "%COMMAND%"=="logs" goto :logs
if "%COMMAND%"=="status" goto :status
if "%COMMAND%"=="help" goto :help
goto :unknown

:build
echo [INFO] Building Canvas MCP Server Docker images...
docker-compose -f %COMPOSE_FILE% build --no-cache
echo [SUCCESS] Docker images built successfully!
goto :end

:dev
echo [INFO] Starting Canvas MCP Server in development mode...
docker-compose -f %COMPOSE_FILE% --profile dev up --build
goto :end

:prod
echo [INFO] Starting Canvas MCP Server in production mode...
docker-compose -f %COMPOSE_FILE% --profile prod up -d --build
echo [SUCCESS] Canvas MCP Server started in production mode!
echo [INFO] Use 'docker-compose logs -f canvas-mcp-prod' to view logs
goto :end

:standalone
echo [INFO] Starting Canvas MCP Server in standalone mode...
docker-compose -f %COMPOSE_FILE% --profile standalone up -d --build
echo [SUCCESS] Canvas MCP Server started in standalone mode!
echo [INFO] Use 'docker-compose logs -f canvas-mcp-standalone' to view logs
goto :end

:stop
echo [INFO] Stopping all Canvas MCP Server services...
docker-compose -f %COMPOSE_FILE% down
echo [SUCCESS] All services stopped!
goto :end

:clean
echo [INFO] Cleaning up Canvas MCP Server Docker resources...
docker-compose -f %COMPOSE_FILE% down -v --remove-orphans
docker system prune -f
echo [SUCCESS] Cleanup completed!
goto :end

:logs
echo [INFO] Showing logs for all services...
docker-compose -f %COMPOSE_FILE% logs -f
goto :end

:status
echo [INFO] Canvas MCP Server Docker Status:
docker-compose -f %COMPOSE_FILE% ps
goto :end

:help
echo.
echo Canvas MCP Server - Docker Management Script for Windows
echo.
echo Usage: docker.bat [command]
echo.
echo Commands:
echo   build      Build Docker images
echo   dev        Start development environment
echo   prod       Start production environment
echo   standalone Start standalone mode (for Claude Desktop)
echo   stop       Stop all services
echo   clean      Stop and remove all containers, networks, volumes
echo   logs       Show logs for all services
echo   status     Show service status
echo   help       Show this help message
echo.
echo Examples:
echo   docker.bat dev        Start development environment
echo   docker.bat prod       Start production environment
echo   docker.bat stop       Stop all services
echo.
goto :end

:unknown
echo [ERROR] Unknown command: %COMMAND%
echo.
goto :help

:end
pause

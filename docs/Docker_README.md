# Docker — Comprehensive Guide

A thorough, beginner-friendly reference covering everything you need to know about Docker, from core concepts to production patterns.

---

## Table of Contents

1. [What is Docker?](#what-is-docker)
2. [Key Concepts](#key-concepts)
3. [Installation](#installation)
4. [Docker CLI Essentials](#docker-cli-essentials)
5. [Dockerfile Deep Dive](#dockerfile-deep-dive)
6. [Example: Node.js Webapp](#example-nodejs-webapp)
7. [Example: Python Webapp](#example-python-webapp)
8. [Docker Compose](#docker-compose)
9. [Networking](#networking)
10. [Volumes and Data Persistence](#volumes-and-data-persistence)
11. [Multi-Stage Builds](#multi-stage-builds)
12. [Environment Variables and Secrets](#environment-variables-and-secrets)
13. [Health Checks](#health-checks)
14. [Logging and Debugging](#logging-and-debugging)
15. [Image Optimization](#image-optimization)
16. [Security Best Practices](#security-best-practices)
17. [Docker in CI/CD](#docker-in-cicd)
18. [Container Orchestration Overview](#container-orchestration-overview)
19. [Common Pitfalls](#common-pitfalls)
20. [VS Code Extensions for Docker](#vs-code-extensions-for-docker)
21. [Cheat Sheet](#cheat-sheet)

---

## What is Docker?

Docker is a platform that packages applications and their dependencies into lightweight, portable **containers**. A container runs the same way on any machine — your laptop, a test server, or a cloud VM — eliminating the "works on my machine" problem.

### Containers vs Virtual Machines

| Feature        | Container                          | Virtual Machine             |
| -------------- | ---------------------------------- | --------------------------- |
| Boot time      | Seconds                            | Minutes                     |
| Size           | MBs (shares host kernel)           | GBs (full OS)               |
| Isolation      | Process-level (namespaces/cgroups) | Hardware-level (hypervisor) |
| Performance    | Near-native                        | Slight overhead             |
| Portability    | Very high                          | High (but heavier)          |
| Resource usage | Minimal                            | Significant                 |

Containers share the host OS kernel and isolate the application process using Linux namespaces (PID, network, mount, user) and cgroups (resource limits). VMs run an entire guest OS on top of a hypervisor.

---

## Key Concepts

### Image

A read-only template containing your application code, runtime, libraries, and OS tools. Images are built from a `Dockerfile` and stored in layers. Each instruction in a Dockerfile creates a new layer stacked on top of the previous one.

```
Layer 4: COPY . /app          (your code)
Layer 3: RUN npm install       (dependencies)
Layer 2: WORKDIR /app          (metadata)
Layer 1: node:20-alpine        (base image)
```

Layers are cached — if a layer hasn't changed, Docker reuses it. This is why instruction order in a Dockerfile matters for build speed.

### Container

A running instance of an image. You can run many containers from the same image. Containers are ephemeral by default — data written inside a container is lost when the container is removed (unless you use volumes).

### Registry

A storage and distribution service for images. **Docker Hub** is the default public registry. Others include GitHub Container Registry (ghcr.io), Amazon ECR, Google GCR, and Azure ACR.

```
docker.io/library/node:20-alpine
^^^^^^^^^ ^^^^^^^ ^^^^ ^^^^^^^^^
registry  account name tag
```

### Tag

A label for a specific version of an image. Common conventions:

- `latest` — the most recent build (implicit default, avoid in production)
- `20`, `20.11`, `20.11.1` — version pinning (more specific = more reproducible)
- `alpine` — minimal Alpine Linux base (~5MB vs ~100MB for Debian)
- `slim` — stripped-down Debian base
- `bookworm`, `bullseye` — Debian release codenames

### Dockerfile

A text file containing instructions to build an image. Think of it as a recipe.

### Docker Compose

A tool for defining and running multi-container applications using a YAML file (`docker-compose.yml` or `compose.yml`).

### Volume

A persistent storage mechanism that lives outside the container's filesystem. Data in a volume survives container restarts and removals.

### Network

Docker creates virtual networks so containers can communicate with each other. By default, containers on the same Docker network can reach each other by container name.

---

## Installation

### macOS

```bash
# Option 1: Docker Desktop (GUI + CLI)
brew install --cask docker

# Option 2: CLI-only via Colima (lightweight alternative)
brew install docker docker-compose colima
colima start
```

### Ubuntu / Debian

```bash
# Remove old versions
sudo apt-get remove docker docker-engine docker.io containerd runc

# Install via official repository
sudo apt-get update
sudo apt-get install ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Run without sudo
sudo usermod -aG docker $USER
newgrp docker
```

### Windows

Install **Docker Desktop** from [docker.com](https://www.docker.com/products/docker-desktop/) or via WSL2 backend.

### Verify installation

```bash
docker --version
docker compose version
docker run hello-world
```

---

## Docker CLI Essentials

### Image commands

```bash
# Build an image from a Dockerfile in the current directory
docker build -t myapp:1.0 .

# List local images
docker images

# Pull an image from a registry
docker pull node:20-alpine

# Remove an image
docker rmi myapp:1.0

# Remove all unused images
docker image prune -a

# Tag an image for pushing to a registry
docker tag myapp:1.0 myregistry.com/myapp:1.0

# Push to a registry
docker push myregistry.com/myapp:1.0

# Inspect image details (layers, env vars, entrypoint)
docker inspect node:20-alpine

# Show image layer history
docker history node:20-alpine
```

### Container commands

```bash
# Run a container (foreground)
docker run myapp:1.0

# Run in background (detached)
docker run -d myapp:1.0

# Run with a name
docker run -d --name my-server myapp:1.0

# Run with port mapping (host:container)
docker run -d -p 8080:3000 myapp:1.0

# Run with environment variables
docker run -d -e NODE_ENV=production -e DB_HOST=localhost myapp:1.0

# Run with a volume mount
docker run -d -v /host/path:/container/path myapp:1.0

# Run interactively (get a shell inside the container)
docker run -it node:20-alpine sh

# List running containers
docker ps

# List all containers (including stopped)
docker ps -a

# Stop a container
docker stop my-server

# Start a stopped container
docker start my-server

# Restart a container
docker restart my-server

# Remove a stopped container
docker rm my-server

# Force remove a running container
docker rm -f my-server

# Remove all stopped containers
docker container prune

# View container logs
docker logs my-server

# Follow logs in real time
docker logs -f my-server

# Show last 100 lines
docker logs --tail 100 my-server

# Execute a command inside a running container
docker exec -it my-server sh

# Copy files between host and container
docker cp my-server:/app/data.json ./data.json
docker cp ./config.json my-server:/app/config.json

# View resource usage
docker stats

# View detailed container info
docker inspect my-server
```

### System commands

```bash
# Show disk usage
docker system df

# Clean up everything unused (images, containers, networks, cache)
docker system prune -a --volumes

# View Docker daemon info
docker info
```

---

## Dockerfile Deep Dive

A Dockerfile is read top to bottom. Each instruction creates a layer in the image.

### Core instructions

```dockerfile
# ---- FROM ----
# Sets the base image. Every Dockerfile must start with FROM.
# Always pin to a specific version for reproducibility.
FROM node:20-alpine

# ---- WORKDIR ----
# Sets the working directory inside the container.
# All subsequent commands run from this directory.
# Creates the directory if it doesn't exist.
WORKDIR /app

# ---- COPY ----
# Copies files from build context (your local machine) into the image.
# Syntax: COPY <source> <destination>
COPY package.json package-lock.json ./
COPY src/ ./src/

# ---- ADD ----
# Like COPY but can also:
#   - Extract tar archives automatically
#   - Download from URLs (not recommended; use curl in RUN instead)
# Prefer COPY unless you specifically need ADD features.
ADD archive.tar.gz /app/

# ---- RUN ----
# Executes a command during the build process.
# Each RUN creates a new layer — combine related commands with && to reduce layers.
RUN apk add --no-cache git curl && \
    npm ci --only=production && \
    npm cache clean --force

# ---- ENV ----
# Sets environment variables available during build AND at runtime.
ENV NODE_ENV=production
ENV PORT=3000

# ---- ARG ----
# Sets build-time-only variables (not available at runtime).
# Useful for parameterizing builds.
ARG APP_VERSION=1.0.0
RUN echo "Building version $APP_VERSION"

# ---- EXPOSE ----
# Documents which port the container listens on.
# This is informational only — you still need -p when running.
EXPOSE 3000

# ---- USER ----
# Sets the user to run subsequent commands (and the final container) as.
# Important for security — avoid running as root.
USER node

# ---- CMD ----
# Default command to run when the container starts.
# Only one CMD per Dockerfile (last one wins).
# Can be overridden at runtime: docker run myapp <other-command>
CMD ["node", "server.js"]

# ---- ENTRYPOINT ----
# Like CMD but harder to override. CMD arguments get appended to ENTRYPOINT.
# Use ENTRYPOINT when the container should always run a specific executable.
ENTRYPOINT ["node"]
CMD ["server.js"]
# Running: docker run myapp         => node server.js
# Running: docker run myapp app.js  => node app.js

# ---- VOLUME ----
# Creates a mount point for persistent data.
VOLUME ["/app/data"]

# ---- LABEL ----
# Adds metadata to the image (author, version, description).
LABEL maintainer="you@example.com"
LABEL version="1.0.0"
```

### ENTRYPOINT vs CMD

| Scenario                | ENTRYPOINT | CMD                  | Result                                     |
| ----------------------- | ---------- | -------------------- | ------------------------------------------ |
| Only CMD                | —          | `["node", "app.js"]` | `node app.js`                              |
| Only ENTRYPOINT         | `["node"]` | —                    | `node`                                     |
| Both                    | `["node"]` | `["app.js"]`         | `node app.js`                              |
| Both + runtime override | `["node"]` | `["app.js"]`         | `docker run img test.js` => `node test.js` |

Rule of thumb: Use `CMD` for most apps. Use `ENTRYPOINT` + `CMD` when your container is a wrapper around a single executable and you want to allow argument overrides.

### .dockerignore

Like `.gitignore`, this file tells Docker which files to exclude from the build context. This speeds up builds and prevents secrets from leaking into images.

```
# .dockerignore
node_modules
npm-debug.log
.git
.env
.env.*
Dockerfile
docker-compose.yml
.dockerignore
README.md
.vscode
coverage
dist
*.md
```

---

## Example: Node.js Webapp

### Project structure

```
my-node-app/
  src/
    server.js
  package.json
  package-lock.json
  Dockerfile
  .dockerignore
```

### src/server.js

```javascript
const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.json({
    message: "Hello from Docker!",
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
  });
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "healthy" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
```

### package.json

```json
{
  "name": "my-node-app",
  "version": "1.0.0",
  "main": "src/server.js",
  "scripts": {
    "start": "node src/server.js",
    "dev": "node --watch src/server.js"
  },
  "dependencies": {
    "express": "^4.18.2"
  }
}
```

### Dockerfile (simple)

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy dependency files first (layer caching optimization)
COPY package.json package-lock.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy application code
COPY src/ ./src/

# Set environment
ENV NODE_ENV=production

# Document the port
EXPOSE 3000

# Don't run as root
USER node

# Start the app
CMD ["node", "src/server.js"]
```

### Dockerfile (production multi-stage)

```dockerfile
# ---- Stage 1: Install dependencies ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --only=production && npm cache clean --force

# ---- Stage 2: Production image ----
FROM node:20-alpine AS production

# Add a non-root user (Alpine's node image already has 'node' user)
WORKDIR /app

# Copy only the production node_modules from the deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application code
COPY src/ ./src/
COPY package.json ./

ENV NODE_ENV=production
EXPOSE 3000

# Run health check every 30 seconds
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

USER node

CMD ["node", "src/server.js"]
```

### .dockerignore

```
node_modules
npm-debug.log*
.git
.gitignore
.env
.env.*
Dockerfile
docker-compose*.yml
.dockerignore
README.md
.vscode
coverage
.nyc_output
```

### Build and run

```bash
# Build the image
docker build -t my-node-app:1.0 .

# Run the container
docker run -d \
  --name node-server \
  -p 8080:3000 \
  -e NODE_ENV=production \
  my-node-app:1.0

# Test it
curl http://localhost:8080/
curl http://localhost:8080/health

# View logs
docker logs -f node-server

# Get a shell inside the container
docker exec -it node-server sh

# Stop and remove
docker stop node-server
docker rm node-server
```

### Docker Compose for Node.js (with MongoDB)

```yaml
# compose.yml
services:
  app:
    build: .
    ports:
      - "8080:3000"
    environment:
      NODE_ENV: production
      MONGO_URI: mongodb://mongo:27017/mydb
    depends_on:
      mongo:
        condition: service_healthy
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:3000/health"]
      interval: 30s
      timeout: 3s
      retries: 3

  mongo:
    image: mongo:7
    volumes:
      - mongo-data:/data/db
    ports:
      - "27017:27017"
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  mongo-data:
```

```bash
# Start everything
docker compose up -d

# View logs
docker compose logs -f app

# Stop everything
docker compose down

# Stop and remove volumes (deletes data)
docker compose down -v
```

---

## Example: Python Webapp

### Project structure

```
my-python-app/
  app/
    __init__.py
    main.py
  requirements.txt
  Dockerfile
  .dockerignore
```

### app/main.py

```python
from flask import Flask, jsonify
import os
from datetime import datetime, timezone

app = Flask(__name__)

@app.route("/")
def index():
    return jsonify({
        "message": "Hello from Docker!",
        "environment": os.getenv("FLASK_ENV", "development"),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })

@app.route("/health")
def health():
    return jsonify({"status": "healthy"}), 200

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
```

### app/\_\_init\_\_.py

```python
# empty file — makes app/ a Python package
```

### requirements.txt

```
flask==3.0.0
gunicorn==21.2.0
```

### Dockerfile (simple)

```dockerfile
FROM python:3.12-slim

WORKDIR /app

# Install dependencies first (layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app/ ./app/

ENV FLASK_ENV=production
EXPOSE 5000

# Create a non-root user
RUN adduser --disabled-password --gecos "" appuser
USER appuser

# Use gunicorn for production (4 workers)
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "4", "app.main:app"]
```

### Dockerfile (production multi-stage)

```dockerfile
# ---- Stage 1: Build dependencies ----
FROM python:3.12-slim AS builder

WORKDIR /app

# Install build dependencies if needed (e.g., for compiled packages)
RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# Install into a virtual environment for clean copying
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --no-cache-dir -r requirements.txt

# ---- Stage 2: Production image ----
FROM python:3.12-slim AS production

WORKDIR /app

# Copy the virtual environment from builder
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy application code
COPY app/ ./app/

ENV FLASK_ENV=production
EXPOSE 5000

# Create non-root user
RUN adduser --disabled-password --gecos "" appuser
USER appuser

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5000/health')" || exit 1

CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "4", "app.main:app"]
```

### .dockerignore

```
__pycache__
*.pyc
*.pyo
.git
.gitignore
.env
.env.*
Dockerfile
docker-compose*.yml
.dockerignore
README.md
.vscode
.pytest_cache
venv
.venv
*.egg-info
```

### Build and run

```bash
# Build the image
docker build -t my-python-app:1.0 .

# Run the container
docker run -d \
  --name python-server \
  -p 8080:5000 \
  -e FLASK_ENV=production \
  my-python-app:1.0

# Test it
curl http://localhost:8080/
curl http://localhost:8080/health

# View logs
docker logs -f python-server

# Get a shell inside
docker exec -it python-server bash

# Stop and remove
docker stop python-server
docker rm python-server
```

### Docker Compose for Python (with PostgreSQL and Redis)

```yaml
# compose.yml
services:
  app:
    build: .
    ports:
      - "8080:5000"
    environment:
      FLASK_ENV: production
      DATABASE_URL: postgresql://user:password@db:5432/mydb
      REDIS_URL: redis://redis:6379/0
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
      POSTGRES_DB: mydb
    volumes:
      - postgres-data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U user -d mydb"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    volumes:
      - redis-data:/data
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres-data:
  redis-data:
```

---

## Docker Compose

Docker Compose defines multi-container apps in a single YAML file. It's the standard for local development environments.

### Key compose.yml directives

```yaml
services:
  webapp:
    # ---- Build from Dockerfile ----
    build:
      context: . # Build context directory
      dockerfile: Dockerfile.prod # Custom Dockerfile name
      args:
        APP_VERSION: "2.0" # Build-time ARGs

    # ---- Or use a pre-built image ----
    image: nginx:alpine

    # ---- Container name (optional) ----
    container_name: my-webapp

    # ---- Port mapping ----
    ports:
      - "8080:80" # host:container
      - "127.0.0.1:9090:80" # bind to localhost only

    # ---- Environment variables ----
    environment:
      NODE_ENV: production
      API_KEY: ${API_KEY} # Read from host env or .env file

    # ---- Load env from file ----
    env_file:
      - .env
      - .env.local

    # ---- Volume mounts ----
    volumes:
      - ./src:/app/src # Bind mount (host path)
      - app-data:/app/data # Named volume
      - /app/node_modules # Anonymous volume (prevents overwrite)

    # ---- Networking ----
    networks:
      - frontend
      - backend

    # ---- Dependency ordering ----
    depends_on:
      db:
        condition: service_healthy # Wait for health check to pass
      redis:
        condition: service_started # Just wait for container to start

    # ---- Restart policy ----
    restart: unless-stopped
    # Options: "no" | "always" | "on-failure" | "unless-stopped"

    # ---- Resource limits ----
    deploy:
      resources:
        limits:
          cpus: "1.0"
          memory: 512M
        reservations:
          cpus: "0.25"
          memory: 128M

    # ---- Health check ----
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:80/"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s

    # ---- Override entrypoint/command ----
    entrypoint: /app/entrypoint.sh
    command: ["--config", "/app/config.yml"]

    # ---- Logging ----
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"

# ---- Named volumes ----
volumes:
  app-data:
    driver: local

# ---- Custom networks ----
networks:
  frontend:
  backend:
```

### Compose CLI commands

```bash
# Start services (build if needed)
docker compose up -d

# Start and force rebuild
docker compose up -d --build

# Stop services (containers stay)
docker compose stop

# Stop and remove containers + networks
docker compose down

# Stop, remove containers, AND delete volumes
docker compose down -v

# View logs
docker compose logs -f
docker compose logs -f webapp     # single service

# List running services
docker compose ps

# Run a one-off command in a service
docker compose exec webapp sh
docker compose run webapp npm test   # starts a new container

# Scale a service
docker compose up -d --scale worker=3

# View config (with variable substitution)
docker compose config

# Pull latest images
docker compose pull
```

### Variable substitution

Compose automatically reads a `.env` file in the same directory:

```bash
# .env
POSTGRES_PASSWORD=supersecret
APP_PORT=8080
```

```yaml
# compose.yml
services:
  app:
    ports:
      - "${APP_PORT:-3000}:3000" # Default to 3000 if not set
  db:
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
```

### Multiple compose files (override pattern)

```bash
# Base config + development overrides
docker compose -f compose.yml -f compose.dev.yml up -d

# Base config + production overrides
docker compose -f compose.yml -f compose.prod.yml up -d
```

```yaml
# compose.yml (base)
services:
  app:
    build: .
    ports:
      - "3000:3000"

# compose.dev.yml (development overrides)
services:
  app:
    volumes:
      - ./src:/app/src    # Live code reloading
    environment:
      NODE_ENV: development
    command: npm run dev

# compose.prod.yml (production overrides)
services:
  app:
    environment:
      NODE_ENV: production
    restart: always
```

---

## Networking

### Network types

| Driver    | Use case                                       |
| --------- | ---------------------------------------------- |
| `bridge`  | Default. Containers on same host communicate.  |
| `host`    | Container shares host's network (no isolation) |
| `none`    | No networking                                  |
| `overlay` | Multi-host networking (Swarm/Kubernetes)       |

### Default bridge behavior

By default, all containers join a `bridge` network. They can reach each other by IP but **not** by name.

```bash
# Create a custom bridge network (enables DNS by container name)
docker network create my-network

# Run containers on the same network
docker run -d --name api --network my-network my-api
docker run -d --name db --network my-network postgres:16

# Now 'api' can reach 'db' by hostname:
# postgres://db:5432/mydb
```

### Docker Compose networking

Compose automatically creates a network for all services in the file. Services reach each other by their service name:

```yaml
services:
  api:
    build: .
    environment:
      DB_HOST: db # <-- Uses the service name as hostname
  db:
    image: postgres:16
```

### Exposing ports

```bash
# Map container port 3000 to host port 8080
docker run -p 8080:3000 myapp

# Map to localhost only (not accessible from other machines)
docker run -p 127.0.0.1:8080:3000 myapp

# Map to a random host port
docker run -p 3000 myapp    # Check with: docker port <container>

# Map UDP port
docker run -p 8080:3000/udp myapp
```

### Useful network commands

```bash
# List networks
docker network ls

# Inspect a network (see connected containers)
docker network inspect my-network

# Connect a running container to a network
docker network connect my-network my-container

# Disconnect
docker network disconnect my-network my-container

# Remove unused networks
docker network prune
```

---

## Volumes and Data Persistence

Containers are ephemeral. When a container is removed, its filesystem is gone. Volumes provide persistent storage.

### Three types of mounts

```bash
# 1. Named volume (Docker manages the storage location)
#    Best for: databases, persistent app data
docker run -v my-data:/app/data myapp

# 2. Bind mount (maps a host directory into the container)
#    Best for: development (live code reloading)
docker run -v /home/user/src:/app/src myapp
docker run -v $(pwd)/src:/app/src myapp

# 3. tmpfs mount (stored in memory, never written to disk)
#    Best for: sensitive data that shouldn't persist
docker run --tmpfs /app/temp myapp
```

### Volume commands

```bash
# Create a volume
docker volume create my-data

# List volumes
docker volume ls

# Inspect a volume (see mount point on host)
docker volume inspect my-data

# Remove a volume
docker volume rm my-data

# Remove all unused volumes
docker volume prune
```

### Common volume patterns

```yaml
services:
  app:
    volumes:
      # Bind mount for development (live reload)
      - ./src:/app/src

      # Anonymous volume to prevent node_modules from being overwritten
      # by the bind mount above
      - /app/node_modules

      # Named volume for persistent data
      - uploads:/app/uploads

  db:
    volumes:
      # Named volume for database persistence
      - db-data:/var/lib/postgresql/data

      # Bind mount for initialization scripts
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql:ro

volumes:
  uploads:
  db-data:
```

The `:ro` suffix makes a mount read-only inside the container.

### Backup and restore volumes

```bash
# Backup a volume to a tar file
docker run --rm \
  -v my-data:/source:ro \
  -v $(pwd):/backup \
  alpine tar czf /backup/my-data-backup.tar.gz -C /source .

# Restore from backup
docker run --rm \
  -v my-data:/target \
  -v $(pwd):/backup \
  alpine tar xzf /backup/my-data-backup.tar.gz -C /target
```

---

## Multi-Stage Builds

Multi-stage builds let you use multiple `FROM` instructions in a single Dockerfile. Only the final stage ends up in the output image. This keeps production images small by excluding build tools, source code, and intermediate files.

### Pattern: Build in one stage, run in another

```dockerfile
# ---- Stage 1: Build ----
FROM node:20 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build    # Produces /app/dist/

# ---- Stage 2: Production ----
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
ENV NODE_ENV=production
EXPOSE 3000
USER node
CMD ["node", "dist/server.js"]
```

The final image only contains Alpine + the compiled output. The full Node.js SDK, source code, and dev dependencies are discarded.

### Pattern: Static site with Nginx

```dockerfile
# Build React/Vue/Angular app
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Serve with Nginx
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Pattern: Go binary (extreme size reduction)

```dockerfile
FROM golang:1.22 AS builder
WORKDIR /app
COPY go.* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /server .

# Scratch = empty image (0 bytes base)
FROM scratch
COPY --from=builder /server /server
EXPOSE 8080
ENTRYPOINT ["/server"]
```

Final image: just the binary (~10-15MB vs ~800MB with full Go SDK).

### Build specific stages

```bash
# Build only the 'builder' stage (useful for testing)
docker build --target builder -t myapp:build .

# Build the final stage (default)
docker build -t myapp:prod .
```

---

## Environment Variables and Secrets

### Setting env vars

```bash
# Via CLI
docker run -e MY_VAR=value -e OTHER_VAR=value2 myapp

# From a file
docker run --env-file .env myapp
```

### In Dockerfile

```dockerfile
# Available during build AND runtime
ENV NODE_ENV=production
ENV PORT=3000

# Available only during build
ARG NPM_TOKEN
RUN echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > .npmrc && \
    npm ci && \
    rm .npmrc
```

### Secrets (don't put secrets in ENV or ARG)

Build args and environment variables can be seen in `docker inspect` and `docker history`. For sensitive data:

```dockerfile
# Use BuildKit secrets (never stored in image layers)
# syntax=docker/dockerfile:1
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN --mount=type=secret,id=npmrc,target=/app/.npmrc npm ci
COPY . .
CMD ["node", "server.js"]
```

```bash
# Pass the secret at build time
docker build --secret id=npmrc,src=.npmrc -t myapp .
```

In Compose, use Docker secrets for runtime:

```yaml
services:
  app:
    image: myapp
    secrets:
      - db_password
    environment:
      DB_PASSWORD_FILE: /run/secrets/db_password

secrets:
  db_password:
    file: ./secrets/db_password.txt
```

---

## Health Checks

Health checks let Docker (and orchestrators) know if your application is actually working, not just running.

### In Dockerfile

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1
```

| Option           | Meaning                                 | Default |
| ---------------- | --------------------------------------- | ------- |
| `--interval`     | Time between checks                     | 30s     |
| `--timeout`      | Max time for a single check             | 30s     |
| `--start-period` | Grace period for container startup      | 0s      |
| `--retries`      | Consecutive failures before "unhealthy" | 3       |

### In docker-compose.yml

```yaml
healthcheck:
  test: ["CMD-SHELL", "curl -f http://localhost:3000/health || exit 1"]
  interval: 30s
  timeout: 3s
  start_period: 10s
  retries: 3
```

### Check health status

```bash
docker inspect --format='{{.State.Health.Status}}' my-container
# Returns: starting | healthy | unhealthy

docker ps
# HEALTH column shows: (healthy), (unhealthy), (starting)
```

### Lightweight health check alternatives (no curl needed)

```dockerfile
# Node.js — use wget (available in Alpine)
HEALTHCHECK CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Python — use Python itself
HEALTHCHECK CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5000/health')" || exit 1

# Check if a process is running
HEALTHCHECK CMD pgrep -x node || exit 1

# Check if a port is listening
HEALTHCHECK CMD nc -z localhost 3000 || exit 1
```

---

## Logging and Debugging

### View logs

```bash
# All logs
docker logs my-container

# Follow (like tail -f)
docker logs -f my-container

# Last N lines
docker logs --tail 50 my-container

# Since a timestamp
docker logs --since 2024-01-01T00:00:00 my-container

# With timestamps
docker logs -t my-container
```

### Debugging a running container

```bash
# Get a shell inside a running container
docker exec -it my-container sh        # Alpine
docker exec -it my-container bash      # Debian/Ubuntu

# Run a specific command
docker exec my-container cat /etc/hosts
docker exec my-container env

# View running processes
docker exec my-container ps aux
docker top my-container

# Check resource usage
docker stats my-container

# View filesystem changes (since image was built)
docker diff my-container
```

### Debugging a crashed container

```bash
# Check exit code and error
docker inspect my-container --format='{{.State.ExitCode}}'
docker inspect my-container --format='{{.State.Error}}'

# Start a container that crashes immediately — override the command
docker run -it --entrypoint sh myapp

# Or create a container without starting it, then start with shell
docker create --name debug myapp
docker start -ai debug
```

### Common exit codes

| Code | Meaning                                         |
| ---- | ----------------------------------------------- |
| 0    | Success (normal exit)                           |
| 1    | Application error                               |
| 137  | Killed (OOM or `docker kill` — SIGKILL)         |
| 143  | Terminated gracefully (`docker stop` — SIGTERM) |
| 126  | Permission denied (can't execute command)       |
| 127  | Command not found                               |

---

## Image Optimization

### Size reduction strategies

1. **Use Alpine or slim base images**

   ```dockerfile
   # Instead of: FROM node:20       (~350MB)
   # Use:        FROM node:20-slim  (~80MB)
   # Or:         FROM node:20-alpine (~50MB)
   ```

2. **Combine RUN commands** (fewer layers)

   ```dockerfile
   # Bad: 3 layers
   RUN apt-get update
   RUN apt-get install -y curl
   RUN rm -rf /var/lib/apt/lists/*

   # Good: 1 layer
   RUN apt-get update && \
       apt-get install -y --no-install-recommends curl && \
       rm -rf /var/lib/apt/lists/*
   ```

3. **Clean up in the same layer**

   ```dockerfile
   RUN pip install --no-cache-dir -r requirements.txt
   RUN npm ci && npm cache clean --force
   RUN apk add --no-cache git
   ```

4. **Use multi-stage builds** (see section above)

5. **Order instructions by change frequency** (most stable first)

   ```dockerfile
   # Rarely changes — cached
   FROM node:20-alpine
   WORKDIR /app

   # Changes when dependencies change
   COPY package*.json ./
   RUN npm ci --only=production

   # Changes frequently — last so it doesn't bust cache
   COPY src/ ./src/
   ```

6. **Use .dockerignore** to keep build context small

### Check image size

```bash
docker images myapp
docker history myapp:latest    # See size per layer
docker system df               # Overall disk usage
```

### Analyze image layers

```bash
# Use dive (third-party tool) for interactive layer analysis
# Install: brew install dive (macOS) or see github.com/wagoodman/dive
dive myapp:latest
```

---

## Security Best Practices

### 1. Don't run as root

```dockerfile
# Create a non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser
```

### 2. Pin image versions

```dockerfile
# Bad — unpredictable
FROM node:latest

# Good — reproducible
FROM node:20.11.1-alpine3.19
```

### 3. Scan for vulnerabilities

```bash
# Built-in scanning (Docker Desktop)
docker scout cves myapp:latest

# Or use Trivy (open source)
trivy image myapp:latest
```

### 4. Use minimal base images

Fewer packages = fewer potential vulnerabilities.

```
node:20         → 350MB, ~200 CVEs
node:20-slim    → 80MB,  ~50 CVEs
node:20-alpine  → 50MB,  ~5 CVEs
distroless      → 20MB,  ~2 CVEs
```

### 5. Never put secrets in images

```dockerfile
# NEVER do this — secrets visible in docker history
ENV API_KEY=sk-12345
COPY .env /app/.env

# Instead: pass at runtime
# docker run -e API_KEY=sk-12345 myapp
# docker run --env-file .env myapp
```

### 6. Use read-only filesystem when possible

```bash
docker run --read-only --tmpfs /tmp myapp
```

### 7. Set resource limits

```bash
docker run --memory=512m --cpus=1.0 myapp
```

### 8. Keep images updated

```bash
# Rebuild regularly to get security patches
docker build --no-cache -t myapp .
# Or pull latest base image first
docker pull node:20-alpine
docker build -t myapp .
```

---

## Docker in CI/CD

### GitHub Actions example

```yaml
name: Build and Push

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to Docker Hub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: |
            myuser/myapp:latest
            myuser/myapp:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

### Layer caching in CI

```bash
# Pull previous image to use as cache source
docker pull myregistry/myapp:latest || true
docker build \
  --cache-from myregistry/myapp:latest \
  -t myregistry/myapp:$COMMIT_SHA \
  -t myregistry/myapp:latest \
  .
docker push myregistry/myapp:$COMMIT_SHA
docker push myregistry/myapp:latest
```

---

## Container Orchestration Overview

When you need to run containers in production at scale, you need an orchestrator.

| Tool             | Complexity | Use case                              |
| ---------------- | ---------- | ------------------------------------- |
| Docker Compose   | Low        | Local dev, single-host deployments    |
| Docker Swarm     | Medium     | Simple multi-host orchestration       |
| Kubernetes (K8s) | High       | Production-grade, large-scale systems |
| AWS ECS/Fargate  | Medium     | AWS-managed container platform        |
| Google Cloud Run | Low        | Serverless containers                 |
| Fly.io / Railway | Low        | Simple deployment platforms           |

Orchestrators handle:

- **Scaling** — run N replicas of a service
- **Load balancing** — distribute traffic across replicas
- **Self-healing** — restart crashed containers automatically
- **Rolling updates** — deploy new versions with zero downtime
- **Service discovery** — containers find each other by name
- **Secret management** — securely inject credentials

---

## Common Pitfalls

### 1. "Why is my build so slow?"

Your build context is too large. Check with:

```bash
# See what's being sent to Docker
docker build . 2>&1 | head -5
# "Sending build context to Docker daemon  500MB"
```

Fix: Add a `.dockerignore` file to exclude `node_modules`, `.git`, etc.

### 2. "My container exits immediately"

The main process (CMD/ENTRYPOINT) exited. Common causes:

- The process runs in the background (daemonizes). Containers need a foreground process.
- The process crashes. Check `docker logs <container>`.

Fix: Run the process in the foreground:

```dockerfile
# Nginx
CMD ["nginx", "-g", "daemon off;"]

# Apache
CMD ["apachectl", "-D", "FOREGROUND"]
```

### 3. "Changes to my code aren't showing up"

Docker layer caching served an old layer. Fix:

```bash
# Rebuild without cache
docker build --no-cache -t myapp .

# Or just the affected layers
docker compose up --build
```

### 4. "I can't connect to my container"

- Did you map the port? `docker run -p 8080:3000`
- Is the app listening on `0.0.0.0`, not `127.0.0.1`?

  ```javascript
  // Wrong: only accessible from inside the container
  app.listen(3000, "127.0.0.1");

  // Right: accessible from outside
  app.listen(3000, "0.0.0.0");
  ```

### 5. "My node_modules are missing with bind mounts"

Bind mount overwrites the container's `/app` directory:

```yaml
volumes:
  - ./:/app # Overwrites everything, including node_modules
  - /app/node_modules # Fix: anonymous volume preserves container's node_modules
```

### 6. "Permission denied on mounted files"

Host file UIDs don't match container user UIDs. Fix:

```dockerfile
# Match container user to host user
ARG UID=1000
ARG GID=1000
RUN addgroup -g $GID appgroup && adduser -u $UID -G appgroup -D appuser
USER appuser
```

### 7. "My image is huge"

See [Image Optimization](#image-optimization). Quick wins:

- Switch to `alpine` or `slim` base
- Add `.dockerignore`
- Use multi-stage builds
- Clean up package manager caches in the same `RUN` layer

### 8. "Container runs fine locally but fails in production"

- Check environment variables are set in production
- Ensure volumes exist for persistent data
- Check DNS/networking differences
- Compare Docker versions: `docker version`

---

## Cheat Sheet

### Lifecycle

```
Dockerfile → [build] → Image → [run] → Container
                         ↓                  ↓
                      [push]            [commit]
                         ↓                  ↓
                      Registry           New Image
```

### Most-used commands

```bash
docker build -t name:tag .             # Build image
docker run -d -p 8080:3000 name:tag    # Run container
docker ps                              # List running containers
docker logs -f <container>             # Follow logs
docker exec -it <container> sh         # Shell into container
docker stop <container>                # Stop container
docker rm <container>                  # Remove container
docker images                          # List images
docker rmi <image>                     # Remove image
docker system prune -a                 # Clean everything
docker compose up -d                   # Start compose stack
docker compose down                    # Stop compose stack
docker compose logs -f                 # Follow compose logs
```

### Port mapping

```
-p 8080:3000        host 8080 → container 3000
-p 3000             random host port → container 3000
-p 127.0.0.1:8080:3000  localhost only
```

### Volume mounting

```
-v name:/path       named volume
-v /host:/container bind mount
-v /container/path  anonymous volume
--tmpfs /path       in-memory mount
```

### Dockerfile instruction order (optimal caching)

```
FROM           ← rarely changes
WORKDIR        ← rarely changes
COPY deps      ← changes when dependencies update
RUN install    ← re-runs when deps change
COPY code      ← changes most often (last = fewest cache busts)
CMD            ← rarely changes
```

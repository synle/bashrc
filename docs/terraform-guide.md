# Terraform Guide

Terraform is an infrastructure-as-code (IaC) tool by HashiCorp. You define resources in `.tf` files, and Terraform creates, updates, or deletes them to match your desired state.

## Installation

```bash
# macOS
brew install terraform

# Ubuntu/Debian
curl -fsSL https://apt.releases.hashicorp.com/gpg | sudo gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list
sudo apt update && sudo apt install terraform

# Windows (scoop)
scoop install terraform
```

## Core Concepts

| Concept      | Description                                                 |
| ------------ | ----------------------------------------------------------- |
| **Provider** | Plugin that talks to an API (AWS, Azure, Docker, etc.)      |
| **Resource** | A thing Terraform manages (VM, container, DNS record)       |
| **State**    | Terraform's record of what it created (`terraform.tfstate`) |
| **Plan**     | Preview of what Terraform will change                       |
| **Apply**    | Execute the plan and make changes                           |
| **Module**   | Reusable group of resources                                 |

## Core Commands

```bash
terraform init      # Download providers and initialize
terraform plan      # Preview changes
terraform apply     # Apply changes (prompts for confirmation)
terraform destroy   # Tear down all managed resources
terraform fmt       # Format .tf files
terraform validate  # Check syntax
terraform output    # Show output values
terraform state list  # List resources in state
```

## Project Structure

```
project/
  main.tf          # Resources
  variables.tf     # Input variables
  outputs.tf       # Output values
  providers.tf     # Provider configuration
  terraform.tfvars # Variable values (don't commit secrets)
```

## Basic Syntax

```hcl
# variables.tf
variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "dev"
}

# main.tf
resource "type" "name" {
  argument = "value"
  tags = {
    env = var.environment
  }
}

# outputs.tf
output "instance_ip" {
  value = resource_type.name.attribute
}
```

---

## AWS

Provider: `hashicorp/aws`

### Setup

```hcl
# providers.tf
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"
}
```

Authentication — Terraform uses the AWS CLI credentials. Run `aws configure` first, or set environment variables:

```bash
export AWS_ACCESS_KEY_ID="your-key"
export AWS_SECRET_ACCESS_KEY="your-secret"
export AWS_REGION="us-east-1"
```

### Example: EC2 Instance + Security Group

```hcl
# main.tf
resource "aws_security_group" "web" {
  name        = "web-sg"
  description = "Allow HTTP and SSH"

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_instance" "web" {
  ami                    = "ami-0c02fb55956c7d316" # Amazon Linux 2
  instance_type          = "t3.micro"
  vpc_security_group_ids = [aws_security_group.web.id]

  tags = {
    Name = "web-server"
  }
}

# outputs.tf
output "public_ip" {
  value = aws_instance.web.public_ip
}
```

### Example: S3 Bucket

```hcl
resource "aws_s3_bucket" "data" {
  bucket = "my-unique-bucket-name"

  tags = {
    Environment = "dev"
  }
}

resource "aws_s3_bucket_versioning" "data" {
  bucket = aws_s3_bucket.data.id
  versioning_configuration {
    status = "Enabled"
  }
}
```

---

## Azure

Provider: `hashicorp/azurerm`

### Setup

```hcl
# providers.tf
terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
  }
}

provider "azurerm" {
  features {}
  subscription_id = var.subscription_id
}
```

Authentication — log in with Azure CLI first:

```bash
az login
az account set --subscription "your-subscription-id"
```

### Example: Resource Group + Virtual Machine

```hcl
# variables.tf
variable "subscription_id" {
  description = "Azure subscription ID"
  type        = string
}

variable "admin_password" {
  description = "VM admin password"
  type        = string
  sensitive   = true
}

# main.tf
resource "azurerm_resource_group" "rg" {
  name     = "my-rg"
  location = "East US"
}

resource "azurerm_virtual_network" "vnet" {
  name                = "my-vnet"
  address_space       = ["10.0.0.0/16"]
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
}

resource "azurerm_subnet" "subnet" {
  name                 = "my-subnet"
  resource_group_name  = azurerm_resource_group.rg.name
  virtual_network_name = azurerm_virtual_network.vnet.name
  address_prefixes     = ["10.0.1.0/24"]
}

resource "azurerm_network_interface" "nic" {
  name                = "my-nic"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name

  ip_configuration {
    name                          = "internal"
    subnet_id                     = azurerm_subnet.subnet.id
    private_ip_address_allocation = "Dynamic"
  }
}

resource "azurerm_linux_virtual_machine" "vm" {
  name                            = "my-vm"
  resource_group_name             = azurerm_resource_group.rg.name
  location                        = azurerm_resource_group.rg.location
  size                            = "Standard_B1s"
  admin_username                  = "adminuser"
  admin_password                  = var.admin_password
  disable_password_authentication = false
  network_interface_ids           = [azurerm_network_interface.nic.id]

  os_disk {
    caching              = "ReadWrite"
    storage_account_type = "Standard_LRS"
  }

  source_image_reference {
    publisher = "Canonical"
    offer     = "0001-com-ubuntu-server-jammy"
    sku       = "22_04-lts"
    version   = "latest"
  }
}

# outputs.tf
output "private_ip" {
  value = azurerm_network_interface.nic.private_ip_address
}
```

---

## Google Cloud

Provider: `hashicorp/google`

### Setup

```hcl
# providers.tf
terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = "us-central1"
}
```

Authentication — log in with gcloud CLI first:

```bash
gcloud auth application-default login
gcloud config set project your-project-id
```

### Example: Compute Instance

```hcl
# variables.tf
variable "project_id" {
  description = "GCP project ID"
  type        = string
}

# main.tf
resource "google_compute_network" "vpc" {
  name                    = "my-vpc"
  auto_create_subnetworks = true
}

resource "google_compute_firewall" "ssh" {
  name    = "allow-ssh"
  network = google_compute_network.vpc.name

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  source_ranges = ["0.0.0.0/0"]
}

resource "google_compute_instance" "vm" {
  name         = "my-vm"
  machine_type = "e2-micro"
  zone         = "us-central1-a"

  boot_disk {
    initialize_params {
      image = "debian-cloud/debian-12"
    }
  }

  network_interface {
    network = google_compute_network.vpc.name
    access_config {} # gives it an external IP
  }
}

# outputs.tf
output "external_ip" {
  value = google_compute_instance.vm.network_interface[0].access_config[0].nat_ip
}
```

### Example: Cloud Storage Bucket

```hcl
resource "google_storage_bucket" "data" {
  name     = "my-unique-bucket-name"
  location = "US"

  versioning {
    enabled = true
  }
}
```

---

## Docker

Provider: `kreuzwerker/docker`

Manages containers, images, networks, and volumes on a Docker host. Good for local dev environments or managing Docker hosts directly.

### Setup

```hcl
# providers.tf
terraform {
  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "~> 3.0"
    }
  }
}

provider "docker" {
  # Uses local Docker socket by default (unix:///var/run/docker.sock)
  # For remote hosts:
  # host = "tcp://remote-host:2376/"
}
```

Requires Docker to be running on the machine.

### Example: Nginx Container with Network

```hcl
# main.tf
resource "docker_network" "web" {
  name = "web-network"
}

resource "docker_image" "nginx" {
  name         = "nginx:latest"
  keep_locally = false
}

resource "docker_container" "web" {
  name  = "web-server"
  image = docker_image.nginx.image_id

  ports {
    internal = 80
    external = 8080
  }

  networks_advanced {
    name = docker_network.web.name
  }

  volumes {
    host_path      = "/path/to/html"
    container_path = "/usr/share/nginx/html"
    read_only      = true
  }

  restart = "unless-stopped"
}

# outputs.tf
output "container_id" {
  value = docker_container.web.id
}
```

### Example: Multi-Container Setup (App + Database)

```hcl
resource "docker_network" "app" {
  name = "app-network"
}

resource "docker_volume" "db_data" {
  name = "postgres-data"
}

resource "docker_image" "postgres" {
  name = "postgres:16"
}

resource "docker_container" "db" {
  name  = "app-db"
  image = docker_image.postgres.image_id

  networks_advanced {
    name = docker_network.app.name
  }

  volumes {
    volume_name    = docker_volume.db_data.name
    container_path = "/var/lib/postgresql/data"
  }

  env = [
    "POSTGRES_USER=app",
    "POSTGRES_PASSWORD=secret",
    "POSTGRES_DB=appdb",
  ]

  restart = "unless-stopped"
}

resource "docker_image" "app" {
  name = "my-app:latest"
}

resource "docker_container" "app" {
  name  = "app-server"
  image = docker_image.app.image_id

  ports {
    internal = 3000
    external = 3000
  }

  networks_advanced {
    name = docker_network.app.name
  }

  env = [
    "DATABASE_URL=postgres://app:secret@app-db:5432/appdb",
  ]

  depends_on = [docker_container.db]
  restart    = "unless-stopped"
}
```

---

## Kubernetes

Provider: `hashicorp/kubernetes`

Manages Kubernetes resources — deployments, services, configmaps, secrets, namespaces, and more. Use alongside the `hashicorp/helm` provider for Helm chart releases.

### Setup

```hcl
# providers.tf
terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.0"
    }
  }
}

provider "kubernetes" {
  # Uses ~/.kube/config by default
  # For explicit config:
  # config_path = "~/.kube/config"
  # config_context = "my-cluster"
}

provider "helm" {
  kubernetes {
    config_path = "~/.kube/config"
  }
}
```

Requires a running cluster and valid kubeconfig. Run `kubectl cluster-info` to verify.

### Example: Namespace + Deployment + Service

```hcl
# main.tf
resource "kubernetes_namespace" "app" {
  metadata {
    name = "my-app"
    labels = {
      environment = "dev"
    }
  }
}

resource "kubernetes_config_map" "app" {
  metadata {
    name      = "app-config"
    namespace = kubernetes_namespace.app.metadata[0].name
  }

  data = {
    APP_ENV      = "production"
    LOG_LEVEL    = "info"
    DATABASE_URL = "postgres://db:5432/app"
  }
}

resource "kubernetes_secret" "app" {
  metadata {
    name      = "app-secrets"
    namespace = kubernetes_namespace.app.metadata[0].name
  }

  data = {
    api-key     = base64encode("my-secret-key")
    db-password = base64encode("secret")
  }

  type = "Opaque"
}

resource "kubernetes_deployment" "app" {
  metadata {
    name      = "web-app"
    namespace = kubernetes_namespace.app.metadata[0].name
    labels = {
      app = "web-app"
    }
  }

  spec {
    replicas = 3

    selector {
      match_labels = {
        app = "web-app"
      }
    }

    template {
      metadata {
        labels = {
          app = "web-app"
        }
      }

      spec {
        container {
          name  = "app"
          image = "nginx:latest"

          port {
            container_port = 80
          }

          env_from {
            config_map_ref {
              name = kubernetes_config_map.app.metadata[0].name
            }
          }

          env_from {
            secret_ref {
              name = kubernetes_secret.app.metadata[0].name
            }
          }

          resources {
            requests = {
              cpu    = "100m"
              memory = "128Mi"
            }
            limits = {
              cpu    = "500m"
              memory = "256Mi"
            }
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "app" {
  metadata {
    name      = "web-app"
    namespace = kubernetes_namespace.app.metadata[0].name
  }

  spec {
    selector = {
      app = "web-app"
    }

    port {
      port        = 80
      target_port = 80
    }

    type = "LoadBalancer"
  }
}

# outputs.tf
output "service_ip" {
  value = kubernetes_service.app.status[0].load_balancer[0].ingress[0].ip
}
```

### Example: Helm Chart Release

```hcl
resource "helm_release" "nginx_ingress" {
  name       = "nginx-ingress"
  repository = "https://kubernetes.github.io/ingress-nginx"
  chart      = "ingress-nginx"
  namespace  = "ingress-nginx"

  create_namespace = true

  set {
    name  = "controller.replicaCount"
    value = "2"
  }

  set {
    name  = "controller.service.type"
    value = "LoadBalancer"
  }
}

resource "helm_release" "prometheus" {
  name       = "prometheus"
  repository = "https://prometheus-community.github.io/helm-charts"
  chart      = "kube-prometheus-stack"
  namespace  = "monitoring"

  create_namespace = true

  values = [
    file("prometheus-values.yaml")
  ]
}
```

---

## Real-World Setup: Express + React (Node Full Stack)

A typical full-stack JavaScript app: Express API backend, React frontend (served by Nginx), and PostgreSQL database.

### Docker

```hcl
# providers.tf
terraform {
  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "~> 3.0"
    }
  }
}

provider "docker" {}

# main.tf
resource "docker_network" "fullstack" {
  name = "fullstack-network"
}

resource "docker_volume" "pg_data" {
  name = "pg-data"
}

# --- PostgreSQL ---
resource "docker_image" "postgres" {
  name = "postgres:16"
}

resource "docker_container" "postgres" {
  name  = "fullstack-db"
  image = docker_image.postgres.image_id

  networks_advanced {
    name = docker_network.fullstack.name
  }

  volumes {
    volume_name    = docker_volume.pg_data.name
    container_path = "/var/lib/postgresql/data"
  }

  env = [
    "POSTGRES_USER=app",
    "POSTGRES_PASSWORD=secret",
    "POSTGRES_DB=fullstack",
  ]

  restart = "unless-stopped"
}

# --- Express API ---
resource "docker_image" "api" {
  name = "fullstack-api:latest"
}

resource "docker_container" "api" {
  name  = "fullstack-api"
  image = docker_image.api.image_id

  ports {
    internal = 4000
    external = 4000
  }

  networks_advanced {
    name = docker_network.fullstack.name
  }

  env = [
    "DATABASE_URL=postgres://app:secret@fullstack-db:5432/fullstack",
    "NODE_ENV=production",
    "PORT=4000",
  ]

  depends_on = [docker_container.postgres]
  restart    = "unless-stopped"
}

# --- React Frontend (Nginx) ---
resource "docker_image" "frontend" {
  name = "fullstack-frontend:latest"
}

resource "docker_container" "frontend" {
  name  = "fullstack-frontend"
  image = docker_image.frontend.image_id

  ports {
    internal = 80
    external = 3000
  }

  networks_advanced {
    name = docker_network.fullstack.name
  }

  restart = "unless-stopped"
}

# outputs.tf
output "frontend_url" {
  value = "http://localhost:3000"
}

output "api_url" {
  value = "http://localhost:4000"
}
```

Reference Dockerfiles for this setup:

```dockerfile
# api/Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 4000
CMD ["node", "server.js"]
```

```dockerfile
# frontend/Dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
# Proxy API requests to the backend
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

```nginx
# frontend/nginx.conf
server {
    listen 80;

    location / {
        root /usr/share/nginx/html;
        try_files $uri /index.html;
    }

    location /api/ {
        proxy_pass http://fullstack-api:4000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Kubernetes

```hcl
# providers.tf
terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
  }
}

provider "kubernetes" {}

# main.tf
resource "kubernetes_namespace" "fullstack" {
  metadata {
    name = "fullstack"
  }
}

# --- PostgreSQL ---
resource "kubernetes_secret" "db" {
  metadata {
    name      = "db-credentials"
    namespace = kubernetes_namespace.fullstack.metadata[0].name
  }

  data = {
    POSTGRES_USER     = base64encode("app")
    POSTGRES_PASSWORD = base64encode("secret")
    POSTGRES_DB       = base64encode("fullstack")
    DATABASE_URL      = base64encode("postgres://app:secret@postgres:5432/fullstack")
  }
}

resource "kubernetes_stateful_set" "postgres" {
  metadata {
    name      = "postgres"
    namespace = kubernetes_namespace.fullstack.metadata[0].name
  }

  spec {
    service_name = "postgres"
    replicas     = 1

    selector {
      match_labels = {
        app = "postgres"
      }
    }

    template {
      metadata {
        labels = {
          app = "postgres"
        }
      }

      spec {
        container {
          name  = "postgres"
          image = "postgres:16"

          port {
            container_port = 5432
          }

          env_from {
            secret_ref {
              name = kubernetes_secret.db.metadata[0].name
            }
          }

          volume_mount {
            name       = "pg-data"
            mount_path = "/var/lib/postgresql/data"
          }

          resources {
            requests = {
              cpu    = "250m"
              memory = "256Mi"
            }
            limits = {
              cpu    = "500m"
              memory = "512Mi"
            }
          }
        }
      }
    }

    volume_claim_template {
      metadata {
        name = "pg-data"
      }

      spec {
        access_modes = ["ReadWriteOnce"]

        resources {
          requests = {
            storage = "5Gi"
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "postgres" {
  metadata {
    name      = "postgres"
    namespace = kubernetes_namespace.fullstack.metadata[0].name
  }

  spec {
    selector = {
      app = "postgres"
    }

    port {
      port        = 5432
      target_port = 5432
    }

    cluster_ip = "None" # headless service for StatefulSet
  }
}

# --- Express API ---
resource "kubernetes_deployment" "api" {
  metadata {
    name      = "api"
    namespace = kubernetes_namespace.fullstack.metadata[0].name
  }

  spec {
    replicas = 2

    selector {
      match_labels = {
        app = "api"
      }
    }

    template {
      metadata {
        labels = {
          app = "api"
        }
      }

      spec {
        container {
          name  = "api"
          image = "fullstack-api:latest"

          port {
            container_port = 4000
          }

          env {
            name = "DATABASE_URL"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.db.metadata[0].name
                key  = "DATABASE_URL"
              }
            }
          }

          env {
            name  = "NODE_ENV"
            value = "production"
          }

          env {
            name  = "PORT"
            value = "4000"
          }

          resources {
            requests = {
              cpu    = "100m"
              memory = "128Mi"
            }
            limits = {
              cpu    = "500m"
              memory = "256Mi"
            }
          }

          liveness_probe {
            http_get {
              path = "/api/health"
              port = 4000
            }
            initial_delay_seconds = 10
            period_seconds        = 30
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "api" {
  metadata {
    name      = "api"
    namespace = kubernetes_namespace.fullstack.metadata[0].name
  }

  spec {
    selector = {
      app = "api"
    }

    port {
      port        = 4000
      target_port = 4000
    }
  }
}

# --- React Frontend ---
resource "kubernetes_deployment" "frontend" {
  metadata {
    name      = "frontend"
    namespace = kubernetes_namespace.fullstack.metadata[0].name
  }

  spec {
    replicas = 2

    selector {
      match_labels = {
        app = "frontend"
      }
    }

    template {
      metadata {
        labels = {
          app = "frontend"
        }
      }

      spec {
        container {
          name  = "frontend"
          image = "fullstack-frontend:latest"

          port {
            container_port = 80
          }

          resources {
            requests = {
              cpu    = "50m"
              memory = "64Mi"
            }
            limits = {
              cpu    = "200m"
              memory = "128Mi"
            }
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "frontend" {
  metadata {
    name      = "frontend"
    namespace = kubernetes_namespace.fullstack.metadata[0].name
  }

  spec {
    selector = {
      app = "frontend"
    }

    port {
      port        = 80
      target_port = 80
    }

    type = "LoadBalancer"
  }
}
```

---

## Real-World Setup: Flask + React (Python/JS Full Stack)

Python Flask API backend, React frontend, PostgreSQL, and Redis for session/cache. The same pattern works with **FastAPI** — swap `flask:latest` for your FastAPI image and change the port/healthcheck path. FastAPI is async-native and auto-generates OpenAPI docs at `/docs`, making it a better fit for new projects. Flask is more common in existing codebases.

### Docker

```hcl
# providers.tf
terraform {
  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "~> 3.0"
    }
  }
}

provider "docker" {}

# main.tf
resource "docker_network" "flask_app" {
  name = "flask-app-network"
}

resource "docker_volume" "pg_data" {
  name = "flask-pg-data"
}

resource "docker_volume" "redis_data" {
  name = "flask-redis-data"
}

# --- PostgreSQL ---
resource "docker_image" "postgres" {
  name = "postgres:16"
}

resource "docker_container" "postgres" {
  name  = "flask-db"
  image = docker_image.postgres.image_id

  networks_advanced {
    name = docker_network.flask_app.name
  }

  volumes {
    volume_name    = docker_volume.pg_data.name
    container_path = "/var/lib/postgresql/data"
  }

  env = [
    "POSTGRES_USER=flask",
    "POSTGRES_PASSWORD=secret",
    "POSTGRES_DB=flaskapp",
  ]

  restart = "unless-stopped"
}

# --- Redis ---
resource "docker_image" "redis" {
  name = "redis:7-alpine"
}

resource "docker_container" "redis" {
  name  = "flask-redis"
  image = docker_image.redis.image_id

  networks_advanced {
    name = docker_network.flask_app.name
  }

  volumes {
    volume_name    = docker_volume.redis_data.name
    container_path = "/data"
  }

  restart = "unless-stopped"
}

# --- Flask API ---
resource "docker_image" "flask_api" {
  name = "flask-api:latest"
}

resource "docker_container" "flask_api" {
  name  = "flask-api"
  image = docker_image.flask_api.image_id

  ports {
    internal = 5000
    external = 5000
  }

  networks_advanced {
    name = docker_network.flask_app.name
  }

  env = [
    "DATABASE_URL=postgres://flask:secret@flask-db:5432/flaskapp",
    "REDIS_URL=redis://flask-redis:6379/0",
    "FLASK_ENV=production",
  ]

  depends_on = [docker_container.postgres, docker_container.redis]
  restart    = "unless-stopped"
}

# --- React Frontend (Nginx) ---
resource "docker_image" "frontend" {
  name = "flask-frontend:latest"
}

resource "docker_container" "frontend" {
  name  = "flask-frontend"
  image = docker_image.frontend.image_id

  ports {
    internal = 80
    external = 3000
  }

  networks_advanced {
    name = docker_network.flask_app.name
  }

  restart = "unless-stopped"
}

# outputs.tf
output "frontend_url" {
  value = "http://localhost:3000"
}

output "api_url" {
  value = "http://localhost:5000"
}
```

Reference Dockerfiles:

```dockerfile
# api/Dockerfile (Flask)
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 5000
CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "app:create_app()"]
```

```dockerfile
# api/Dockerfile (FastAPI alternative)
# Same structure, different CMD:
# CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5000", "--workers", "4"]
# FastAPI auto-generates docs at /docs (Swagger) and /redoc (ReDoc).
```

```nginx
# frontend/nginx.conf
server {
    listen 80;

    location / {
        root /usr/share/nginx/html;
        try_files $uri /index.html;
    }

    location /api/ {
        proxy_pass http://flask-api:5000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Kubernetes

```hcl
# providers.tf
terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
  }
}

provider "kubernetes" {}

# main.tf
resource "kubernetes_namespace" "flask_app" {
  metadata {
    name = "flask-app"
  }
}

resource "kubernetes_secret" "db" {
  metadata {
    name      = "db-credentials"
    namespace = kubernetes_namespace.flask_app.metadata[0].name
  }

  data = {
    POSTGRES_USER     = base64encode("flask")
    POSTGRES_PASSWORD = base64encode("secret")
    POSTGRES_DB       = base64encode("flaskapp")
    DATABASE_URL      = base64encode("postgres://flask:secret@postgres:5432/flaskapp")
  }
}

# --- PostgreSQL (StatefulSet) ---
resource "kubernetes_stateful_set" "postgres" {
  metadata {
    name      = "postgres"
    namespace = kubernetes_namespace.flask_app.metadata[0].name
  }

  spec {
    service_name = "postgres"
    replicas     = 1

    selector {
      match_labels = {
        app = "postgres"
      }
    }

    template {
      metadata {
        labels = {
          app = "postgres"
        }
      }

      spec {
        container {
          name  = "postgres"
          image = "postgres:16"

          port {
            container_port = 5432
          }

          env_from {
            secret_ref {
              name = kubernetes_secret.db.metadata[0].name
            }
          }

          volume_mount {
            name       = "pg-data"
            mount_path = "/var/lib/postgresql/data"
          }
        }
      }
    }

    volume_claim_template {
      metadata {
        name = "pg-data"
      }

      spec {
        access_modes = ["ReadWriteOnce"]
        resources {
          requests = {
            storage = "5Gi"
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "postgres" {
  metadata {
    name      = "postgres"
    namespace = kubernetes_namespace.flask_app.metadata[0].name
  }

  spec {
    selector = {
      app = "postgres"
    }

    port {
      port        = 5432
      target_port = 5432
    }

    cluster_ip = "None"
  }
}

# --- Redis ---
resource "kubernetes_deployment" "redis" {
  metadata {
    name      = "redis"
    namespace = kubernetes_namespace.flask_app.metadata[0].name
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = "redis"
      }
    }

    template {
      metadata {
        labels = {
          app = "redis"
        }
      }

      spec {
        container {
          name  = "redis"
          image = "redis:7-alpine"

          port {
            container_port = 6379
          }

          resources {
            requests = {
              cpu    = "100m"
              memory = "128Mi"
            }
            limits = {
              cpu    = "250m"
              memory = "256Mi"
            }
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "redis" {
  metadata {
    name      = "redis"
    namespace = kubernetes_namespace.flask_app.metadata[0].name
  }

  spec {
    selector = {
      app = "redis"
    }

    port {
      port        = 6379
      target_port = 6379
    }
  }
}

# --- Flask API ---
# Note: For FastAPI, swap the image and change the health check path to /docs or /health.
resource "kubernetes_deployment" "api" {
  metadata {
    name      = "api"
    namespace = kubernetes_namespace.flask_app.metadata[0].name
  }

  spec {
    replicas = 2

    selector {
      match_labels = {
        app = "api"
      }
    }

    template {
      metadata {
        labels = {
          app = "api"
        }
      }

      spec {
        container {
          name  = "api"
          image = "flask-api:latest"

          port {
            container_port = 5000
          }

          env {
            name = "DATABASE_URL"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.db.metadata[0].name
                key  = "DATABASE_URL"
              }
            }
          }

          env {
            name  = "REDIS_URL"
            value = "redis://redis:6379/0"
          }

          env {
            name  = "FLASK_ENV"
            value = "production"
          }

          resources {
            requests = {
              cpu    = "100m"
              memory = "128Mi"
            }
            limits = {
              cpu    = "500m"
              memory = "256Mi"
            }
          }

          liveness_probe {
            http_get {
              path = "/api/health"
              port = 5000
            }
            initial_delay_seconds = 15
            period_seconds        = 30
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "api" {
  metadata {
    name      = "api"
    namespace = kubernetes_namespace.flask_app.metadata[0].name
  }

  spec {
    selector = {
      app = "api"
    }

    port {
      port        = 5000
      target_port = 5000
    }
  }
}

# --- React Frontend ---
resource "kubernetes_deployment" "frontend" {
  metadata {
    name      = "frontend"
    namespace = kubernetes_namespace.flask_app.metadata[0].name
  }

  spec {
    replicas = 2

    selector {
      match_labels = {
        app = "frontend"
      }
    }

    template {
      metadata {
        labels = {
          app = "frontend"
        }
      }

      spec {
        container {
          name  = "frontend"
          image = "flask-frontend:latest"

          port {
            container_port = 80
          }

          resources {
            requests = {
              cpu    = "50m"
              memory = "64Mi"
            }
            limits = {
              cpu    = "200m"
              memory = "128Mi"
            }
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "frontend" {
  metadata {
    name      = "frontend"
    namespace = kubernetes_namespace.flask_app.metadata[0].name
  }

  spec {
    selector = {
      app = "frontend"
    }

    port {
      port        = 80
      target_port = 80
    }

    type = "LoadBalancer"
  }
}
```

---

## Real-World Setup: Background Jobs (Temporal + Celery)

A system with two types of background workers: **Temporal** for durable, long-running workflows (Node.js workers) and **Celery** for fire-and-forget async tasks (Python workers). Both share a PostgreSQL database. Temporal uses its own persistence, Celery uses Redis as a broker.

**When to use which:**

| Use Case                                      | Tool     | Why                                                    |
| --------------------------------------------- | -------- | ------------------------------------------------------ |
| Multi-step workflows, retries, saga patterns  | Temporal | Built-in state management, timeouts, retries           |
| Simple async tasks (send email, resize image) | Celery   | Lightweight, fast, easy to add to existing Python apps |
| Cron-like scheduled jobs                      | Either   | Temporal has native schedules, Celery has `beat`       |

### Docker

```hcl
# providers.tf
terraform {
  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "~> 3.0"
    }
  }
}

provider "docker" {}

# main.tf
resource "docker_network" "jobs" {
  name = "jobs-network"
}

resource "docker_volume" "pg_data" {
  name = "jobs-pg-data"
}

resource "docker_volume" "redis_data" {
  name = "jobs-redis-data"
}

# --- PostgreSQL (shared by app and Temporal) ---
resource "docker_image" "postgres" {
  name = "postgres:16"
}

resource "docker_container" "postgres" {
  name  = "jobs-db"
  image = docker_image.postgres.image_id

  networks_advanced {
    name = docker_network.jobs.name
  }

  volumes {
    volume_name    = docker_volume.pg_data.name
    container_path = "/var/lib/postgresql/data"
  }

  env = [
    "POSTGRES_USER=admin",
    "POSTGRES_PASSWORD=secret",
    "POSTGRES_DB=appdb",
  ]

  restart = "unless-stopped"
}

# --- Redis (Celery broker) ---
resource "docker_image" "redis" {
  name = "redis:7-alpine"
}

resource "docker_container" "redis" {
  name  = "jobs-redis"
  image = docker_image.redis.image_id

  networks_advanced {
    name = docker_network.jobs.name
  }

  volumes {
    volume_name    = docker_volume.redis_data.name
    container_path = "/data"
  }

  restart = "unless-stopped"
}

# --- Temporal Server ---
resource "docker_image" "temporal" {
  name = "temporalio/auto-setup:latest"
}

resource "docker_container" "temporal" {
  name  = "temporal-server"
  image = docker_image.temporal.image_id

  ports {
    internal = 7233
    external = 7233
  }

  networks_advanced {
    name = docker_network.jobs.name
  }

  env = [
    "DB=postgres12",
    "DB_PORT=5432",
    "POSTGRES_USER=admin",
    "POSTGRES_PWD=secret",
    "POSTGRES_SEEDS=jobs-db",
  ]

  depends_on = [docker_container.postgres]
  restart    = "unless-stopped"
}

# --- Temporal UI ---
resource "docker_image" "temporal_ui" {
  name = "temporalio/ui:latest"
}

resource "docker_container" "temporal_ui" {
  name  = "temporal-ui"
  image = docker_image.temporal_ui.image_id

  ports {
    internal = 8080
    external = 8080
  }

  networks_advanced {
    name = docker_network.jobs.name
  }

  env = [
    "TEMPORAL_ADDRESS=temporal-server:7233",
  ]

  depends_on = [docker_container.temporal]
  restart    = "unless-stopped"
}

# --- Node.js Temporal Worker ---
resource "docker_image" "temporal_worker" {
  name = "temporal-worker-node:latest"
}

resource "docker_container" "temporal_worker" {
  name  = "temporal-worker"
  image = docker_image.temporal_worker.image_id

  networks_advanced {
    name = docker_network.jobs.name
  }

  env = [
    "TEMPORAL_ADDRESS=temporal-server:7233",
    "TEMPORAL_NAMESPACE=default",
    "TEMPORAL_TASK_QUEUE=main-queue",
    "DATABASE_URL=postgres://admin:secret@jobs-db:5432/appdb",
  ]

  depends_on = [docker_container.temporal]
  restart    = "unless-stopped"
}

# --- Python Celery Worker ---
resource "docker_image" "celery_worker" {
  name = "celery-worker-python:latest"
}

resource "docker_container" "celery_worker" {
  name  = "celery-worker"
  image = docker_image.celery_worker.image_id

  networks_advanced {
    name = docker_network.jobs.name
  }

  env = [
    "CELERY_BROKER_URL=redis://jobs-redis:6379/0",
    "CELERY_RESULT_BACKEND=redis://jobs-redis:6379/1",
    "DATABASE_URL=postgres://admin:secret@jobs-db:5432/appdb",
  ]

  depends_on = [docker_container.redis, docker_container.postgres]
  restart    = "unless-stopped"
}

# --- Celery Beat (scheduler) ---
resource "docker_container" "celery_beat" {
  name  = "celery-beat"
  image = docker_image.celery_worker.image_id # same image, different command

  networks_advanced {
    name = docker_network.jobs.name
  }

  command = ["celery", "-A", "tasks", "beat", "--loglevel=info"]

  env = [
    "CELERY_BROKER_URL=redis://jobs-redis:6379/0",
    "CELERY_RESULT_BACKEND=redis://jobs-redis:6379/1",
  ]

  depends_on = [docker_container.redis]
  restart    = "unless-stopped"
}

# --- Flower (Celery monitoring UI) ---
resource "docker_image" "flower" {
  name = "mher/flower:latest"
}

resource "docker_container" "flower" {
  name  = "celery-flower"
  image = docker_image.flower.image_id

  ports {
    internal = 5555
    external = 5555
  }

  networks_advanced {
    name = docker_network.jobs.name
  }

  env = [
    "CELERY_BROKER_URL=redis://jobs-redis:6379/0",
  ]

  depends_on = [docker_container.redis]
  restart    = "unless-stopped"
}

# outputs.tf
output "temporal_ui_url" {
  value = "http://localhost:8080"
}

output "flower_url" {
  value = "http://localhost:5555"
}
```

Reference Dockerfiles:

```dockerfile
# temporal-worker/Dockerfile (Node.js)
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
CMD ["node", "worker.js"]
```

```dockerfile
# celery-worker/Dockerfile (Python)
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["celery", "-A", "tasks", "worker", "--loglevel=info", "--concurrency=4"]
```

### Kubernetes

```hcl
# providers.tf
terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.0"
    }
  }
}

provider "kubernetes" {}
provider "helm" {
  kubernetes {
    config_path = "~/.kube/config"
  }
}

# main.tf
resource "kubernetes_namespace" "jobs" {
  metadata {
    name = "background-jobs"
  }
}

resource "kubernetes_secret" "shared" {
  metadata {
    name      = "shared-credentials"
    namespace = kubernetes_namespace.jobs.metadata[0].name
  }

  data = {
    DATABASE_URL   = base64encode("postgres://admin:secret@postgres:5432/appdb")
    REDIS_URL      = base64encode("redis://redis:6379/0")
    CELERY_BROKER  = base64encode("redis://redis:6379/0")
    CELERY_BACKEND = base64encode("redis://redis:6379/1")
  }
}

# --- PostgreSQL ---
resource "kubernetes_stateful_set" "postgres" {
  metadata {
    name      = "postgres"
    namespace = kubernetes_namespace.jobs.metadata[0].name
  }

  spec {
    service_name = "postgres"
    replicas     = 1

    selector {
      match_labels = {
        app = "postgres"
      }
    }

    template {
      metadata {
        labels = {
          app = "postgres"
        }
      }

      spec {
        container {
          name  = "postgres"
          image = "postgres:16"

          port {
            container_port = 5432
          }

          env {
            name  = "POSTGRES_USER"
            value = "admin"
          }

          env {
            name  = "POSTGRES_PASSWORD"
            value = "secret"
          }

          env {
            name  = "POSTGRES_DB"
            value = "appdb"
          }

          volume_mount {
            name       = "pg-data"
            mount_path = "/var/lib/postgresql/data"
          }
        }
      }
    }

    volume_claim_template {
      metadata {
        name = "pg-data"
      }

      spec {
        access_modes = ["ReadWriteOnce"]
        resources {
          requests = {
            storage = "10Gi"
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "postgres" {
  metadata {
    name      = "postgres"
    namespace = kubernetes_namespace.jobs.metadata[0].name
  }

  spec {
    selector = {
      app = "postgres"
    }

    port {
      port        = 5432
      target_port = 5432
    }

    cluster_ip = "None"
  }
}

# --- Redis ---
resource "kubernetes_deployment" "redis" {
  metadata {
    name      = "redis"
    namespace = kubernetes_namespace.jobs.metadata[0].name
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = "redis"
      }
    }

    template {
      metadata {
        labels = {
          app = "redis"
        }
      }

      spec {
        container {
          name  = "redis"
          image = "redis:7-alpine"

          port {
            container_port = 6379
          }

          resources {
            requests = {
              cpu    = "100m"
              memory = "128Mi"
            }
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "redis" {
  metadata {
    name      = "redis"
    namespace = kubernetes_namespace.jobs.metadata[0].name
  }

  spec {
    selector = {
      app = "redis"
    }

    port {
      port        = 6379
      target_port = 6379
    }
  }
}

# --- Temporal (via Helm) ---
resource "helm_release" "temporal" {
  name       = "temporal"
  repository = "https://go.temporal.io/helm-charts"
  chart      = "temporal"
  namespace  = kubernetes_namespace.jobs.metadata[0].name

  set {
    name  = "server.replicaCount"
    value = "1"
  }

  set {
    name  = "cassandra.config.cluster_size"
    value = "1"
  }

  set {
    name  = "prometheus.enabled"
    value = "false"
  }

  set {
    name  = "grafana.enabled"
    value = "false"
  }

  set {
    name  = "elasticsearch.enabled"
    value = "false"
  }
}

# --- Node.js Temporal Worker ---
resource "kubernetes_deployment" "temporal_worker" {
  metadata {
    name      = "temporal-worker"
    namespace = kubernetes_namespace.jobs.metadata[0].name
  }

  spec {
    replicas = 2

    selector {
      match_labels = {
        app = "temporal-worker"
      }
    }

    template {
      metadata {
        labels = {
          app = "temporal-worker"
        }
      }

      spec {
        container {
          name  = "worker"
          image = "temporal-worker-node:latest"

          env {
            name  = "TEMPORAL_ADDRESS"
            value = "temporal-frontend.${kubernetes_namespace.jobs.metadata[0].name}:7233"
          }

          env {
            name  = "TEMPORAL_NAMESPACE"
            value = "default"
          }

          env {
            name  = "TEMPORAL_TASK_QUEUE"
            value = "main-queue"
          }

          env {
            name = "DATABASE_URL"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.shared.metadata[0].name
                key  = "DATABASE_URL"
              }
            }
          }

          resources {
            requests = {
              cpu    = "200m"
              memory = "256Mi"
            }
            limits = {
              cpu    = "500m"
              memory = "512Mi"
            }
          }
        }
      }
    }
  }
}

# --- Python Celery Worker ---
resource "kubernetes_deployment" "celery_worker" {
  metadata {
    name      = "celery-worker"
    namespace = kubernetes_namespace.jobs.metadata[0].name
  }

  spec {
    replicas = 3

    selector {
      match_labels = {
        app = "celery-worker"
      }
    }

    template {
      metadata {
        labels = {
          app = "celery-worker"
        }
      }

      spec {
        container {
          name  = "worker"
          image = "celery-worker-python:latest"

          env {
            name = "CELERY_BROKER_URL"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.shared.metadata[0].name
                key  = "CELERY_BROKER"
              }
            }
          }

          env {
            name = "CELERY_RESULT_BACKEND"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.shared.metadata[0].name
                key  = "CELERY_BACKEND"
              }
            }
          }

          env {
            name = "DATABASE_URL"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.shared.metadata[0].name
                key  = "DATABASE_URL"
              }
            }
          }

          resources {
            requests = {
              cpu    = "200m"
              memory = "256Mi"
            }
            limits = {
              cpu    = "500m"
              memory = "512Mi"
            }
          }
        }
      }
    }
  }
}

# --- Celery Beat (scheduled tasks) ---
resource "kubernetes_deployment" "celery_beat" {
  metadata {
    name      = "celery-beat"
    namespace = kubernetes_namespace.jobs.metadata[0].name
  }

  spec {
    replicas = 1 # only one beat scheduler

    selector {
      match_labels = {
        app = "celery-beat"
      }
    }

    template {
      metadata {
        labels = {
          app = "celery-beat"
        }
      }

      spec {
        container {
          name    = "beat"
          image   = "celery-worker-python:latest"
          command = ["celery", "-A", "tasks", "beat", "--loglevel=info"]

          env {
            name = "CELERY_BROKER_URL"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.shared.metadata[0].name
                key  = "CELERY_BROKER"
              }
            }
          }

          resources {
            requests = {
              cpu    = "50m"
              memory = "64Mi"
            }
          }
        }
      }
    }
  }
}
```

---

## Remote State

By default, Terraform stores state locally in `terraform.tfstate`. For team use, store it remotely:

### AWS S3

```hcl
terraform {
  backend "s3" {
    bucket = "my-terraform-state"
    key    = "project/terraform.tfstate"
    region = "us-east-1"
  }
}
```

### Azure Blob Storage

```hcl
terraform {
  backend "azurerm" {
    resource_group_name  = "terraform-state-rg"
    storage_account_name = "tfstate"
    container_name       = "state"
    key                  = "terraform.tfstate"
  }
}
```

### Google Cloud Storage

```hcl
terraform {
  backend "gcs" {
    bucket = "my-terraform-state"
    prefix = "project"
  }
}
```

---

## Tips

- **Never commit `terraform.tfstate`** — it contains secrets. Add it to `.gitignore`.
- **Never commit `terraform.tfvars`** if it has secrets. Use environment variables or a secrets manager instead.
- **Lock your provider versions** — use `~> X.0` to allow minor updates but prevent breaking changes.
- **Use `terraform plan` before `terraform apply`** — always review what will change.
- **Use `terraform fmt`** — keeps HCL files consistently formatted.
- **Use workspaces** for managing multiple environments (dev/staging/prod) with the same config.
- **Use modules** to avoid duplicating resource blocks across projects.

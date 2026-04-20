# Vultr & DigitalOcean Hosting Guide

Set up real-world applications on Vultr and DigitalOcean using Terraform. Covers three deployment patterns: Node full stack (Express + React), Python/JS full stack (Flask + React), and background job workers (Temporal + Celery).

Both Vultr and DigitalOcean offer similar products at comparable pricing. Vultr has more datacenter locations and bare metal options. DigitalOcean has a more polished UI and better managed database/Kubernetes experience.

## Prerequisites

```bash
# Install Terraform
brew install terraform    # macOS
scoop install terraform   # Windows

# Get API tokens
# Vultr:        https://my.vultr.com/settings/#settingsapi
# DigitalOcean: https://cloud.digitalocean.com/account/api/tokens
```

---

# Vultr

Provider: `vultr/vultr`

## Setup

```hcl
# providers.tf
terraform {
  required_providers {
    vultr = {
      source  = "vultr/vultr"
      version = "~> 2.0"
    }
  }
}

provider "vultr" {
  api_key = var.vultr_api_key
}

# variables.tf
variable "vultr_api_key" {
  description = "Vultr API key"
  type        = string
  sensitive   = true
}

variable "region" {
  description = "Vultr region"
  type        = string
  default     = "ewr" # New Jersey
}

variable "ssh_key_path" {
  description = "Path to SSH public key"
  type        = string
  default     = "~/.ssh/id_ed25519.pub"
}
```

Authentication:

```bash
export TF_VAR_vultr_api_key="your-api-key"
```

### Common Vultr Resources

```hcl
# SSH key (shared across all setups)
resource "vultr_ssh_key" "default" {
  name    = "deploy-key"
  ssh_key = file(var.ssh_key_path)
}

# Firewall group
resource "vultr_firewall_group" "web" {
  description = "Web server firewall"
}

resource "vultr_firewall_rule" "ssh" {
  firewall_group_id = vultr_firewall_group.web.id
  protocol          = "tcp"
  ip_type           = "v4"
  subnet            = "0.0.0.0"
  subnet_size       = 0
  port              = "22"
}

resource "vultr_firewall_rule" "http" {
  firewall_group_id = vultr_firewall_group.web.id
  protocol          = "tcp"
  ip_type           = "v4"
  subnet            = "0.0.0.0"
  subnet_size       = 0
  port              = "80"
}

resource "vultr_firewall_rule" "https" {
  firewall_group_id = vultr_firewall_group.web.id
  protocol          = "tcp"
  ip_type           = "v4"
  subnet            = "0.0.0.0"
  subnet_size       = 0
  port              = "443"
}
```

### Useful Vultr Data Sources

```hcl
# Look up OS images
data "vultr_os" "ubuntu" {
  filter {
    name   = "name"
    values = ["Ubuntu 24.04 LTS x64"]
  }
}

# Look up plans
data "vultr_plan" "small" {
  filter {
    name   = "id"
    values = ["vc2-1c-1gb"] # 1 vCPU, 1GB RAM, $5/mo
  }
}

# Common plans:
# vc2-1c-1gb  = 1 vCPU, 1GB RAM,  25GB SSD  ($5/mo)
# vc2-1c-2gb  = 1 vCPU, 2GB RAM,  55GB SSD  ($10/mo)
# vc2-2c-4gb  = 2 vCPU, 4GB RAM,  80GB SSD  ($20/mo)
# vc2-4c-8gb  = 4 vCPU, 8GB RAM, 160GB SSD  ($40/mo)
```

---

## Vultr: Express + React (Node Full Stack)

Single VM running Docker with Express API, React frontend (Nginx), and PostgreSQL.

```hcl
# main.tf
resource "vultr_instance" "fullstack" {
  plan              = "vc2-2c-4gb" # 2 vCPU, 4GB RAM
  region            = var.region
  os_id             = data.vultr_os.ubuntu.id
  ssh_key_ids       = [vultr_ssh_key.default.id]
  firewall_group_id = vultr_firewall_group.web.id
  hostname          = "fullstack-node"
  label             = "fullstack-node"

  user_data = base64encode(<<-EOF
    #!/bin/bash
    set -e

    # Install Docker
    curl -fsSL https://get.docker.com | bash
    systemctl enable --now docker

    # Install Docker Compose
    apt-get install -y docker-compose-plugin

    # Create app directory
    mkdir -p /opt/app
    cd /opt/app

    # Write docker-compose.yml
    cat > docker-compose.yml <<'COMPOSE'
    services:
      db:
        image: postgres:16
        restart: unless-stopped
        environment:
          POSTGRES_USER: app
          POSTGRES_PASSWORD: ${random_password.db.result}
          POSTGRES_DB: fullstack
        volumes:
          - pg_data:/var/lib/postgresql/data

      api:
        image: ${var.api_image}
        restart: unless-stopped
        ports:
          - "4000:4000"
        environment:
          DATABASE_URL: postgres://app:${random_password.db.result}@db:5432/fullstack
          NODE_ENV: production
          PORT: "4000"
        depends_on:
          - db

      frontend:
        image: ${var.frontend_image}
        restart: unless-stopped
        ports:
          - "80:80"
          - "443:443"
        depends_on:
          - api

    volumes:
      pg_data:
    COMPOSE

    docker compose up -d
  EOF
  )
}

resource "random_password" "db" {
  length  = 32
  special = false
}

variable "api_image" {
  description = "Docker image for Express API"
  type        = string
  default     = "node:20-alpine" # replace with your image
}

variable "frontend_image" {
  description = "Docker image for React frontend"
  type        = string
  default     = "nginx:alpine" # replace with your image
}

# Optional: managed database instead of Docker PostgreSQL
# resource "vultr_database" "pg" {
#   database_engine         = "pg"
#   database_engine_version = "16"
#   region                  = var.region
#   plan                    = "vultr-dbaas-startup-cc-1-55-2"
#   label                   = "fullstack-db"
#   cluster_time_zone       = "UTC"
# }

# DNS (if you have a Vultr-managed domain)
# resource "vultr_dns_record" "app" {
#   domain = "example.com"
#   name   = "app"
#   type   = "A"
#   data   = vultr_instance.fullstack.main_ip
#   ttl    = 300
# }

# outputs.tf
output "server_ip" {
  value = vultr_instance.fullstack.main_ip
}

output "ssh_command" {
  value = "ssh root@${vultr_instance.fullstack.main_ip}"
}
```

---

## Vultr: Flask + React (Python/JS Full Stack)

Single VM with Flask API, React frontend, PostgreSQL, and Redis.

```hcl
# main.tf
resource "vultr_instance" "flask_app" {
  plan              = "vc2-2c-4gb"
  region            = var.region
  os_id             = data.vultr_os.ubuntu.id
  ssh_key_ids       = [vultr_ssh_key.default.id]
  firewall_group_id = vultr_firewall_group.web.id
  hostname          = "fullstack-flask"
  label             = "fullstack-flask"

  user_data = base64encode(<<-EOF
    #!/bin/bash
    set -e

    curl -fsSL https://get.docker.com | bash
    systemctl enable --now docker
    apt-get install -y docker-compose-plugin

    mkdir -p /opt/app
    cd /opt/app

    cat > docker-compose.yml <<'COMPOSE'
    services:
      db:
        image: postgres:16
        restart: unless-stopped
        environment:
          POSTGRES_USER: flask
          POSTGRES_PASSWORD: ${random_password.flask_db.result}
          POSTGRES_DB: flaskapp
        volumes:
          - pg_data:/var/lib/postgresql/data

      redis:
        image: redis:7-alpine
        restart: unless-stopped
        volumes:
          - redis_data:/data

      api:
        image: ${var.flask_api_image}
        restart: unless-stopped
        ports:
          - "5000:5000"
        environment:
          DATABASE_URL: postgres://flask:${random_password.flask_db.result}@db:5432/flaskapp
          REDIS_URL: redis://redis:6379/0
          FLASK_ENV: production
        depends_on:
          - db
          - redis

      frontend:
        image: ${var.flask_frontend_image}
        restart: unless-stopped
        ports:
          - "80:80"
          - "443:443"
        depends_on:
          - api

    volumes:
      pg_data:
      redis_data:
    COMPOSE

    docker compose up -d
  EOF
  )
}

resource "random_password" "flask_db" {
  length  = 32
  special = false
}

variable "flask_api_image" {
  description = "Docker image for Flask API"
  type        = string
  default     = "python:3.12-slim" # replace with your image
}

variable "flask_frontend_image" {
  description = "Docker image for React frontend"
  type        = string
  default     = "nginx:alpine" # replace with your image
}

# For FastAPI: same setup, just swap the api image and the CMD in your Dockerfile.
# FastAPI serves on the same port, adds /docs (Swagger) and /redoc automatically.

output "flask_server_ip" {
  value = vultr_instance.flask_app.main_ip
}

output "flask_ssh_command" {
  value = "ssh root@${vultr_instance.flask_app.main_ip}"
}
```

---

## Vultr: Background Jobs (Temporal + Celery)

Dedicated VM for background job infrastructure. Runs Temporal server, Node.js Temporal workers, Python Celery workers, Redis, and PostgreSQL.

```hcl
# main.tf
resource "vultr_firewall_group" "jobs" {
  description = "Background jobs firewall"
}

resource "vultr_firewall_rule" "jobs_ssh" {
  firewall_group_id = vultr_firewall_group.jobs.id
  protocol          = "tcp"
  ip_type           = "v4"
  subnet            = "0.0.0.0"
  subnet_size       = 0
  port              = "22"
}

resource "vultr_firewall_rule" "temporal_ui" {
  firewall_group_id = vultr_firewall_group.jobs.id
  protocol          = "tcp"
  ip_type           = "v4"
  subnet            = "0.0.0.0"
  subnet_size       = 0
  port              = "8080"
}

resource "vultr_firewall_rule" "flower" {
  firewall_group_id = vultr_firewall_group.jobs.id
  protocol          = "tcp"
  ip_type           = "v4"
  subnet            = "0.0.0.0"
  subnet_size       = 0
  port              = "5555"
}

resource "vultr_instance" "jobs" {
  plan              = "vc2-4c-8gb" # 4 vCPU, 8GB RAM (Temporal needs memory)
  region            = var.region
  os_id             = data.vultr_os.ubuntu.id
  ssh_key_ids       = [vultr_ssh_key.default.id]
  firewall_group_id = vultr_firewall_group.jobs.id
  hostname          = "background-jobs"
  label             = "background-jobs"

  user_data = base64encode(<<-EOF
    #!/bin/bash
    set -e

    curl -fsSL https://get.docker.com | bash
    systemctl enable --now docker
    apt-get install -y docker-compose-plugin

    mkdir -p /opt/jobs
    cd /opt/jobs

    cat > docker-compose.yml <<'COMPOSE'
    services:
      db:
        image: postgres:16
        restart: unless-stopped
        environment:
          POSTGRES_USER: admin
          POSTGRES_PASSWORD: ${random_password.jobs_db.result}
          POSTGRES_DB: appdb
        volumes:
          - pg_data:/var/lib/postgresql/data

      redis:
        image: redis:7-alpine
        restart: unless-stopped
        volumes:
          - redis_data:/data

      temporal:
        image: temporalio/auto-setup:latest
        restart: unless-stopped
        ports:
          - "7233:7233"
        environment:
          DB: postgres12
          DB_PORT: "5432"
          POSTGRES_USER: admin
          POSTGRES_PWD: ${random_password.jobs_db.result}
          POSTGRES_SEEDS: db
        depends_on:
          - db

      temporal-ui:
        image: temporalio/ui:latest
        restart: unless-stopped
        ports:
          - "8080:8080"
        environment:
          TEMPORAL_ADDRESS: temporal:7233
        depends_on:
          - temporal

      temporal-worker:
        image: ${var.temporal_worker_image}
        restart: unless-stopped
        environment:
          TEMPORAL_ADDRESS: temporal:7233
          TEMPORAL_NAMESPACE: default
          TEMPORAL_TASK_QUEUE: main-queue
          DATABASE_URL: postgres://admin:${random_password.jobs_db.result}@db:5432/appdb
        depends_on:
          - temporal

      celery-worker:
        image: ${var.celery_worker_image}
        restart: unless-stopped
        environment:
          CELERY_BROKER_URL: redis://redis:6379/0
          CELERY_RESULT_BACKEND: redis://redis:6379/1
          DATABASE_URL: postgres://admin:${random_password.jobs_db.result}@db:5432/appdb
        depends_on:
          - redis
          - db

      celery-beat:
        image: ${var.celery_worker_image}
        restart: unless-stopped
        command: celery -A tasks beat --loglevel=info
        environment:
          CELERY_BROKER_URL: redis://redis:6379/0
          CELERY_RESULT_BACKEND: redis://redis:6379/1
        depends_on:
          - redis

      flower:
        image: mher/flower:latest
        restart: unless-stopped
        ports:
          - "5555:5555"
        environment:
          CELERY_BROKER_URL: redis://redis:6379/0
        depends_on:
          - redis

    volumes:
      pg_data:
      redis_data:
    COMPOSE

    docker compose up -d
  EOF
  )
}

resource "random_password" "jobs_db" {
  length  = 32
  special = false
}

variable "temporal_worker_image" {
  description = "Docker image for Node.js Temporal worker"
  type        = string
}

variable "celery_worker_image" {
  description = "Docker image for Python Celery worker"
  type        = string
}

output "jobs_server_ip" {
  value = vultr_instance.jobs.main_ip
}

output "temporal_ui_url" {
  value = "http://${vultr_instance.jobs.main_ip}:8080"
}

output "flower_url" {
  value = "http://${vultr_instance.jobs.main_ip}:5555"
}

output "jobs_ssh_command" {
  value = "ssh root@${vultr_instance.jobs.main_ip}"
}
```

---

## Vultr: Kubernetes Cluster

For larger deployments, use Vultr Kubernetes Engine (VKE) instead of single VMs. Deploy any of the three setups using the Kubernetes configs from [terraform-guide.md](terraform-guide.md).

```hcl
resource "vultr_kubernetes" "cluster" {
  region  = var.region
  label   = "production"
  version = "v1.31.0+1"

  node_pools {
    node_quantity = 3
    plan          = "vc2-2c-4gb"
    label         = "default-pool"
    auto_scaler   = true
    min_nodes     = 2
    max_nodes     = 5
  }
}

# Write kubeconfig to local file
resource "local_file" "kubeconfig" {
  content         = base64decode(vultr_kubernetes.cluster.kube_config)
  filename        = "${path.module}/kubeconfig.yaml"
  file_permission = "0600"
}

output "cluster_id" {
  value = vultr_kubernetes.cluster.id
}

output "cluster_endpoint" {
  value = vultr_kubernetes.cluster.endpoint
}

output "kubeconfig_command" {
  value = "export KUBECONFIG=${path.module}/kubeconfig.yaml"
}
```

---

# DigitalOcean

Provider: `digitalocean/digitalocean`

## Setup

```hcl
# providers.tf
terraform {
  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.0"
    }
  }
}

provider "digitalocean" {
  token = var.do_token
}

# variables.tf
variable "do_token" {
  description = "DigitalOcean API token"
  type        = string
  sensitive   = true
}

variable "region" {
  description = "DigitalOcean region"
  type        = string
  default     = "nyc1"
}

variable "ssh_key_path" {
  description = "Path to SSH public key"
  type        = string
  default     = "~/.ssh/id_ed25519.pub"
}
```

Authentication:

```bash
export TF_VAR_do_token="your-api-token"
```

### Common DigitalOcean Resources

```hcl
# SSH key
resource "digitalocean_ssh_key" "default" {
  name       = "deploy-key"
  public_key = file(var.ssh_key_path)
}

# VPC
resource "digitalocean_vpc" "main" {
  name     = "app-network"
  region   = var.region
  ip_range = "10.10.10.0/24"
}

# Firewall
resource "digitalocean_firewall" "web" {
  name = "web-firewall"

  inbound_rule {
    protocol         = "tcp"
    port_range       = "22"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  inbound_rule {
    protocol         = "tcp"
    port_range       = "80"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  inbound_rule {
    protocol         = "tcp"
    port_range       = "443"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "tcp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "udp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "icmp"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
}

# Common droplet sizes:
# s-1vcpu-1gb    = 1 vCPU, 1GB RAM  ($6/mo)
# s-1vcpu-2gb    = 1 vCPU, 2GB RAM  ($12/mo)
# s-2vcpu-4gb    = 2 vCPU, 4GB RAM  ($24/mo)
# s-4vcpu-8gb    = 4 vCPU, 8GB RAM  ($48/mo)
# s-8vcpu-16gb   = 8 vCPU, 16GB RAM ($96/mo)
```

---

## DigitalOcean: Express + React (Node Full Stack)

Single droplet with Docker, or use managed database + App Platform.

### Option A: Single Droplet with Docker

```hcl
# main.tf
resource "digitalocean_droplet" "fullstack" {
  name     = "fullstack-node"
  size     = "s-2vcpu-4gb"
  image    = "ubuntu-24-04-x64"
  region   = var.region
  vpc_uuid = digitalocean_vpc.main.id
  ssh_keys = [digitalocean_ssh_key.default.fingerprint]

  user_data = <<-EOF
    #!/bin/bash
    set -e

    curl -fsSL https://get.docker.com | bash
    systemctl enable --now docker
    apt-get install -y docker-compose-plugin

    mkdir -p /opt/app
    cd /opt/app

    cat > docker-compose.yml <<'COMPOSE'
    services:
      db:
        image: postgres:16
        restart: unless-stopped
        environment:
          POSTGRES_USER: app
          POSTGRES_PASSWORD: ${random_password.do_db.result}
          POSTGRES_DB: fullstack
        volumes:
          - pg_data:/var/lib/postgresql/data

      api:
        image: ${var.api_image}
        restart: unless-stopped
        ports:
          - "4000:4000"
        environment:
          DATABASE_URL: postgres://app:${random_password.do_db.result}@db:5432/fullstack
          NODE_ENV: production
          PORT: "4000"
        depends_on:
          - db

      frontend:
        image: ${var.frontend_image}
        restart: unless-stopped
        ports:
          - "80:80"
          - "443:443"
        depends_on:
          - api

    volumes:
      pg_data:
    COMPOSE

    docker compose up -d
  EOF
}

resource "random_password" "do_db" {
  length  = 32
  special = false
}

resource "digitalocean_firewall" "fullstack" {
  name        = "fullstack-firewall"
  droplet_ids = [digitalocean_droplet.fullstack.id]

  inbound_rule {
    protocol         = "tcp"
    port_range       = "22"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  inbound_rule {
    protocol         = "tcp"
    port_range       = "80"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  inbound_rule {
    protocol         = "tcp"
    port_range       = "443"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "tcp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "udp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "icmp"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
}

output "fullstack_ip" {
  value = digitalocean_droplet.fullstack.ipv4_address
}

output "fullstack_ssh" {
  value = "ssh root@${digitalocean_droplet.fullstack.ipv4_address}"
}
```

### Option B: Managed Database + Droplet

Use DigitalOcean's managed PostgreSQL instead of running it in Docker. Handles backups, failover, and updates automatically.

```hcl
# Managed PostgreSQL
resource "digitalocean_database_cluster" "pg" {
  name       = "fullstack-db"
  engine     = "pg"
  version    = "16"
  size       = "db-s-1vcpu-1gb" # $15/mo
  region     = var.region
  node_count = 1
}

resource "digitalocean_database_db" "app" {
  cluster_id = digitalocean_database_cluster.pg.id
  name       = "fullstack"
}

resource "digitalocean_database_user" "app" {
  cluster_id = digitalocean_database_cluster.pg.id
  name       = "app"
}

# Restrict DB access to only the app droplet
resource "digitalocean_database_firewall" "pg" {
  cluster_id = digitalocean_database_cluster.pg.id

  rule {
    type  = "droplet"
    value = digitalocean_droplet.fullstack.id
  }
}

output "database_uri" {
  value     = digitalocean_database_cluster.pg.uri
  sensitive = true
}
```

---

## DigitalOcean: Flask + React (Python/JS Full Stack)

Droplet with Docker, managed Redis, and managed PostgreSQL.

```hcl
# main.tf

# Managed PostgreSQL
resource "digitalocean_database_cluster" "flask_pg" {
  name       = "flask-db"
  engine     = "pg"
  version    = "16"
  size       = "db-s-1vcpu-1gb"
  region     = var.region
  node_count = 1
}

resource "digitalocean_database_db" "flask" {
  cluster_id = digitalocean_database_cluster.flask_pg.id
  name       = "flaskapp"
}

# Managed Redis
resource "digitalocean_database_cluster" "redis" {
  name       = "flask-redis"
  engine     = "redis"
  version    = "7"
  size       = "db-s-1vcpu-1gb"
  region     = var.region
  node_count = 1
}

# App Droplet
resource "digitalocean_droplet" "flask_app" {
  name     = "fullstack-flask"
  size     = "s-2vcpu-4gb"
  image    = "ubuntu-24-04-x64"
  region   = var.region
  vpc_uuid = digitalocean_vpc.main.id
  ssh_keys = [digitalocean_ssh_key.default.fingerprint]

  user_data = <<-EOF
    #!/bin/bash
    set -e

    curl -fsSL https://get.docker.com | bash
    systemctl enable --now docker
    apt-get install -y docker-compose-plugin

    mkdir -p /opt/app
    cd /opt/app

    cat > docker-compose.yml <<'COMPOSE'
    services:
      api:
        image: ${var.flask_api_image}
        restart: unless-stopped
        ports:
          - "5000:5000"
        environment:
          DATABASE_URL: ${digitalocean_database_cluster.flask_pg.uri}/flaskapp?sslmode=require
          REDIS_URL: rediss://${digitalocean_database_cluster.redis.private_uri_no_scheme}
          FLASK_ENV: production

      frontend:
        image: ${var.flask_frontend_image}
        restart: unless-stopped
        ports:
          - "80:80"
          - "443:443"
        depends_on:
          - api
    COMPOSE

    docker compose up -d
  EOF
}

# For FastAPI: same setup. Swap the api image. FastAPI auto-generates /docs.

# Restrict database access to app droplet
resource "digitalocean_database_firewall" "flask_pg" {
  cluster_id = digitalocean_database_cluster.flask_pg.id

  rule {
    type  = "droplet"
    value = digitalocean_droplet.flask_app.id
  }
}

resource "digitalocean_database_firewall" "redis" {
  cluster_id = digitalocean_database_cluster.redis.id

  rule {
    type  = "droplet"
    value = digitalocean_droplet.flask_app.id
  }
}

resource "digitalocean_firewall" "flask" {
  name        = "flask-firewall"
  droplet_ids = [digitalocean_droplet.flask_app.id]

  inbound_rule {
    protocol         = "tcp"
    port_range       = "22"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  inbound_rule {
    protocol         = "tcp"
    port_range       = "80"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  inbound_rule {
    protocol         = "tcp"
    port_range       = "443"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "tcp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "udp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "icmp"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
}

output "flask_ip" {
  value = digitalocean_droplet.flask_app.ipv4_address
}

output "flask_ssh" {
  value = "ssh root@${digitalocean_droplet.flask_app.ipv4_address}"
}
```

---

## DigitalOcean: Background Jobs (Temporal + Celery)

Larger droplet for the job infrastructure. Uses managed Redis for Celery broker.

```hcl
# main.tf

# Managed Redis (Celery broker)
resource "digitalocean_database_cluster" "jobs_redis" {
  name       = "jobs-redis"
  engine     = "redis"
  version    = "7"
  size       = "db-s-1vcpu-2gb"
  region     = var.region
  node_count = 1
}

# Managed PostgreSQL (shared by app and Temporal)
resource "digitalocean_database_cluster" "jobs_pg" {
  name       = "jobs-db"
  engine     = "pg"
  version    = "16"
  size       = "db-s-2vcpu-4gb" # Temporal needs more resources
  region     = var.region
  node_count = 1
}

resource "digitalocean_database_db" "jobs" {
  cluster_id = digitalocean_database_cluster.jobs_pg.id
  name       = "appdb"
}

# Jobs Droplet
resource "digitalocean_droplet" "jobs" {
  name     = "background-jobs"
  size     = "s-4vcpu-8gb" # Temporal needs memory
  image    = "ubuntu-24-04-x64"
  region   = var.region
  vpc_uuid = digitalocean_vpc.main.id
  ssh_keys = [digitalocean_ssh_key.default.fingerprint]

  user_data = <<-EOF
    #!/bin/bash
    set -e

    curl -fsSL https://get.docker.com | bash
    systemctl enable --now docker
    apt-get install -y docker-compose-plugin

    mkdir -p /opt/jobs
    cd /opt/jobs

    cat > docker-compose.yml <<'COMPOSE'
    services:
      temporal:
        image: temporalio/auto-setup:latest
        restart: unless-stopped
        ports:
          - "7233:7233"
        environment:
          DB: postgres12
          DB_PORT: "${digitalocean_database_cluster.jobs_pg.port}"
          POSTGRES_USER: "${digitalocean_database_cluster.jobs_pg.user}"
          POSTGRES_PWD: "${digitalocean_database_cluster.jobs_pg.password}"
          POSTGRES_SEEDS: "${digitalocean_database_cluster.jobs_pg.private_host}"

      temporal-ui:
        image: temporalio/ui:latest
        restart: unless-stopped
        ports:
          - "8080:8080"
        environment:
          TEMPORAL_ADDRESS: temporal:7233
        depends_on:
          - temporal

      temporal-worker:
        image: ${var.temporal_worker_image}
        restart: unless-stopped
        environment:
          TEMPORAL_ADDRESS: temporal:7233
          TEMPORAL_NAMESPACE: default
          TEMPORAL_TASK_QUEUE: main-queue
          DATABASE_URL: ${digitalocean_database_cluster.jobs_pg.uri}/appdb?sslmode=require
        depends_on:
          - temporal

      celery-worker:
        image: ${var.celery_worker_image}
        restart: unless-stopped
        environment:
          CELERY_BROKER_URL: rediss://${digitalocean_database_cluster.jobs_redis.private_uri_no_scheme}
          CELERY_RESULT_BACKEND: rediss://${digitalocean_database_cluster.jobs_redis.private_uri_no_scheme}
          DATABASE_URL: ${digitalocean_database_cluster.jobs_pg.uri}/appdb?sslmode=require

      celery-beat:
        image: ${var.celery_worker_image}
        restart: unless-stopped
        command: celery -A tasks beat --loglevel=info
        environment:
          CELERY_BROKER_URL: rediss://${digitalocean_database_cluster.jobs_redis.private_uri_no_scheme}
          CELERY_RESULT_BACKEND: rediss://${digitalocean_database_cluster.jobs_redis.private_uri_no_scheme}

      flower:
        image: mher/flower:latest
        restart: unless-stopped
        ports:
          - "5555:5555"
        environment:
          CELERY_BROKER_URL: rediss://${digitalocean_database_cluster.jobs_redis.private_uri_no_scheme}
    COMPOSE

    docker compose up -d
  EOF
}

# Database firewall rules
resource "digitalocean_database_firewall" "jobs_pg" {
  cluster_id = digitalocean_database_cluster.jobs_pg.id

  rule {
    type  = "droplet"
    value = digitalocean_droplet.jobs.id
  }
}

resource "digitalocean_database_firewall" "jobs_redis" {
  cluster_id = digitalocean_database_cluster.jobs_redis.id

  rule {
    type  = "droplet"
    value = digitalocean_droplet.jobs.id
  }
}

resource "digitalocean_firewall" "jobs" {
  name        = "jobs-firewall"
  droplet_ids = [digitalocean_droplet.jobs.id]

  inbound_rule {
    protocol         = "tcp"
    port_range       = "22"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  inbound_rule {
    protocol         = "tcp"
    port_range       = "8080"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  inbound_rule {
    protocol         = "tcp"
    port_range       = "5555"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "tcp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "udp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "icmp"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
}

output "jobs_ip" {
  value = digitalocean_droplet.jobs.ipv4_address
}

output "temporal_ui_url" {
  value = "http://${digitalocean_droplet.jobs.ipv4_address}:8080"
}

output "flower_url" {
  value = "http://${digitalocean_droplet.jobs.ipv4_address}:5555"
}

output "jobs_ssh" {
  value = "ssh root@${digitalocean_droplet.jobs.ipv4_address}"
}
```

---

## DigitalOcean: Kubernetes Cluster

For larger deployments, use DigitalOcean Kubernetes (DOKS). Deploy any of the three setups using the Kubernetes configs from [terraform-guide.md](terraform-guide.md).

```hcl
resource "digitalocean_kubernetes_cluster" "cluster" {
  name    = "production"
  region  = var.region
  version = "1.31.1-do.4"

  node_pool {
    name       = "default-pool"
    size       = "s-2vcpu-4gb"
    node_count = 3
    auto_scale = true
    min_nodes  = 2
    max_nodes  = 5
  }
}

# Write kubeconfig to local file
resource "local_file" "kubeconfig" {
  content         = digitalocean_kubernetes_cluster.cluster.kube_config[0].raw_config
  filename        = "${path.module}/kubeconfig.yaml"
  file_permission = "0600"
}

# Optional: container registry for your Docker images
resource "digitalocean_container_registry" "registry" {
  name                   = "app-registry"
  subscription_tier_slug = "starter" # free tier, 500MB
  region                 = var.region
}

# Grant cluster access to pull from the registry
resource "digitalocean_container_registry_docker_credentials" "cluster" {
  registry_name = digitalocean_container_registry.registry.name
}

output "cluster_id" {
  value = digitalocean_kubernetes_cluster.cluster.id
}

output "registry_endpoint" {
  value = digitalocean_container_registry.registry.endpoint
}

output "kubeconfig_command" {
  value = "export KUBECONFIG=${path.module}/kubeconfig.yaml"
}
```

---

## Load Balancers

Both providers offer managed load balancers for production traffic.

### Vultr

```hcl
resource "vultr_load_balancer" "web" {
  region = var.region
  label  = "web-lb"

  forwarding_rules {
    frontend_protocol = "http"
    frontend_port     = 80
    backend_protocol  = "http"
    backend_port      = 80
  }

  forwarding_rules {
    frontend_protocol = "https"
    frontend_port     = 443
    backend_protocol  = "http"
    backend_port      = 80
  }

  health_check {
    protocol            = "http"
    port                = 80
    path                = "/health"
    check_interval      = 15
    response_timeout    = 5
    unhealthy_threshold = 5
    healthy_threshold   = 5
  }

  attached_instances = [vultr_instance.fullstack.id]
  # ssl_redirect = true  # force HTTPS
}

output "lb_ip" {
  value = vultr_load_balancer.web.ipv4
}
```

### DigitalOcean

```hcl
resource "digitalocean_loadbalancer" "web" {
  name     = "web-lb"
  region   = var.region
  vpc_uuid = digitalocean_vpc.main.id

  forwarding_rule {
    entry_port      = 80
    entry_protocol  = "http"
    target_port     = 80
    target_protocol = "http"
  }

  forwarding_rule {
    entry_port      = 443
    entry_protocol  = "https"
    target_port     = 80
    target_protocol = "http"
    # certificate_name = digitalocean_certificate.cert.name
  }

  healthcheck {
    port     = 80
    protocol = "http"
    path     = "/health"
  }

  droplet_ids = [digitalocean_droplet.fullstack.id]
  # redirect_http_to_https = true
}

output "lb_ip" {
  value = digitalocean_loadbalancer.web.ip
}
```

---

## DNS

### Vultr

```hcl
resource "vultr_dns_domain" "main" {
  domain = "example.com"
}

resource "vultr_dns_record" "app" {
  domain = vultr_dns_domain.main.domain
  name   = "app"
  type   = "A"
  data   = vultr_instance.fullstack.main_ip
  ttl    = 300
}

resource "vultr_dns_record" "www" {
  domain = vultr_dns_domain.main.domain
  name   = "www"
  type   = "CNAME"
  data   = "app.example.com"
  ttl    = 300
}
```

### DigitalOcean

```hcl
resource "digitalocean_domain" "main" {
  name = "example.com"
}

resource "digitalocean_record" "app" {
  domain = digitalocean_domain.main.id
  type   = "A"
  name   = "app"
  value  = digitalocean_droplet.fullstack.ipv4_address
  ttl    = 300
}

resource "digitalocean_record" "www" {
  domain = digitalocean_domain.main.id
  type   = "CNAME"
  name   = "www"
  value  = "app.example.com."
  ttl    = 300
}
```

---

## Comparison

| Feature            | Vultr              | DigitalOcean                |
| ------------------ | ------------------ | --------------------------- |
| Cheapest VM        | $2.50/mo (512MB)   | $4/mo (512MB)               |
| 1 vCPU / 1GB       | $5/mo              | $6/mo                       |
| 2 vCPU / 4GB       | $20/mo             | $24/mo                      |
| Managed Postgres   | From $15/mo        | From $15/mo                 |
| Managed Redis      | Not available      | From $15/mo                 |
| Managed K8s        | Free control plane | Free control plane          |
| Load Balancer      | $10/mo             | $12/mo                      |
| Datacenters        | 32 locations       | 15 locations                |
| Bare Metal         | Yes                | No                          |
| Container Registry | Not available      | Free tier (500MB)           |
| Terraform Provider | `vultr/vultr`      | `digitalocean/digitalocean` |

---

## Tips

- **Use managed databases in production.** Running PostgreSQL/Redis in Docker on a single VM is fine for dev/staging, but managed databases give you automated backups, failover, and security patches.
- **Use VPC/private networking.** Keep databases off the public internet. Both providers support private networking between resources in the same region.
- **Use `user_data` sparingly.** For complex setups, bake Docker images with your app code and push to a registry instead of cloning repos in cloud-init.
- **Set up monitoring.** Vultr has basic monitoring built in. DigitalOcean has Monitoring with alert policies. For deeper visibility, deploy Prometheus + Grafana.
- **Back up volumes.** Enable automatic backups on droplets/instances ($1-2/mo extra). For Docker volumes, set up periodic `pg_dump` or volume snapshots.
- **Use `terraform.tfvars` for secrets.** Never hardcode API keys, passwords, or tokens in `.tf` files. Use `TF_VAR_*` environment variables or a `terraform.tfvars` file (excluded from git).

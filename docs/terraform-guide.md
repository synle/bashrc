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

| Concept | Description |
|---------|-------------|
| **Provider** | Plugin that talks to an API (AWS, Azure, Docker, etc.) |
| **Resource** | A thing Terraform manages (VM, container, DNS record) |
| **State** | Terraform's record of what it created (`terraform.tfstate`) |
| **Plan** | Preview of what Terraform will change |
| **Apply** | Execute the plan and make changes |
| **Module** | Reusable group of resources |

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

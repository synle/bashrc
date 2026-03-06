# CI/CD - Ansible Setup Guide

A beginner-friendly guide to setting up Ansible for server provisioning and configuration management — from scratch.

## What is Ansible?

Ansible is a tool that lets you configure and manage remote servers from your local machine. You write simple YAML files describing what you want (install packages, copy files, start services), and Ansible connects via SSH to make it happen. No agent needed on the remote servers.

## Prerequisites

- A local machine (macOS, Linux, or WSL on Windows)
- One or more remote servers you can SSH into (e.g., a VPS from DigitalOcean, Linode, Hetzner, AWS EC2, etc.)
- SSH key pair (see "Generate SSH Keys" below if you don't have one)

## Step 1: Install Ansible on Your Local Machine

Ansible runs on your **local machine** — you do NOT install it on the remote servers.

### macOS

```bash
brew install ansible
```

### Ubuntu / Debian / WSL

```bash
sudo apt update
sudo apt install -y software-properties-common
sudo add-apt-repository --yes --update ppa:ansible/ansible
sudo apt install -y ansible
```

### Verify Installation

```bash
ansible --version
```

You should see version info like `ansible [core 2.x.x]`.

## Step 2: Generate SSH Keys (If You Don't Have One)

Ansible connects to servers over SSH. You need an SSH key pair.

```bash
# check if you already have a key
ls ~/.ssh/id_ed25519.pub

# if not, generate one (press Enter for all prompts)
ssh-keygen -t ed25519 -C "your_email@example.com"
```

This creates:

- `~/.ssh/id_ed25519` — your private key (never share this)
- `~/.ssh/id_ed25519.pub` — your public key (this goes on servers)

## Step 3: Set Up a New Server

### 3a. Copy Your SSH Key to the Server

Most VPS providers let you add your SSH key during server creation. If not, copy it manually:

```bash
# copy your public key to the server (replace with your server's IP)
ssh-copy-id root@YOUR_SERVER_IP

# or manually
cat ~/.ssh/id_ed25519.pub | ssh root@YOUR_SERVER_IP "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"
```

### 3b. Verify SSH Access

```bash
# you should be able to log in without a password
ssh root@YOUR_SERVER_IP
```

If this works, you're ready for Ansible.

## Step 4: Create Your Ansible Project Structure

Create a directory for your Ansible configuration:

```bash
mkdir -p ~/ansible
cd ~/ansible
```

### 4a. Create the Inventory File

The inventory tells Ansible which servers to manage. Create `hosts.ini`:

```ini
# ~/ansible/hosts.ini

[webservers]
web1 ansible_host=192.168.1.10 ansible_user=root
web2 ansible_host=192.168.1.11 ansible_user=root

[dbservers]
db1 ansible_host=192.168.1.20 ansible_user=root

# group all servers
[all:children]
webservers
dbservers
```

Replace the IPs with your actual server IPs.

For a single server, it can be as simple as:

```ini
# ~/ansible/hosts.ini

[servers]
myserver ansible_host=YOUR_SERVER_IP ansible_user=root
```

### 4b. Create the Ansible Config File

Create `ansible.cfg` in the same directory:

```ini
# ~/ansible/ansible.cfg

[defaults]
inventory = hosts.ini
host_key_checking = False
retry_files_enabled = False
```

### 4c. Test the Connection

```bash
cd ~/ansible

# ping all servers in the inventory
ansible all -m ping
```

Expected output:

```
myserver | SUCCESS => {
    "changed": false,
    "ping": "pong"
}
```

If you see `pong`, Ansible can connect to your server.

## Step 5: Write Your First Playbook

Playbooks are YAML files that describe what to do on the servers. Create `setup.yml`:

```yaml
# ~/ansible/setup.yml
---
- name: Initial server setup
  hosts: all
  become: yes # run commands as sudo

  tasks:
    # ---- System Updates ----
    - name: Update apt cache
      apt:
        update_cache: yes
        cache_valid_time: 3600

    - name: Upgrade all packages
      apt:
        upgrade: dist

    # ---- Install Essential Packages ----
    - name: Install basic packages
      apt:
        name:
          - curl
          - wget
          - git
          - vim
          - htop
          - tmux
          - unzip
          - ufw
          - fail2ban
        state: present

    # ---- Create a Non-Root User ----
    - name: Create deploy user
      user:
        name: deploy
        shell: /bin/bash
        groups: sudo
        append: yes
        create_home: yes

    - name: Add SSH key for deploy user
      authorized_key:
        user: deploy
        key: "{{ lookup('file', '~/.ssh/id_ed25519.pub') }}"

    - name: Allow deploy user to sudo without password
      lineinfile:
        path: /etc/sudoers.d/deploy
        line: "deploy ALL=(ALL) NOPASSWD:ALL"
        create: yes
        mode: "0440"

    # ---- Firewall Setup ----
    - name: Allow SSH through firewall
      ufw:
        rule: allow
        port: "22"
        proto: tcp

    - name: Allow HTTP through firewall
      ufw:
        rule: allow
        port: "80"
        proto: tcp

    - name: Allow HTTPS through firewall
      ufw:
        rule: allow
        port: "443"
        proto: tcp

    - name: Enable firewall
      ufw:
        state: enabled
        default: deny

    # ---- SSH Hardening ----
    - name: Disable root login via SSH
      lineinfile:
        path: /etc/ssh/sshd_config
        regexp: "^PermitRootLogin"
        line: "PermitRootLogin no"
      notify: Restart SSH

    - name: Disable password authentication
      lineinfile:
        path: /etc/ssh/sshd_config
        regexp: "^PasswordAuthentication"
        line: "PasswordAuthentication no"
      notify: Restart SSH

    # ---- Set Timezone ----
    - name: Set timezone to UTC
      timezone:
        name: UTC

  handlers:
    - name: Restart SSH
      service:
        name: sshd
        state: restarted
```

## Step 6: Run the Playbook

```bash
cd ~/ansible

# run the setup playbook
ansible-playbook setup.yml
```

### Useful Flags

```bash
# dry run — show what would change without actually changing anything
ansible-playbook setup.yml --check

# run with verbose output for debugging
ansible-playbook setup.yml -v

# run on a specific group or host only
ansible-playbook setup.yml --limit webservers
ansible-playbook setup.yml --limit web1

# run a specific task by its name
ansible-playbook setup.yml --start-at-task="Install basic packages"

# ask for the sudo password (if not using NOPASSWD)
ansible-playbook setup.yml --ask-become-pass
```

## Step 7: Organize with Roles (Optional)

As your setup grows, organize tasks into roles:

```
~/ansible/
├── ansible.cfg
├── hosts.ini
├── setup.yml
└── roles/
    ├── common/
    │   └── tasks/
    │       └── main.yml      # shared tasks (packages, timezone, etc.)
    ├── security/
    │   └── tasks/
    │       └── main.yml      # firewall, SSH hardening, fail2ban
    └── webserver/
        └── tasks/
            └── main.yml      # nginx, certbot, etc.
```

Create a role:

```bash
cd ~/ansible
mkdir -p roles/common/tasks
```

Move tasks into `roles/common/tasks/main.yml`:

```yaml
# roles/common/tasks/main.yml
---
- name: Update apt cache
  apt:
    update_cache: yes
    cache_valid_time: 3600

- name: Install basic packages
  apt:
    name:
      - curl
      - wget
      - git
      - vim
      - htop
    state: present
```

Reference the role in your playbook:

```yaml
# setup.yml
---
- name: Initial server setup
  hosts: all
  become: yes
  roles:
    - common
    - security
    - webserver
```

## Common Ansible Commands Cheat Sheet

```bash
# test connectivity to all servers
ansible all -m ping

# run a one-off command on all servers
ansible all -a "uptime"
ansible all -a "free -h"
ansible all -a "df -h"

# run a command on a specific group
ansible webservers -a "nginx -v"

# run a playbook
ansible-playbook setup.yml

# dry run (check mode)
ansible-playbook setup.yml --check

# list all hosts in inventory
ansible all --list-hosts

# show facts about a server (OS, IP, memory, etc.)
ansible myserver -m setup
```

## Adding a New Server

1. Add the server's IP to `hosts.ini`
2. Copy your SSH key: `ssh-copy-id root@NEW_SERVER_IP`
3. Test: `ansible NEW_SERVER_NAME -m ping`
4. Run your playbook: `ansible-playbook setup.yml --limit NEW_SERVER_NAME`

## Docker & Kubernetes in CI/CD

This section covers integrating Docker and Kubernetes into your CI/CD pipelines. For comprehensive standalone guides, see:

- [Docker_README.md](Docker_README.md) — Full Docker reference
- [K8s_README.md](K8s_README.md) — Full Kubernetes reference

### CI/CD Pipeline Overview

A typical Docker + K8s CI/CD flow:

```
Code Push → CI Builds Docker Image → Push to Registry → CD Deploys to K8s Cluster
```

```
┌──────────┐    ┌──────────────┐    ┌──────────────┐    ┌─────────────┐
│  Git Push │───▶│  Build & Test │───▶│  Push Image  │───▶│  Deploy K8s │
│  (main)  │    │  Docker Image │    │  to Registry │    │  Cluster    │
└──────────┘    └──────────────┘    └──────────────┘    └─────────────┘
```

---

### Example: Node.js App

#### Project Structure

```
my-node-app/
├── src/
│   └── index.js
├── package.json
├── Dockerfile
├── k8s/
│   ├── deployment.yaml
│   └── service.yaml
└── .github/
    └── workflows/
        └── deploy.yml
```

#### Application Code

```javascript
// src/index.js
const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => res.json({ status: "ok", app: "my-node-app" }));
app.get("/health", (req, res) => res.json({ healthy: true }));

app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
```

```json
// package.json
{
  "name": "my-node-app",
  "version": "1.0.0",
  "scripts": {
    "start": "node src/index.js",
    "test": "jest"
  },
  "dependencies": {
    "express": "^4.18.0"
  }
}
```

#### Dockerfile (Multi-Stage)

```dockerfile
# ---- Build Stage ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# ---- Production Stage ----
FROM node:20-alpine
WORKDIR /app

# run as non-root
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY --from=builder /app/node_modules ./node_modules
COPY src/ ./src/
COPY package.json ./

USER appuser
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "src/index.js"]
```

#### Kubernetes Manifests

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: node-app
  labels:
    app: node-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: node-app
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  template:
    metadata:
      labels:
        app: node-app
    spec:
      containers:
        - name: node-app
          image: ghcr.io/YOUR_USER/my-node-app:latest # replaced by CI
          ports:
            - containerPort: 3000
          env:
            - name: PORT
              value: "3000"
            - name: NODE_ENV
              value: "production"
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 256Mi
          readinessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 15
            periodSeconds: 20
```

```yaml
# k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: node-app-service
spec:
  type: LoadBalancer
  selector:
    app: node-app
  ports:
    - protocol: TCP
      port: 80
      targetPort: 3000
```

#### GitHub Actions CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
name: Build and Deploy Node App

on:
  push:
    branches: [main]

env:
  IMAGE_NAME: ghcr.io/${{ github.repository_owner }}/my-node-app

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Run tests
        run: |
          npm ci
          npm test

      - name: Log in to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: |
            ${{ env.IMAGE_NAME }}:latest
            ${{ env.IMAGE_NAME }}:${{ github.sha }}

      - name: Set up kubectl
        uses: azure/setup-kubectl@v3

      - name: Configure kubeconfig
        run: echo "${{ secrets.KUBECONFIG }}" | base64 -d > $HOME/.kube/config

      - name: Deploy to Kubernetes
        run: |
          # update image tag in deployment
          kubectl set image deployment/node-app \
            node-app=${{ env.IMAGE_NAME }}:${{ github.sha }}

          # wait for rollout to complete
          kubectl rollout status deployment/node-app --timeout=120s
```

---

### Example: Python App

#### Project Structure

```
my-python-app/
├── app/
│   └── main.py
├── requirements.txt
├── Dockerfile
├── k8s/
│   ├── deployment.yaml
│   └── service.yaml
└── .github/
    └── workflows/
        └── deploy.yml
```

#### Application Code

```python
# app/main.py
from flask import Flask, jsonify
import os

app = Flask(__name__)

@app.route("/")
def index():
    return jsonify({"status": "ok", "app": "my-python-app"})

@app.route("/health")
def health():
    return jsonify({"healthy": True})

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
```

```
# requirements.txt
flask==3.0.0
gunicorn==21.2.0
```

#### Dockerfile (Multi-Stage)

```dockerfile
# ---- Build Stage ----
FROM python:3.12-slim AS builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ---- Production Stage ----
FROM python:3.12-slim
WORKDIR /app

# run as non-root
RUN groupadd -r appgroup && useradd -r -g appgroup appuser
COPY --from=builder /install /usr/local
COPY app/ ./app/

USER appuser
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5000/health')" || exit 1

CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "4", "app.main:app"]
```

#### Kubernetes Manifests

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: python-app
  labels:
    app: python-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: python-app
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  template:
    metadata:
      labels:
        app: python-app
    spec:
      containers:
        - name: python-app
          image: ghcr.io/YOUR_USER/my-python-app:latest # replaced by CI
          ports:
            - containerPort: 5000
          env:
            - name: PORT
              value: "5000"
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 512Mi
          readinessProbe:
            httpGet:
              path: /health
              port: 5000
            initialDelaySeconds: 5
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /health
              port: 5000
            initialDelaySeconds: 15
            periodSeconds: 20
```

```yaml
# k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: python-app-service
spec:
  type: LoadBalancer
  selector:
    app: python-app
  ports:
    - protocol: TCP
      port: 80
      targetPort: 5000
```

#### GitHub Actions CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
name: Build and Deploy Python App

on:
  push:
    branches: [main]

env:
  IMAGE_NAME: ghcr.io/${{ github.repository_owner }}/my-python-app

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Run tests
        run: |
          pip install -r requirements.txt
          python -m pytest

      - name: Log in to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: |
            ${{ env.IMAGE_NAME }}:latest
            ${{ env.IMAGE_NAME }}:${{ github.sha }}

      - name: Set up kubectl
        uses: azure/setup-kubectl@v3

      - name: Configure kubeconfig
        run: echo "${{ secrets.KUBECONFIG }}" | base64 -d > $HOME/.kube/config

      - name: Deploy to Kubernetes
        run: |
          kubectl set image deployment/python-app \
            python-app=${{ env.IMAGE_NAME }}:${{ github.sha }}

          kubectl rollout status deployment/python-app --timeout=120s
```

---

### Deploying with Ansible + Docker + K8s

You can combine Ansible with Docker and Kubernetes for a full provisioning + deployment pipeline. Ansible handles server setup, Docker packages the app, and K8s runs it.

#### Ansible Playbook: Set Up a K8s Node and Deploy

```yaml
# deploy-k8s-app.yml
---
- name: Deploy Dockerized app to Kubernetes
  hosts: all
  become: yes

  vars:
    app_image: "ghcr.io/YOUR_USER/my-node-app:latest"
    kubeconfig_path: /etc/kubernetes/admin.conf

  tasks:
    # ---- Ensure Docker is Installed ----
    - name: Install Docker
      apt:
        name:
          - docker.io
          - docker-compose
        state: present
        update_cache: yes

    - name: Start Docker service
      service:
        name: docker
        state: started
        enabled: yes

    # ---- Pull Latest Image ----
    - name: Pull latest app image
      command: docker pull {{ app_image }}

    # ---- Deploy to K8s ----
    - name: Update Kubernetes deployment image
      command: >
        kubectl set image deployment/node-app
        node-app={{ app_image }}
        --kubeconfig={{ kubeconfig_path }}

    - name: Wait for rollout
      command: >
        kubectl rollout status deployment/node-app
        --timeout=120s
        --kubeconfig={{ kubeconfig_path }}
```

### Useful CI/CD Commands Cheat Sheet

```bash
# ---- Docker ----
docker build -t myapp:latest .                # build image
docker run -d -p 3000:3000 myapp:latest       # run container
docker push ghcr.io/user/myapp:latest         # push to registry
docker tag myapp:latest myapp:v1.2.3          # tag a version

# ---- Kubernetes ----
kubectl apply -f k8s/                         # apply all manifests in directory
kubectl get pods                              # list running pods
kubectl get services                          # list services
kubectl logs -f deployment/myapp              # stream logs
kubectl rollout status deployment/myapp       # check rollout progress
kubectl rollout undo deployment/myapp         # rollback to previous version
kubectl scale deployment/myapp --replicas=5   # scale up/down
kubectl describe pod <pod-name>               # debug a pod
kubectl exec -it <pod-name> -- /bin/sh        # shell into a pod

# ---- Combined Workflow ----
# build, push, and deploy in one go
docker build -t ghcr.io/user/myapp:$(git rev-parse --short HEAD) .
docker push ghcr.io/user/myapp:$(git rev-parse --short HEAD)
kubectl set image deployment/myapp myapp=ghcr.io/user/myapp:$(git rev-parse --short HEAD)
```

## Troubleshooting

### "Permission denied (publickey)"

Your SSH key isn't on the server. Copy it:

```bash
ssh-copy-id root@YOUR_SERVER_IP
```

### "Host key verification failed"

Either add `host_key_checking = False` to `ansible.cfg` (already done above), or accept the host key manually:

```bash
ssh root@YOUR_SERVER_IP    # type "yes" when prompted, then exit
```

### "No hosts matched"

Check your `hosts.ini` file and make sure:

- The group name matches what's in your playbook's `hosts:` field
- `ansible.cfg` points to the correct inventory file

### "sudo: a password is required"

Your remote user needs passwordless sudo, or pass the flag:

```bash
ansible-playbook setup.yml --ask-become-pass
```

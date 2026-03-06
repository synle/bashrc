# Kubernetes (K8s) Complete Guide

A comprehensive guide to Kubernetes — from core concepts to deploying full-stack Node.js and Python applications.

---

## Table of Contents

1. [What is Kubernetes?](#what-is-kubernetes)
2. [Core Concepts](#core-concepts)
3. [Architecture](#architecture)
4. [Key Resources](#key-resources)
5. [kubectl Cheat Sheet](#kubectl-cheat-sheet)
6. [Setting Up a Local Cluster](#setting-up-a-local-cluster)
7. [Full Example: Deploying a Node.js Backend + Frontend](#full-example-deploying-a-nodejs-backend--frontend)
8. [Full Example: Deploying a Python (Flask) Backend + Frontend](#full-example-deploying-a-python-flask-backend--frontend)
9. [Networking Deep Dive](#networking-deep-dive)
10. [Storage](#storage)
11. [Configuration and Secrets](#configuration-and-secrets)
12. [Health Checks](#health-checks)
13. [Scaling](#scaling)
14. [Rolling Updates and Rollbacks](#rolling-updates-and-rollbacks)
15. [Namespaces](#namespaces)
16. [RBAC (Role-Based Access Control)](#rbac-role-based-access-control)
17. [Helm](#helm)
18. [Monitoring and Logging](#monitoring-and-logging)
19. [Common Pitfalls](#common-pitfalls)
20. [VS Code Extensions for Kubernetes](#vs-code-extensions-for-kubernetes)
21. [Glossary](#glossary)

---

## What is Kubernetes?

Kubernetes (K8s) is an open-source container orchestration platform. It automates deploying, scaling, and managing containerized applications.

**Why use it?**

- **Self-healing**: If a container crashes, K8s restarts it automatically.
- **Scaling**: Scale from 1 to 1000 instances with a single command.
- **Load balancing**: Distributes traffic across healthy instances.
- **Rolling updates**: Deploy new versions with zero downtime.
- **Declarative config**: You describe the _desired state_, K8s makes it happen.

**Analogy**: Think of K8s as a datacenter operating system. You tell it "I want 3 copies of my app running," and it figures out where to place them, keeps them alive, and routes traffic to them.

---

## Core Concepts

### Containers vs Pods vs Nodes

```
Cluster (the whole K8s environment)
├── Node (a physical or virtual machine)
│   ├── Pod (smallest deployable unit, wraps 1+ containers)
│   │   ├── Container (your app, e.g. a Docker image)
│   │   └── Container (optional sidecar, e.g. log shipper)
│   ├── Pod
│   │   └── Container
│   └── ...
├── Node
│   ├── Pod
│   └── ...
└── Node
    └── ...
```

- **Container**: A packaged application (like a Docker image). Contains your code, runtime, and dependencies.
- **Pod**: The smallest unit K8s manages. A thin wrapper around one or more containers that share networking and storage. Usually 1 container per pod.
- **Node**: A machine (physical server or VM) that runs pods. Each node runs a `kubelet` agent that talks to the control plane.
- **Cluster**: A set of nodes managed by a control plane.

### Desired State vs Current State

K8s is **declarative**. You write YAML files that say "I want 3 replicas of my app." K8s constantly compares the _desired state_ (your YAML) to the _current state_ (what's actually running) and reconciles any differences.

```
You write YAML: "I want 3 pods"
K8s sees: only 2 running
K8s action: starts 1 more pod
```

### Labels and Selectors

Labels are key-value tags you attach to resources. Selectors filter resources by labels. This is how K8s resources find each other.

```yaml
# A pod with labels
metadata:
  labels:
    app: my-backend
    environment: production

# A service that finds pods using a selector
selector:
  app: my-backend
```

---

## Architecture

```
                    ┌─────────────────────────────────────┐
                    │          CONTROL PLANE               │
                    │                                      │
                    │  ┌──────────────┐  ┌─────────────┐  │
                    │  │  API Server  │  │    etcd      │  │
                    │  │  (REST API)  │  │ (key-value   │  │
                    │  └──────┬───────┘  │  database)   │  │
                    │         │          └─────────────┘  │
                    │  ┌──────┴───────┐  ┌─────────────┐  │
                    │  │  Scheduler   │  │ Controller   │  │
                    │  │ (places pods │  │  Manager     │  │
                    │  │  on nodes)   │  │ (reconciles  │  │
                    │  └──────────────┘  │  state)      │  │
                    │                    └─────────────┘  │
                    └────────────┬────────────────────────┘
                                │
                ┌───────────────┼───────────────┐
                │               │               │
         ┌──────┴──────┐ ┌─────┴──────┐ ┌──────┴──────┐
         │   Node 1    │ │   Node 2   │ │   Node 3    │
         │             │ │            │ │             │
         │ ┌─────────┐ │ │ ┌────────┐ │ │ ┌─────────┐ │
         │ │ kubelet  │ │ │ │kubelet │ │ │ │ kubelet  │ │
         │ ├─────────┤ │ │ ├────────┤ │ │ ├─────────┤ │
         │ │kube-proxy│ │ │ │kube-  │ │ │ │kube-proxy│ │
         │ ├─────────┤ │ │ │proxy   │ │ │ ├─────────┤ │
         │ │Container │ │ │ ├────────┤ │ │ │Container │ │
         │ │Runtime   │ │ │ │Containe│ │ │ │Runtime   │ │
         │ └─────────┘ │ │ │Runtime │ │ │ └─────────┘ │
         │  [Pod] [Pod] │ │ └────────┘ │ │  [Pod]      │
         └─────────────┘ │ [Pod] [Pod] │ └─────────────┘
                         └────────────┘
```

**Control Plane components:**

| Component              | What it does                                                                                                               |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **API Server**         | Front door to K8s. All `kubectl` commands go through it.                                                                   |
| **etcd**               | Stores all cluster data (desired state, current state). A distributed key-value database.                                  |
| **Scheduler**          | Decides which node to place a new pod on (based on resources, constraints).                                                |
| **Controller Manager** | Runs control loops that watch state and make corrections (e.g., "ReplicaSet controller" ensures the right number of pods). |

**Node components:**

| Component             | What it does                                                                              |
| --------------------- | ----------------------------------------------------------------------------------------- |
| **kubelet**           | Agent on each node. Receives instructions from the API server, manages pods on that node. |
| **kube-proxy**        | Handles networking rules so pods can communicate with each other and the outside world.   |
| **Container Runtime** | Actually runs containers (Docker, containerd, CRI-O).                                     |

---

## Key Resources

These are the building blocks you define in YAML files.

### Pod

The smallest deployable unit.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: my-pod
  labels:
    app: my-app
spec:
  containers:
    - name: my-container
      image: node:20-alpine
      ports:
        - containerPort: 3000
```

You rarely create pods directly. Instead, you use a **Deployment** which manages pods for you.

### Deployment

Manages a set of identical pods (replicas). Handles rolling updates and rollbacks.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
spec:
  replicas: 3 # Run 3 copies of this pod
  selector:
    matchLabels:
      app: my-app # Find pods with this label
  template: # Pod template (what each pod looks like)
    metadata:
      labels:
        app: my-app
    spec:
      containers:
        - name: my-app
          image: my-app:1.0.0
          ports:
            - containerPort: 3000
```

**Key fields explained:**

- `replicas`: How many pod copies to run.
- `selector.matchLabels`: How the Deployment finds its pods (must match `template.metadata.labels`).
- `template`: A pod blueprint. Every pod created by this Deployment follows this template.

### Service

Pods are ephemeral — they get new IP addresses when they restart. A **Service** gives pods a stable network identity (a fixed IP and DNS name).

```yaml
apiVersion: v1
kind: Service
metadata:
  name: my-app-service
spec:
  selector:
    app: my-app # Route traffic to pods with this label
  ports:
    - port: 80 # Port the service listens on
      targetPort: 3000 # Port on the pod to forward to
  type: ClusterIP # Only accessible inside the cluster
```

**Service types:**

| Type           | Accessible from                             | Use case                               |
| -------------- | ------------------------------------------- | -------------------------------------- |
| `ClusterIP`    | Inside the cluster only                     | Backend services talking to each other |
| `NodePort`     | Outside via `<NodeIP>:<port>` (30000-32767) | Dev/testing, direct access             |
| `LoadBalancer` | Outside via cloud provider load balancer    | Production, cloud environments         |

### Ingress

Routes external HTTP/HTTPS traffic to Services inside the cluster. Think of it as a reverse proxy / router.

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: my-ingress
spec:
  rules:
    - host: myapp.example.com
      http:
        paths:
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: backend-service
                port:
                  number: 80
          - path: /
            pathType: Prefix
            backend:
              service:
                name: frontend-service
                port:
                  number: 80
```

Requires an **Ingress Controller** (e.g., nginx-ingress, traefik) to be installed in the cluster.

### ConfigMap

Stores non-sensitive configuration data as key-value pairs.

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  DATABASE_HOST: "postgres-service"
  DATABASE_PORT: "5432"
  LOG_LEVEL: "info"
```

### Secret

Stores sensitive data (passwords, tokens, keys). Values are base64-encoded (not encrypted by default).

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
type: Opaque
data:
  DATABASE_PASSWORD: cGFzc3dvcmQxMjM= # base64 of "password123"
  API_KEY: bXlzZWNyZXRrZXk= # base64 of "mysecretkey"
```

To create base64 values:

```bash
echo -n "password123" | base64
# Output: cGFzc3dvcmQxMjM=
```

### PersistentVolume (PV) and PersistentVolumeClaim (PVC)

Provides storage that persists beyond pod lifetime.

```yaml
# PersistentVolumeClaim - "I need 1Gi of storage"
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: my-storage
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
```

---

## kubectl Cheat Sheet

`kubectl` is the CLI tool for interacting with K8s.

### Cluster info

```bash
kubectl cluster-info                    # Show cluster endpoint
kubectl get nodes                       # List all nodes
kubectl get nodes -o wide               # Detailed node info
```

### Working with resources

```bash
# List resources
kubectl get pods                        # List pods in current namespace
kubectl get pods -A                     # List pods in ALL namespaces
kubectl get pods -o wide                # Show node placement and IPs
kubectl get deployments                 # List deployments
kubectl get services                    # List services
kubectl get all                         # List pods, services, deployments, etc.

# Describe (detailed info + events)
kubectl describe pod <pod-name>         # Very useful for debugging
kubectl describe deployment <name>
kubectl describe service <name>

# Create / Apply
kubectl apply -f my-file.yaml           # Create or update resource from YAML
kubectl apply -f ./k8s/                 # Apply all YAML files in a directory

# Delete
kubectl delete -f my-file.yaml          # Delete resource defined in YAML
kubectl delete pod <pod-name>           # Delete a specific pod
kubectl delete deployment <name>        # Delete deployment + its pods

# Logs
kubectl logs <pod-name>                 # View pod logs
kubectl logs <pod-name> -f              # Stream logs (like tail -f)
kubectl logs <pod-name> -c <container>  # Logs for a specific container in pod
kubectl logs <pod-name> --previous      # Logs from previous crashed container

# Execute commands in a pod
kubectl exec -it <pod-name> -- /bin/sh  # Open a shell inside the pod
kubectl exec <pod-name> -- ls /app      # Run a command in the pod

# Port forwarding (access a pod/service from your machine)
kubectl port-forward pod/<name> 8080:3000       # localhost:8080 -> pod:3000
kubectl port-forward service/<name> 8080:80     # localhost:8080 -> service:80

# Scaling
kubectl scale deployment <name> --replicas=5    # Scale to 5 pods

# Rollout
kubectl rollout status deployment <name>        # Watch rollout progress
kubectl rollout history deployment <name>        # View rollout history
kubectl rollout undo deployment <name>           # Rollback to previous version
```

### Context and namespaces

```bash
kubectl config get-contexts             # List all clusters/contexts
kubectl config use-context <name>       # Switch to a different cluster
kubectl config set-context --current --namespace=my-ns  # Set default namespace

kubectl get namespaces                  # List namespaces
kubectl create namespace my-ns          # Create a namespace
```

---

## Setting Up a Local Cluster

### Option 1: Docker Desktop (easiest)

1. Install Docker Desktop
2. Open Settings > Kubernetes > Enable Kubernetes
3. Click "Apply & Restart"
4. Verify: `kubectl get nodes`

### Option 2: minikube

```bash
# Install
brew install minikube            # macOS
# or: curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64
#     sudo install minikube-linux-amd64 /usr/local/bin/minikube

# Start cluster
minikube start

# Useful commands
minikube status                  # Check cluster status
minikube dashboard               # Open web UI
minikube service <name> --url    # Get URL for a service
minikube stop                    # Stop the cluster
minikube delete                  # Delete the cluster entirely
```

### Option 3: kind (Kubernetes in Docker)

```bash
# Install
brew install kind                # macOS
# or: go install sigs.k8s.io/kind@latest

# Create cluster
kind create cluster --name my-cluster

# Delete cluster
kind delete cluster --name my-cluster
```

---

## Full Example: Deploying a Node.js Backend + Frontend

This section walks through a complete, production-style deployment step by step.

### What we're building

```
Internet
    │
    ▼
┌─────────┐     ┌─────────────────────────────────────┐
│ Ingress  │────▶│ Kubernetes Cluster                   │
│ (router) │     │                                      │
└─────────┘     │  /api/* ──▶ backend-service (port 80)│
                │              │                        │
                │              ▼                        │
                │         ┌─────────┐                   │
                │         │Backend  │ x3 replicas       │
                │         │Pod :3000│                   │
                │         └─────────┘                   │
                │                                      │
                │  /* ────▶ frontend-service (port 80) │
                │              │                        │
                │              ▼                        │
                │         ┌─────────┐                   │
                │         │Frontend │ x2 replicas       │
                │         │Pod :80  │ (nginx + static)  │
                │         └─────────┘                   │
                └──────────────────────────────────────┘
```

### Step 1: The Node.js Backend

Create a simple Express API.

**File: `backend/package.json`**

```json
{
  "name": "k8s-backend",
  "version": "1.0.0",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.0"
  }
}
```

**File: `backend/server.js`**

```javascript
const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/api/message", (req, res) => {
  res.json({ message: "Hello from the backend!" });
});

app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
});
```

**File: `backend/Dockerfile`**

```dockerfile
# Stage 1: Install dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Stage 2: Production image
FROM node:20-alpine
WORKDIR /app

# Don't run as root (security best practice)
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

COPY --from=deps /app/node_modules ./node_modules
COPY server.js ./

EXPOSE 3000
CMD ["node", "server.js"]
```

**Build and test locally:**

```bash
cd backend
docker build -t my-backend:1.0.0 .
docker run -p 3000:3000 my-backend:1.0.0
# Visit http://localhost:3000/api/health
```

### Step 2: The Node.js Frontend

A simple React/Vite app that calls the backend API. After building, it's just static HTML/CSS/JS served by nginx.

**File: `frontend/src/App.jsx`** (simplified)

```jsx
import { useState, useEffect } from "react";

function App() {
  const [message, setMessage] = useState("Loading...");

  useEffect(() => {
    fetch("/api/message")
      .then((res) => res.json())
      .then((data) => setMessage(data.message))
      .catch(() => setMessage("Failed to connect to backend"));
  }, []);

  return (
    <div>
      <h1>My K8s App</h1>
      <p>Backend says: {message}</p>
    </div>
  );
}

export default App;
```

**File: `frontend/nginx.conf`**

This nginx config serves the static frontend files and is baked into the Docker image. Note: in K8s, the Ingress handles routing `/api` to the backend — nginx just serves static files.

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    # Serve static files
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets aggressively
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

**File: `frontend/Dockerfile`**

```dockerfile
# Stage 1: Build the frontend
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**Build and test locally:**

```bash
cd frontend
docker build -t my-frontend:1.0.0 .
docker run -p 8080:80 my-frontend:1.0.0
# Visit http://localhost:8080
```

### Step 3: Push Images to a Registry

K8s needs to pull images from a registry. For local development with minikube, you can load images directly. For production, push to Docker Hub, GitHub Container Registry, or a private registry.

```bash
# Option A: Docker Hub
docker login
docker tag my-backend:1.0.0 yourusername/my-backend:1.0.0
docker tag my-frontend:1.0.0 yourusername/my-frontend:1.0.0
docker push yourusername/my-backend:1.0.0
docker push yourusername/my-frontend:1.0.0

# Option B: minikube (load directly, no push needed)
minikube image load my-backend:1.0.0
minikube image load my-frontend:1.0.0
```

### Step 4: Kubernetes YAML Files

Create a `k8s/` directory for all manifests.

**File: `k8s/namespace.yaml`**

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: my-app
```

**File: `k8s/backend-deployment.yaml`**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
  namespace: my-app
  labels:
    app: backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
    spec:
      containers:
        - name: backend
          image: yourusername/my-backend:1.0.0 # Change to your image
          # For minikube with local images, add:
          # imagePullPolicy: Never
          ports:
            - containerPort: 3000
          env:
            - name: PORT
              value: "3000"
            - name: NODE_ENV
              value: "production"
          # Resource limits - prevents a pod from consuming too much
          resources:
            requests: # Minimum guaranteed resources
              cpu: "100m" # 100 millicores = 0.1 CPU
              memory: "128Mi" # 128 megabytes
            limits: # Maximum allowed resources
              cpu: "500m" # 500 millicores = 0.5 CPU
              memory: "256Mi" # 256 megabytes
          # Health check: is the container alive?
          livenessProbe:
            httpGet:
              path: /api/health
              port: 3000
            initialDelaySeconds: 10 # Wait 10s before first check
            periodSeconds: 15 # Check every 15s
          # Ready check: should traffic be sent to this pod?
          readinessProbe:
            httpGet:
              path: /api/health
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 5
```

**File: `k8s/backend-service.yaml`**

```yaml
apiVersion: v1
kind: Service
metadata:
  name: backend-service
  namespace: my-app
spec:
  selector:
    app: backend # Matches pods with label app=backend
  ports:
    - port: 80 # Service port (what other services connect to)
      targetPort: 3000 # Container port (where your app listens)
      protocol: TCP
  type: ClusterIP # Internal only — Ingress will expose it
```

**File: `k8s/frontend-deployment.yaml`**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
  namespace: my-app
  labels:
    app: frontend
spec:
  replicas: 2
  selector:
    matchLabels:
      app: frontend
  template:
    metadata:
      labels:
        app: frontend
    spec:
      containers:
        - name: frontend
          image: yourusername/my-frontend:1.0.0 # Change to your image
          ports:
            - containerPort: 80
          resources:
            requests:
              cpu: "50m"
              memory: "64Mi"
            limits:
              cpu: "200m"
              memory: "128Mi"
          livenessProbe:
            httpGet:
              path: /
              port: 80
            initialDelaySeconds: 5
            periodSeconds: 15
          readinessProbe:
            httpGet:
              path: /
              port: 80
            initialDelaySeconds: 3
            periodSeconds: 5
```

**File: `k8s/frontend-service.yaml`**

```yaml
apiVersion: v1
kind: Service
metadata:
  name: frontend-service
  namespace: my-app
spec:
  selector:
    app: frontend
  ports:
    - port: 80
      targetPort: 80
      protocol: TCP
  type: ClusterIP
```

**File: `k8s/ingress.yaml`**

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: app-ingress
  namespace: my-app
  annotations:
    # nginx ingress controller specific settings
    nginx.ingress.kubernetes.io/rewrite-target: /$1
spec:
  ingressClassName: nginx
  rules:
    - host: myapp.local # Use this for local dev (add to /etc/hosts)
      http:
        paths:
          # API routes go to backend
          - path: /api/(.*)
            pathType: ImplementationSpecific
            backend:
              service:
                name: backend-service
                port:
                  number: 80
          # Everything else goes to frontend
          - path: /(.*)
            pathType: ImplementationSpecific
            backend:
              service:
                name: frontend-service
                port:
                  number: 80
```

### Step 5: Deploy Everything

```bash
# 1. Make sure your cluster is running
kubectl cluster-info

# 2. If using minikube, enable the ingress addon
minikube addons enable ingress

# 3. Apply all manifests (order matters for namespace)
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/

# 4. Watch pods start up
kubectl get pods -n my-app -w
# NAME                        READY   STATUS    RESTARTS   AGE
# backend-6d4f5b8c9-abc12     1/1     Running   0          30s
# backend-6d4f5b8c9-def34     1/1     Running   0          30s
# backend-6d4f5b8c9-ghi56     1/1     Running   0          30s
# frontend-7c8d9e0f1-jkl78    1/1     Running   0          30s
# frontend-7c8d9e0f1-mno90    1/1     Running   0          30s

# 5. Check services
kubectl get services -n my-app
# NAME               TYPE        CLUSTER-IP      PORT(S)
# backend-service    ClusterIP   10.96.123.45    80/TCP
# frontend-service   ClusterIP   10.96.123.67    80/TCP

# 6. Check ingress
kubectl get ingress -n my-app

# 7. For minikube: get the cluster IP and add to /etc/hosts
minikube ip
# Add to /etc/hosts: <minikube-ip>  myapp.local

# 8. For Docker Desktop: the ingress is at localhost
# Add to /etc/hosts: 127.0.0.1  myapp.local

# 9. Visit http://myapp.local in your browser
```

### Step 6: Quick Access Without Ingress (port-forward)

If you don't want to set up an Ingress controller, use port-forwarding for quick testing:

```bash
# Forward backend
kubectl port-forward -n my-app service/backend-service 3000:80 &

# Forward frontend
kubectl port-forward -n my-app service/frontend-service 8080:80 &

# Now visit:
# Backend:  http://localhost:3000/api/health
# Frontend: http://localhost:8080
```

### Step 7: Deploying Updates

When you update your code:

```bash
# 1. Build new image with new tag
docker build -t yourusername/my-backend:1.1.0 ./backend

# 2. Push to registry
docker push yourusername/my-backend:1.1.0

# 3. Update the deployment image
kubectl set image deployment/backend \
  backend=yourusername/my-backend:1.1.0 \
  -n my-app

# 4. Watch the rolling update
kubectl rollout status deployment/backend -n my-app
# Waiting for deployment "backend" rollout to finish: 1 out of 3 new replicas have been updated...
# Waiting for deployment "backend" rollout to finish: 2 out of 3 new replicas have been updated...
# deployment "backend" successfully rolled out

# 5. If something goes wrong, rollback
kubectl rollout undo deployment/backend -n my-app
```

---

## Full Example: Deploying a Python (Flask) Backend + Frontend

This mirrors the Node.js example above but uses Python with Flask for the backend. The frontend is the same pattern — static assets served by nginx.

### What we're building

Same architecture as the Node.js example:

```
Internet ──▶ Ingress ──▶ /api/* ──▶ python-backend-service ──▶ Flask pods (x3)
                     ──▶ /*    ──▶ python-frontend-service ──▶ nginx pods (x2)
```

### Step 1: The Python Backend

**File: `python-backend/requirements.txt`**

```
flask==3.1.0
gunicorn==23.0.0
```

- `flask` is the web framework (like Express for Node.js).
- `gunicorn` is a production WSGI server (Flask's built-in server is for development only — it can't handle real traffic).

**File: `python-backend/app.py`**

```python
import os
from datetime import datetime, timezone
from flask import Flask, jsonify

app = Flask(__name__)


@app.route("/api/health")
def health():
    return jsonify({
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat()
    })


@app.route("/api/message")
def message():
    return jsonify({"message": "Hello from the Python backend!"})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
```

**File: `python-backend/Dockerfile`**

```dockerfile
# Stage 1: Install dependencies
FROM python:3.12-slim AS deps
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Stage 2: Production image
FROM python:3.12-slim
WORKDIR /app

# Don't run as root
RUN groupadd -r appgroup && useradd -r -g appgroup appuser

# Copy installed packages from deps stage
COPY --from=deps /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=deps /usr/local/bin/gunicorn /usr/local/bin/gunicorn
COPY app.py .

USER appuser

EXPOSE 5000

# Use gunicorn for production
# -w 4: 4 worker processes (rule of thumb: 2 * CPU cores + 1)
# -b 0.0.0.0:5000: bind to all interfaces on port 5000
CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "app:app"]
```

**Why gunicorn instead of `python app.py`?**

Flask's built-in server handles one request at a time. Gunicorn spawns multiple worker processes, each handling requests concurrently. It's like the difference between running `node server.js` and using a process manager like PM2 — except in Python it's more critical because of the GIL (Global Interpreter Lock).

**Build and test locally:**

```bash
cd python-backend
docker build -t my-python-backend:1.0.0 .
docker run -p 5000:5000 my-python-backend:1.0.0
# Visit http://localhost:5000/api/health
```

### Step 2: The Frontend

The frontend is identical to the Node.js example — it's just static HTML/CSS/JS served by nginx. The only difference is the API responses come from Flask instead of Express.

Use the same `frontend/Dockerfile` and `frontend/nginx.conf` from the Node.js section. The frontend doesn't care whether the backend is Node.js or Python — it just calls `/api/*` endpoints.

### Step 3: Push Images

```bash
# Docker Hub
docker tag my-python-backend:1.0.0 yourusername/my-python-backend:1.0.0
docker push yourusername/my-python-backend:1.0.0

# minikube (no push needed)
minikube image load my-python-backend:1.0.0
```

### Step 4: Kubernetes YAML Files

**File: `k8s-python/namespace.yaml`**

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: my-python-app
```

**File: `k8s-python/backend-deployment.yaml`**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: python-backend
  namespace: my-python-app
  labels:
    app: python-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: python-backend
  template:
    metadata:
      labels:
        app: python-backend
    spec:
      containers:
        - name: python-backend
          image: yourusername/my-python-backend:1.0.0
          ports:
            - containerPort: 5000
          env:
            - name: PORT
              value: "5000"
            # Flask/gunicorn specific env vars
            - name: FLASK_ENV
              value: "production"
            # Number of gunicorn workers (can tune based on pod CPU)
            - name: WEB_CONCURRENCY
              value: "4"
          resources:
            requests:
              cpu: "100m"
              memory: "128Mi"
            limits:
              cpu: "500m"
              memory: "256Mi"
          livenessProbe:
            httpGet:
              path: /api/health
              port: 5000
            initialDelaySeconds: 10
            periodSeconds: 15
          readinessProbe:
            httpGet:
              path: /api/health
              port: 5000
            initialDelaySeconds: 5
            periodSeconds: 5
```

**File: `k8s-python/backend-service.yaml`**

```yaml
apiVersion: v1
kind: Service
metadata:
  name: python-backend-service
  namespace: my-python-app
spec:
  selector:
    app: python-backend
  ports:
    - port: 80
      targetPort: 5000 # Gunicorn listens on 5000
      protocol: TCP
  type: ClusterIP
```

**File: `k8s-python/frontend-deployment.yaml`**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
  namespace: my-python-app
  labels:
    app: frontend
spec:
  replicas: 2
  selector:
    matchLabels:
      app: frontend
  template:
    metadata:
      labels:
        app: frontend
    spec:
      containers:
        - name: frontend
          image: yourusername/my-frontend:1.0.0
          ports:
            - containerPort: 80
          resources:
            requests:
              cpu: "50m"
              memory: "64Mi"
            limits:
              cpu: "200m"
              memory: "128Mi"
          livenessProbe:
            httpGet:
              path: /
              port: 80
            initialDelaySeconds: 5
            periodSeconds: 15
          readinessProbe:
            httpGet:
              path: /
              port: 80
            initialDelaySeconds: 3
            periodSeconds: 5
```

**File: `k8s-python/frontend-service.yaml`**

```yaml
apiVersion: v1
kind: Service
metadata:
  name: python-frontend-service
  namespace: my-python-app
spec:
  selector:
    app: frontend
  ports:
    - port: 80
      targetPort: 80
      protocol: TCP
  type: ClusterIP
```

**File: `k8s-python/ingress.yaml`**

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: python-app-ingress
  namespace: my-python-app
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /$1
spec:
  ingressClassName: nginx
  rules:
    - host: python-app.local
      http:
        paths:
          - path: /api/(.*)
            pathType: ImplementationSpecific
            backend:
              service:
                name: python-backend-service
                port:
                  number: 80
          - path: /(.*)
            pathType: ImplementationSpecific
            backend:
              service:
                name: python-frontend-service
                port:
                  number: 80
```

### Step 5: Deploy

```bash
# Apply everything
kubectl apply -f k8s-python/namespace.yaml
kubectl apply -f k8s-python/

# Watch pods come up
kubectl get pods -n my-python-app -w

# Quick test with port-forward
kubectl port-forward -n my-python-app service/python-backend-service 5000:80 &
curl http://localhost:5000/api/health
# {"status":"ok","timestamp":"2026-03-06T12:00:00+00:00"}

# For full access via Ingress, add to /etc/hosts:
# <minikube-ip or 127.0.0.1>  python-app.local
```

### Node.js vs Python: Key Differences in K8s

| Aspect                | Node.js                                            | Python (Flask)                                               |
| --------------------- | -------------------------------------------------- | ------------------------------------------------------------ |
| **Production server** | Node itself (single-threaded event loop)           | Gunicorn (multi-process WSGI server)                         |
| **Default port**      | 3000 (convention)                                  | 5000 (Flask default)                                         |
| **Concurrency model** | Async I/O, single process handles many connections | Multiple worker processes via gunicorn                       |
| **Container port**    | `containerPort: 3000`                              | `containerPort: 5000`                                        |
| **Health check**      | Same pattern — HTTP GET to `/api/health`           | Same pattern — HTTP GET to `/api/health`                     |
| **Image size**        | `node:20-alpine` ~180MB                            | `python:3.12-slim` ~150MB                                    |
| **CPU tuning**        | Increase pod replicas (horizontal)                 | Increase `WEB_CONCURRENCY` (vertical) AND pod replicas       |
| **Memory**            | V8 can be hungry, set `--max-old-space-size`       | Generally lighter per worker, but `workers * memory` adds up |

**Important**: The K8s YAML is nearly identical for both. The only things that change are:

- The Docker image name
- The `containerPort` (3000 vs 5000)
- The `targetPort` in the Service (3000 vs 5000)
- Environment variables specific to the runtime

Everything else — Deployments, Services, Ingress, health checks, scaling, ConfigMaps, Secrets — works exactly the same way regardless of language.

---

## Networking Deep Dive

### How pods communicate

Every pod gets its own IP address. Pods can reach each other directly by IP, but IPs change when pods restart. That's why you use Services.

```
Pod A (10.244.1.5) ──── wants to talk to ────▶ backend-service
                                                    │
                                        ┌───────────┼───────────┐
                                        ▼           ▼           ▼
                                    Pod B       Pod C       Pod D
                                 (10.244.1.6) (10.244.2.3) (10.244.3.1)
```

### DNS in Kubernetes

K8s has built-in DNS. Every Service gets a DNS name:

```
<service-name>.<namespace>.svc.cluster.local
```

Examples:

```bash
# From any pod in the "my-app" namespace:
curl http://backend-service              # Same namespace, short name works
curl http://backend-service.my-app       # With namespace
curl http://backend-service.my-app.svc.cluster.local  # Full DNS name
```

This is how your frontend (or any pod) talks to the backend — by service name, not IP.

### Network flow summary

```
External request
       │
       ▼
┌──────────────┐
│   Ingress    │  Routes by path/host
│  Controller  │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Service    │  Load balances across pods
│  (ClusterIP) │
└──────┬───────┘
       │
  ┌────┼────┐
  ▼    ▼    ▼
[Pod] [Pod] [Pod]
```

---

## Storage

### Volume types

| Type                    | Lifetime           | Use case                                                     |
| ----------------------- | ------------------ | ------------------------------------------------------------ |
| `emptyDir`              | Same as pod        | Temp scratch space, shared between containers in a pod       |
| `hostPath`              | Same as node       | Access host filesystem (dev only, not portable)              |
| `PersistentVolumeClaim` | Independent of pod | Databases, file uploads, anything that must survive restarts |
| `configMap` / `secret`  | Cluster lifetime   | Mount config files into pods                                 |

### Example: Pod with a PVC

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: data-pvc
  namespace: my-app
spec:
  accessModes:
    - ReadWriteOnce # One node can mount read-write at a time
  resources:
    requests:
      storage: 5Gi
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
  namespace: my-app
spec:
  replicas: 1 # Only 1 if using ReadWriteOnce
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
    spec:
      containers:
        - name: backend
          image: yourusername/my-backend:1.0.0
          volumeMounts:
            - name: data-volume
              mountPath: /app/data # Inside the container, data persists here
      volumes:
        - name: data-volume
          persistentVolumeClaim:
            claimName: data-pvc
```

---

## Configuration and Secrets

### Using ConfigMap as environment variables

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: backend-config
  namespace: my-app
data:
  DATABASE_HOST: "postgres-service"
  DATABASE_PORT: "5432"
  LOG_LEVEL: "info"
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
  namespace: my-app
spec:
  # ... (selector, replicas, etc.)
  template:
    spec:
      containers:
        - name: backend
          image: yourusername/my-backend:1.0.0
          # Option 1: Load all keys as env vars
          envFrom:
            - configMapRef:
                name: backend-config
          # Option 2: Pick specific keys
          env:
            - name: DB_HOST
              valueFrom:
                configMapKeyRef:
                  name: backend-config
                  key: DATABASE_HOST
```

### Using Secrets as environment variables

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: backend-secrets
  namespace: my-app
type: Opaque
data:
  DATABASE_PASSWORD: cGFzc3dvcmQxMjM=
---
# In the deployment:
envFrom:
  - secretRef:
      name: backend-secrets
```

### Creating secrets from command line

```bash
# From literal values (K8s base64-encodes them for you)
kubectl create secret generic backend-secrets \
  --from-literal=DATABASE_PASSWORD=password123 \
  --from-literal=API_KEY=mysecretkey \
  -n my-app

# From a file
kubectl create secret generic tls-cert \
  --from-file=cert.pem \
  --from-file=key.pem \
  -n my-app
```

---

## Health Checks

K8s uses probes to know if your app is healthy.

### Three types of probes

| Probe              | Question it answers         | What happens on failure                          |
| ------------------ | --------------------------- | ------------------------------------------------ |
| **livenessProbe**  | "Is the process alive?"     | K8s kills and restarts the container             |
| **readinessProbe** | "Can it handle traffic?"    | K8s stops sending traffic to this pod            |
| **startupProbe**   | "Has it finished starting?" | K8s waits (doesn't check liveness/readiness yet) |

### Probe methods

```yaml
# HTTP check (most common for web apps)
livenessProbe:
  httpGet:
    path: /api/health
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 15
  failureThreshold: 3          # Kill after 3 consecutive failures

# TCP check (for non-HTTP services like databases)
livenessProbe:
  tcpSocket:
    port: 5432
  periodSeconds: 10

# Command check (run a command inside the container)
livenessProbe:
  exec:
    command:
      - cat
      - /tmp/healthy
  periodSeconds: 10
```

### Why readiness probes matter

Without a readiness probe, K8s sends traffic to pods the moment they start — even if your app hasn't finished initializing (connecting to database, loading config, warming caches). A readiness probe tells K8s "wait, I'm not ready yet."

```yaml
readinessProbe:
  httpGet:
    path: /api/health
    port: 3000
  initialDelaySeconds: 5 # Start checking after 5s
  periodSeconds: 5 # Check every 5s
  successThreshold: 1 # 1 success = ready
  failureThreshold: 3 # 3 failures = not ready, stop sending traffic
```

---

## Scaling

### Manual scaling

```bash
kubectl scale deployment backend --replicas=5 -n my-app
```

### Horizontal Pod Autoscaler (HPA)

Automatically scales pods based on CPU/memory usage.

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: backend-hpa
  namespace: my-app
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: backend
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70 # Scale up when avg CPU > 70%
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80 # Scale up when avg memory > 80%
```

```bash
# Apply the HPA
kubectl apply -f k8s/hpa.yaml

# Watch autoscaling in action
kubectl get hpa -n my-app -w
# NAME          REFERENCE            TARGETS   MINPODS   MAXPODS   REPLICAS
# backend-hpa  Deployment/backend   25%/70%   2         10        3
```

**Important**: HPA requires the [metrics-server](https://github.com/kubernetes-sigs/metrics-server) to be installed in the cluster. minikube: `minikube addons enable metrics-server`.

---

## Rolling Updates and Rollbacks

### How rolling updates work

When you change a Deployment's image, K8s gradually replaces old pods with new ones:

```
Time 0:  [old] [old] [old]           3 old pods running
Time 1:  [old] [old] [old] [NEW]     1 new pod starting
Time 2:  [old] [old] [NEW] [NEW]     old pod terminated, new ready
Time 3:  [old] [NEW] [NEW] [NEW]     continuing...
Time 4:  [NEW] [NEW] [NEW]           all updated, zero downtime
```

### Controlling the rollout strategy

```yaml
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1 # Max extra pods during update (can be number or %)
      maxUnavailable: 0 # Never have fewer than desired replicas
```

- `maxSurge: 1` + `maxUnavailable: 0` = safest. Always maintains full capacity.
- `maxSurge: 0` + `maxUnavailable: 1` = no extra resources needed, but reduced capacity during update.

### Rollback commands

```bash
# View rollout history
kubectl rollout history deployment/backend -n my-app

# Rollback to previous version
kubectl rollout undo deployment/backend -n my-app

# Rollback to a specific revision
kubectl rollout undo deployment/backend --to-revision=2 -n my-app
```

---

## Namespaces

Namespaces are virtual clusters within a physical cluster. They isolate resources.

```bash
# Default namespaces
kubectl get namespaces
# NAME              STATUS   AGE
# default           Active   1d    <-- where resources go if you don't specify
# kube-system       Active   1d    <-- K8s internal components
# kube-public       Active   1d    <-- publicly readable
# kube-node-lease   Active   1d    <-- node heartbeats

# Create and use
kubectl create namespace staging
kubectl create namespace production

# Deploy to a specific namespace
kubectl apply -f deployment.yaml -n staging

# Set default namespace (so you don't need -n every time)
kubectl config set-context --current --namespace=my-app
```

### When to use namespaces

- **By environment**: `development`, `staging`, `production`
- **By team**: `team-frontend`, `team-backend`
- **By app**: `my-app`, `monitoring`, `logging`

### Resource quotas per namespace

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: my-app-quota
  namespace: my-app
spec:
  hard:
    requests.cpu: "4" # Total CPU requests across all pods
    requests.memory: "8Gi"
    limits.cpu: "8"
    limits.memory: "16Gi"
    pods: "20" # Max 20 pods in this namespace
```

---

## RBAC (Role-Based Access Control)

Controls who can do what in the cluster.

### Key concepts

- **ServiceAccount**: Identity for pods (like a user account for applications)
- **Role**: Defines permissions within a namespace
- **ClusterRole**: Defines permissions cluster-wide
- **RoleBinding**: Grants a Role to a user/ServiceAccount
- **ClusterRoleBinding**: Grants a ClusterRole cluster-wide

### Example: Read-only access for a monitoring service

```yaml
# Create a ServiceAccount
apiVersion: v1
kind: ServiceAccount
metadata:
  name: monitoring-sa
  namespace: my-app
---
# Define what it can do
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: pod-reader
  namespace: my-app
rules:
  - apiGroups: [""] # core API group
    resources: ["pods", "services"]
    verbs: ["get", "list", "watch"]
---
# Bind the role to the service account
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: monitoring-binding
  namespace: my-app
subjects:
  - kind: ServiceAccount
    name: monitoring-sa
    namespace: my-app
roleRef:
  kind: Role
  name: pod-reader
  apiGroup: rbac.authorization.k8s.io
```

---

## Helm

Helm is a package manager for K8s. Instead of managing many YAML files, you use **charts** (templated YAML bundles).

### Why Helm?

Without Helm, deploying to staging vs production means maintaining near-identical YAML files with slightly different values (different image tags, replica counts, resource limits). Helm lets you template these differences.

### Basic usage

```bash
# Install Helm
brew install helm              # macOS
# or: curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# Add a chart repository
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update

# Search for charts
helm search repo nginx

# Install a chart
helm install my-nginx bitnami/nginx -n my-app

# Install with custom values
helm install my-nginx bitnami/nginx \
  --set replicaCount=3 \
  --set service.type=ClusterIP \
  -n my-app

# List installed releases
helm list -n my-app

# Upgrade a release
helm upgrade my-nginx bitnami/nginx --set replicaCount=5 -n my-app

# Rollback
helm rollback my-nginx 1 -n my-app

# Uninstall
helm uninstall my-nginx -n my-app
```

### Creating your own chart

```bash
helm create my-app-chart
# Creates:
# my-app-chart/
# ├── Chart.yaml          # Chart metadata
# ├── values.yaml         # Default values
# ├── templates/
# │   ├── deployment.yaml # Templated deployment
# │   ├── service.yaml    # Templated service
# │   ├── ingress.yaml    # Templated ingress
# │   └── ...
# └── charts/             # Sub-charts (dependencies)
```

**`values.yaml`** (your configuration knobs):

```yaml
backend:
  replicaCount: 3
  image:
    repository: yourusername/my-backend
    tag: "1.0.0"
  resources:
    requests:
      cpu: 100m
      memory: 128Mi

frontend:
  replicaCount: 2
  image:
    repository: yourusername/my-frontend
    tag: "1.0.0"
```

**`templates/deployment.yaml`** (uses Go templating):

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ .Release.Name }}-backend
spec:
  replicas: {{ .Values.backend.replicaCount }}
  template:
    spec:
      containers:
        - name: backend
          image: "{{ .Values.backend.image.repository }}:{{ .Values.backend.image.tag }}"
```

Deploy with different values per environment:

```bash
# Staging
helm install my-app ./my-app-chart -f values-staging.yaml -n staging

# Production
helm install my-app ./my-app-chart -f values-production.yaml -n production
```

---

## Monitoring and Logging

### Viewing logs

```bash
# Single pod
kubectl logs backend-6d4f5b8c9-abc12 -n my-app

# All pods of a deployment (using labels)
kubectl logs -l app=backend -n my-app

# Stream logs
kubectl logs -f -l app=backend -n my-app

# Last 100 lines
kubectl logs --tail=100 -l app=backend -n my-app

# Logs from the last hour
kubectl logs --since=1h -l app=backend -n my-app
```

### Resource usage

```bash
# Node resource usage
kubectl top nodes

# Pod resource usage
kubectl top pods -n my-app

# Sort by CPU
kubectl top pods -n my-app --sort-by=cpu
```

### Popular monitoring stack

- **Prometheus**: Collects metrics from pods/nodes
- **Grafana**: Visualizes metrics in dashboards
- **Loki**: Log aggregation (like ELK but lighter)

Quick install with Helm:

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install monitoring prometheus-community/kube-prometheus-stack -n monitoring --create-namespace
```

---

## Common Pitfalls

### 1. ImagePullBackOff

```
STATUS: ImagePullBackOff
```

**Cause**: K8s can't pull your Docker image.
**Fix**:

- Check image name and tag: `kubectl describe pod <name> -n my-app`
- For private registries, create an image pull secret:

```bash
kubectl create secret docker-registry regcred \
  --docker-server=https://index.docker.io/v1/ \
  --docker-username=yourusername \
  --docker-password=yourpassword \
  -n my-app
```

Then add to your deployment:

```yaml
spec:
  imagePullSecrets:
    - name: regcred
```

### 2. CrashLoopBackOff

```
STATUS: CrashLoopBackOff
```

**Cause**: Your container starts and immediately crashes. K8s keeps restarting it.
**Fix**:

```bash
# Check logs to see why it crashed
kubectl logs <pod-name> -n my-app
kubectl logs <pod-name> --previous -n my-app  # Logs from the last crash

# Common causes:
# - App crashes on startup (missing env vars, can't connect to DB)
# - Wrong CMD/ENTRYPOINT in Dockerfile
# - Port mismatch (app listens on 8080, containerPort says 3000)
```

### 3. Pending pods

```
STATUS: Pending
```

**Cause**: K8s can't schedule the pod on any node.
**Fix**:

```bash
kubectl describe pod <pod-name> -n my-app
# Look at "Events" section at the bottom

# Common causes:
# - Insufficient resources (requests exceed available CPU/memory)
# - Node selectors/taints prevent scheduling
# - PVC can't be bound (storage class not available)
```

### 4. Service not reachable

**Checklist**:

```bash
# 1. Are pods running?
kubectl get pods -n my-app -l app=backend

# 2. Do pods have the right labels?
kubectl get pods -n my-app --show-labels

# 3. Does the service selector match pod labels?
kubectl describe service backend-service -n my-app

# 4. Are endpoints populated? (If empty, selector doesn't match)
kubectl get endpoints backend-service -n my-app

# 5. Test connectivity from inside the cluster
kubectl run debug --rm -it --image=busybox -n my-app -- /bin/sh
# Inside the debug pod:
wget -qO- http://backend-service/api/health
```

### 5. OOMKilled

```
STATUS: OOMKilled
```

**Cause**: Container exceeded its memory limit.
**Fix**: Increase `resources.limits.memory` in your deployment, or fix the memory leak in your app.

---

## Glossary

| Term                 | Definition                                                                  |
| -------------------- | --------------------------------------------------------------------------- |
| **Cluster**          | A set of nodes running K8s                                                  |
| **Node**             | A machine (VM or physical) in the cluster                                   |
| **Pod**              | Smallest deployable unit, wraps one or more containers                      |
| **Deployment**       | Manages pods: desired replica count, rolling updates                        |
| **Service**          | Stable network endpoint for a set of pods                                   |
| **Ingress**          | Routes external HTTP traffic to services                                    |
| **ConfigMap**        | Non-sensitive configuration data                                            |
| **Secret**           | Sensitive configuration data (base64-encoded)                               |
| **Namespace**        | Virtual cluster for resource isolation                                      |
| **PV/PVC**           | Persistent storage that outlives pods                                       |
| **HPA**              | Horizontal Pod Autoscaler — auto-scales by metrics                          |
| **DaemonSet**        | Ensures a pod runs on every (or selected) node                              |
| **StatefulSet**      | Like Deployment but for stateful apps (stable network IDs, ordered startup) |
| **Job**              | Runs a pod to completion (batch work)                                       |
| **CronJob**          | Runs a Job on a schedule                                                    |
| **kubelet**          | Agent on each node that manages pods                                        |
| **kube-proxy**       | Handles networking rules on each node                                       |
| **etcd**             | Distributed key-value store for all cluster data                            |
| **Helm**             | Package manager for K8s (charts = templated YAML bundles)                   |
| **Taint/Toleration** | Controls which pods can run on which nodes                                  |
| **Affinity**         | Rules for pod placement preferences                                         |
| **Init Container**   | Runs before app containers (migrations, wait-for-db, etc.)                  |
| **Sidecar**          | Helper container that runs alongside the main container                     |

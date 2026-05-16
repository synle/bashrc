# Docker Desktop + Kubernetes — Hands-On Guide (macOS / Windows)

A focused, step-by-step guide for running a Kubernetes (K8s) cluster locally using **Docker Desktop's built-in K8s** on macOS and Windows, then wiring it into your day-to-day VS Code workflow.

This doc is the "just get me running and productive" companion to:

- [Docker_README.md](Docker_README.md) — Docker concepts, Dockerfiles, Compose
- [K8s_README.md](K8s_README.md) — full Kubernetes reference (resources, networking, RBAC, Helm, etc.)

If you want to go deep on K8s concepts, read `K8s_README.md`. If you want to get a working cluster on your laptop in 15 minutes and deploy something to it, you're in the right place.

---

## Table of Contents

1. [Why Docker Desktop for K8s?](#why-docker-desktop-for-k8s)
2. [Prerequisites](#prerequisites)
3. [Enable Kubernetes in Docker Desktop](#enable-kubernetes-in-docker-desktop)
4. [Install kubectl and Friends](#install-kubectl-and-friends)
5. [Verify the Cluster](#verify-the-cluster)
6. [Your First Deployment](#your-first-deployment)
7. [Build Local Images and Deploy Them](#build-local-images-and-deploy-them)
8. [Exposing Services: port-forward vs NodePort vs Ingress](#exposing-services-port-forward-vs-nodeport-vs-ingress)
9. [Install an Ingress Controller (Optional but Recommended)](#install-an-ingress-controller-optional-but-recommended)
10. [Resource Tuning for Docker Desktop](#resource-tuning-for-docker-desktop)
11. [Resetting / Cleaning Up](#resetting--cleaning-up)
12. [Common Errors](#common-errors)
13. [VS Code Integration](#vs-code-integration)
14. [Daily Workflow Cheat Sheet](#daily-workflow-cheat-sheet)

---

## Why Docker Desktop for K8s?

Docker Desktop ships with an embedded single-node Kubernetes cluster. It's the lowest-friction way to run K8s locally on macOS or Windows:

| Advantage          | Detail                                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------ |
| **Zero install**   | Already bundled — just toggle a checkbox.                                                                    |
| **Same daemon**    | The K8s cluster uses the same container runtime as `docker run`. Images you build locally are visible to it. |
| **Native kubectl** | `kubectl` is wired to the `docker-desktop` context automatically.                                            |
| **Works offline**  | No cloud, no VM image to download (beyond what Docker Desktop already pulls).                                |
| **Easy reset**     | One click to nuke the cluster and start fresh.                                                               |

**Trade-offs vs minikube / kind / k3d:**

- Single node only — no multi-node testing.
- Tied to Docker Desktop's lifecycle. Restart Docker Desktop → K8s restarts too.
- Heavier RAM/CPU footprint than `kind` (which runs nodes _as containers_ inside Docker).

If you ever need multi-node or lighter-weight clusters, see `K8s_README.md` § "Setting Up a Local Cluster".

---

## Prerequisites

- **Docker Desktop installed and running**
  - macOS: `brew install --cask docker` (or download from docker.com)
  - Windows: download the installer from docker.com. WSL 2 backend is the recommended default.
- **At least 4 GB RAM allocated** to Docker Desktop (8 GB is comfortable for K8s + a few apps).
- **At least 20 GB free disk** for images and the cluster's container volume.

Check Docker is healthy:

```bash
docker version
docker info | grep -i "operating system"
```

You should see the Docker client and server versions, and Docker Desktop reported as the OS context.

---

## Enable Kubernetes in Docker Desktop

This is the screen you'll be on (Settings → Kubernetes):

1. Open Docker Desktop.
2. Click the **gear icon** (top right) → **Settings**.
3. In the left sidebar, click **Kubernetes**.
4. Toggle **Enable Kubernetes** ON.
5. Click **Apply & Restart** (bottom right).

Docker Desktop will:

- Download the K8s control plane and node images (first time only — ~500 MB).
- Boot a single-node cluster.
- Wire `kubectl` to talk to it via the `docker-desktop` context.

This takes 1–3 minutes. The taskbar/menu-bar icon shows status. Wait until the bottom status bar reads **"Kubernetes running"** (green dot), not just "Docker Engine running".

### Optional toggles (newer Docker Desktop versions)

- **Show system containers (advanced)** — shows the K8s control-plane pods alongside your own when you run `docker ps`. Useful for debugging, noisy by default.
- **Kubernetes single-node vs multi-node** — if your version exposes this, single-node is correct for local dev.

---

## Install kubectl and Friends

Docker Desktop ships `kubectl` in `$PATH` automatically, but the bundled version can lag behind upstream. Install your own for control:

### macOS

```bash
brew install kubectl                    # the K8s CLI
brew install kubectx                    # adds `kubectx` (switch contexts) + `kubens` (switch namespaces)
brew install kubernetes-helm            # `helm` — K8s package manager
brew install stern                      # multi-pod log tailing — life-changing
brew install k9s                        # terminal UI for K8s — even more life-changing
```

### Windows (PowerShell)

```powershell
winget install -e --id Kubernetes.kubectl
winget install -e --id Helm.Helm
winget install -e --id Derailed.k9s
# kubectx / stern: install via scoop or grab releases from GitHub
scoop install kubectx stern
```

### Windows (WSL 2 — recommended if you use WSL)

```bash
# Inside WSL Ubuntu, same as Linux:
sudo apt-get update && sudo apt-get install -y kubectl
# Or get latest:
curl -fsSL "https://dl.k8s.io/release/$(curl -fsSL https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl" -o /usr/local/bin/kubectl
sudo chmod +x /usr/local/bin/kubectl
```

When Docker Desktop's WSL integration is enabled, the WSL distro automatically gets the `docker-desktop` kube-context too — no extra config.

### What each tool does

| Tool       | What it does                                                                                          |
| ---------- | ----------------------------------------------------------------------------------------------------- |
| `kubectl`  | Core CLI. Talks to the K8s API server.                                                                |
| `kubectx`  | `kubectx docker-desktop` — switch between clusters fast.                                              |
| `kubens`   | `kubens my-app` — set the default namespace for `kubectl` so you don't have to type `-n my-app`.      |
| `helm`     | Install pre-packaged K8s apps (charts). E.g. one command to install nginx-ingress, Prometheus, etc.   |
| `stern`    | `stern -l app=backend` — stream logs from every matching pod into one colored stream.                 |
| `k9s`      | Curses TUI. Hit `:pods` to navigate pods, press Enter to drill in, `l` for logs, `s` for shell. Fast. |

---

## Verify the Cluster

```bash
# 1. List configured contexts
kubectl config get-contexts
# CURRENT   NAME              CLUSTER           AUTHINFO
# *         docker-desktop    docker-desktop    docker-desktop

# 2. If the * isn't on docker-desktop, switch:
kubectl config use-context docker-desktop
# or with kubectx:
kubectx docker-desktop

# 3. Sanity check
kubectl cluster-info
# Kubernetes control plane is running at https://kubernetes.docker.internal:6443
# CoreDNS is running at https://kubernetes.docker.internal:6443/api/v1/...

kubectl get nodes
# NAME             STATUS   ROLES           AGE   VERSION
# docker-desktop   Ready    control-plane   1m    v1.30.x

kubectl get pods -A
# Should show pods in kube-system: coredns, kube-proxy, etcd, kube-apiserver, etc.
```

If you see all that, your cluster is live.

### Why `kubernetes.docker.internal`?

Docker Desktop's K8s API server is exposed at `kubernetes.docker.internal:6443`, a hostname Docker injects into `/etc/hosts` on the host machine. It resolves to a loopback address. This is why `kubectl` "just works" — it's literally talking to a server on your localhost.

---

## Your First Deployment

Let's deploy nginx as a smoke test.

```bash
# Create a deployment
kubectl create deployment hello-nginx --image=nginx:alpine

# Expose it on a cluster-internal Service
kubectl expose deployment hello-nginx --port=80 --target-port=80

# Check status
kubectl get all
# NAME                              READY   STATUS    RESTARTS   AGE
# pod/hello-nginx-xxxxx-yyyyy       1/1     Running   0          15s
# NAME                  TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)
# service/hello-nginx   ClusterIP   10.99.123.45    <none>        80/TCP
# service/kubernetes    ClusterIP   10.96.0.1       <none>        443/TCP

# Access it from your laptop via port-forward
kubectl port-forward service/hello-nginx 8080:80

# In another terminal:
curl http://localhost:8080
# <!DOCTYPE html><html>...Welcome to nginx!...
```

Cleanup:

```bash
kubectl delete deployment hello-nginx
kubectl delete service hello-nginx
```

---

## Build Local Images and Deploy Them

This is the killer feature of Docker Desktop's K8s: **images you build with `docker build` are automatically visible to the cluster**. No registry push, no `minikube image load`, no `kind load docker-image`.

### Step 1 — Build a local image

```bash
mkdir hello-app && cd hello-app
cat > Dockerfile <<'EOF'
FROM nginx:alpine
RUN echo "<h1>Hello from my local K8s cluster!</h1>" > /usr/share/nginx/html/index.html
EOF

docker build -t hello-app:dev .
```

Verify Docker has it:

```bash
docker images hello-app
# REPOSITORY   TAG   IMAGE ID       CREATED         SIZE
# hello-app    dev   abc123def456   3 seconds ago   55MB
```

### Step 2 — Reference it in a Deployment

Write `deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hello-app
spec:
  replicas: 2
  selector:
    matchLabels:
      app: hello-app
  template:
    metadata:
      labels:
        app: hello-app
    spec:
      containers:
        - name: hello-app
          image: hello-app:dev
          # CRITICAL for local images: never try to pull from a remote registry
          imagePullPolicy: IfNotPresent
          ports:
            - containerPort: 80
---
apiVersion: v1
kind: Service
metadata:
  name: hello-app
spec:
  selector:
    app: hello-app
  ports:
    - port: 80
      targetPort: 80
  type: ClusterIP
```

### Step 3 — Apply it

```bash
kubectl apply -f deployment.yaml
kubectl get pods -l app=hello-app -w
# Wait until both pods show Running 1/1

kubectl port-forward service/hello-app 8080:80
# Now visit http://localhost:8080
```

### `imagePullPolicy` — the gotcha you will hit

K8s defaults to `Always` for the `:latest` tag and `IfNotPresent` for everything else. If your image is **only on your local Docker daemon** (not in a registry), and you tag it `:latest`, K8s will try to pull it, fail, and you'll get `ImagePullBackOff`.

Three ways to avoid this:

1. **Use a non-`latest` tag** (`hello-app:dev`, `hello-app:v1`) → `IfNotPresent` is the default.
2. **Explicitly set `imagePullPolicy: IfNotPresent`** in your YAML (or `Never` to forbid pulling entirely).
3. **Push to a real registry** (Docker Hub, ghcr.io) for "production-like" testing.

Rule of thumb for local dev: always set `imagePullPolicy: IfNotPresent` and use semver-ish tags.

### Triggering a redeploy after rebuilding the image

K8s doesn't know your image changed if the _tag_ didn't change. Force a rollout:

```bash
docker build -t hello-app:dev .
kubectl rollout restart deployment/hello-app
kubectl rollout status deployment/hello-app
```

Or use a unique tag every build (e.g., a short git SHA) and `kubectl set image deployment/hello-app hello-app=hello-app:$(git rev-parse --short HEAD)`. This is cleaner for CI.

---

## Exposing Services: port-forward vs NodePort vs Ingress

Three ways to reach your app from your laptop's browser:

| Method                   | Setup effort                | URL                       | Best for                 |
| ------------------------ | --------------------------- | ------------------------- | ------------------------ |
| `kubectl port-forward`   | Zero                        | `http://localhost:<port>` | Quick checks, debugging  |
| `Service type: NodePort` | Trivial YAML change         | `http://localhost:30080`  | Long-running access      |
| Ingress + nginx-ingress  | Install controller + DNS    | `http://myapp.local`      | Realistic multi-app dev  |
| `Service type: LoadBalancer` | Works on Docker Desktop | `http://localhost:80`     | One-app-per-port testing |

### port-forward

```bash
kubectl port-forward service/hello-app 8080:80
# Foreground, ctrl-C to stop. One-to-one mapping.
```

### NodePort

```yaml
spec:
  type: NodePort
  ports:
    - port: 80
      targetPort: 80
      nodePort: 30080 # must be 30000–32767
```

On Docker Desktop, `localhost:30080` reaches the NodePort directly.

### LoadBalancer

Docker Desktop's networking magic makes `type: LoadBalancer` work on `localhost` — it auto-assigns the cluster IP to `127.0.0.1`. You can use the standard port (80, 443, etc.):

```yaml
spec:
  type: LoadBalancer
  ports:
    - port: 8080
      targetPort: 80
```

Then `curl http://localhost:8080`. Note: only one Service can claim a given port at a time.

### Ingress

See the next section.

---

## Install an Ingress Controller (Optional but Recommended)

If you're running multiple apps and want them on real hostnames (e.g., `api.local`, `dashboard.local`), install an Ingress controller. The most common choice is **ingress-nginx**.

```bash
# Install via the official manifest (no Helm needed)
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/HEAD/deploy/static/provider/cloud/deploy.yaml

# Wait for the controller pod to be ready
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=120s
```

The controller's Service is type `LoadBalancer`, and (thanks to Docker Desktop) it binds to `localhost:80` and `localhost:443`.

Then add hostnames to your local DNS by editing the hosts file:

- **macOS / Linux**: `sudo vi /etc/hosts`
- **Windows**: open `C:\Windows\System32\drivers\etc\hosts` as Administrator

Add:

```
127.0.0.1   myapp.local api.local dashboard.local
```

Now you can write Ingress resources like:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: hello-ingress
spec:
  ingressClassName: nginx
  rules:
    - host: myapp.local
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: hello-app
                port:
                  number: 80
```

```bash
kubectl apply -f ingress.yaml
curl http://myapp.local
```

For deeper Ingress patterns (path-based routing, TLS, rewrites), see `K8s_README.md` § "Ingress" and § "Networking Deep Dive".

---

## Resource Tuning for Docker Desktop

Docker Desktop → Settings → **Resources** → **Advanced**.

Suggested starting points:

| Workload                     | CPUs | Memory | Disk image  |
| ---------------------------- | ---- | ------ | ----------- |
| Just Docker, no K8s          | 2    | 4 GB   | 30 GB       |
| K8s + 1–2 small apps         | 4    | 6 GB   | 60 GB       |
| K8s + Helm stack (Prom etc.) | 6    | 10 GB  | 80 GB       |
| Heavy multi-app dev          | 8    | 12 GB+ | 100 GB+     |

**Symptoms of under-allocation:**

- Pods stuck in `Pending` with event `0/1 nodes are available: Insufficient memory`.
- `kubectl` commands hanging for 10+ seconds.
- Docker Desktop's status bar showing high CPU even at idle.

After changing resources, click **Apply & Restart**. Both Docker and K8s will bounce.

---

## Resetting / Cleaning Up

### Soft cleanup — delete all your resources but keep the cluster

```bash
# Delete everything in the default namespace
kubectl delete all --all

# Or, if you scope your work to a namespace (recommended):
kubectl delete namespace my-app
```

### Nuke and reset the cluster

Docker Desktop → Settings → **Kubernetes** → **Reset Kubernetes Cluster** button.

This destroys all K8s state (deployments, services, persistent volumes, namespaces) but keeps the cluster running. Takes ~30 seconds.

### Full reinstall

Docker Desktop → Settings → **Troubleshoot** (bug icon, top right) → **Reset to factory defaults**.

This nukes Docker _and_ K8s, including all images, volumes, and containers. Use as a last resort.

---

## Common Errors

### `Unable to connect to the server: dial tcp 127.0.0.1:6443: connect: connection refused`

K8s isn't running. Open Docker Desktop, confirm the status bar says "Kubernetes running" (green). If it says "Kubernetes starting…", wait.

### `error: You must be logged in to the server (Unauthorized)`

Your `~/.kube/config` is stale, often after a `Reset Kubernetes Cluster`. Fix:

```bash
# Docker Desktop rewrites this automatically on K8s start.
# If it doesn't, toggle K8s off and on in Settings.
kubectl config get-contexts
```

### `ImagePullBackOff` for a local image

You forgot `imagePullPolicy: IfNotPresent` and your tag is `:latest`. See § "Build Local Images" above.

Verify the image actually exists locally:

```bash
docker images <your-image>
# If empty, your `docker build` either failed or used a different name/tag.
```

### `Pending` pods with `Insufficient cpu/memory`

Docker Desktop doesn't have enough resources. Bump in Settings → Resources.

### `CrashLoopBackOff`

Your container is starting and immediately exiting. Check logs:

```bash
kubectl logs <pod-name>
kubectl logs <pod-name> --previous   # logs from the crash before the current restart
kubectl describe pod <pod-name>      # look at "Events" at the bottom
```

### Port already in use on `port-forward`

```
Unable to listen on port 8080: bind: address already in use
```

Another process (or another `port-forward` you forgot about) has it. Pick a different local port: `kubectl port-forward svc/foo 8081:80`.

### K8s won't start at all after Docker Desktop update

Docker Desktop → Settings → Kubernetes → **Reset Kubernetes Cluster**. If that fails, **Reset to factory defaults** (last resort).

---

## VS Code Integration

This is where the workflow gets enjoyable. The goal: edit YAML with autocomplete, see your cluster's state in the sidebar, attach a debugger to a running pod.

### Essential extensions

Install all of these from the Extensions panel (`Ctrl/Cmd + Shift + X`):

| Extension                                                | Publisher       | What it does                                                                                                                              |
| -------------------------------------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Kubernetes** (`ms-kubernetes-tools.vscode-kubernetes-tools`) | Microsoft       | The big one. Sidebar tree of clusters/pods/services. Right-click pods to view logs, get a shell, port-forward, describe.                  |
| **YAML** (`redhat.vscode-yaml`)                          | Red Hat         | YAML language server + K8s schema validation. Catches typos before you `kubectl apply`.                                                   |
| **Docker** (`ms-azuretools.vscode-docker`)               | Microsoft       | Manages Dockerfiles, images, containers, Compose files. Pairs with the K8s extension.                                                     |
| **Bridge to Kubernetes** (`mindaro.mindaro`)             | Microsoft       | Run/debug a service locally while the rest of the system runs in your cluster (advanced — optional).                                      |
| **Helm Intellisense** (`tim-koehler.helm-intellisense`)  | Tim Koehler     | Autocomplete and validation for Helm templates if you write charts.                                                                       |

### Configure K8s YAML schemas (one-time)

Open VS Code settings (`Cmd/Ctrl + ,`), search for `yaml.schemas`, and click **Edit in settings.json**. Add:

```jsonc
{
  "yaml.schemas": {
    "kubernetes": [
      "k8s/**/*.yaml",
      "k8s/**/*.yml",
      "manifests/**/*.yaml",
      "deployment.yaml",
      "service.yaml",
      "ingress.yaml",
      "configmap.yaml",
      "secret.yaml"
    ]
  },
  "yaml.format.enable": true,
  "yaml.validate": true
}
```

Now when you type `kind: Deployment`, you get autocomplete for `spec.replicas`, `spec.template.spec.containers`, etc. Hover any field for inline docs.

### The Kubernetes sidebar (Microsoft extension)

After installing the Kubernetes extension, you get a new sidebar panel (look for the steering-wheel icon, often called "Kubernetes").

The tree looks like:

```
Clusters
  docker-desktop (active)
    Nodes
    Workloads
      Deployments
        hello-app
      Pods
        hello-app-xxx-yyy
        hello-app-xxx-zzz
      …
    Network
      Services
      Ingresses
    Configuration
      ConfigMaps
      Secrets
    Storage
```

**What you can do (right-click anywhere):**

- **On a pod** → Logs, Terminal (shell inside the pod), Describe, Port Forward, Delete
- **On a deployment** → Edit (opens live YAML), Scale, Restart, Delete
- **On a service** → Port Forward, Describe
- **On any resource** → "Follow Logs" or "Get" or "Apply" the YAML

You can also right-click any `.yaml` file in the explorer and pick **Kubernetes: Apply** — this is `kubectl apply -f <file>` under the hood.

### Debugging a Node.js / Python app running in a pod

The Microsoft K8s extension supports "Debug (Attach)" workflows:

1. Open your project in VS Code.
2. Add a debug-friendly start command to your container (e.g., `node --inspect=0.0.0.0:9229 server.js` for Node, or `debugpy` for Python).
3. Expose the debug port in your Deployment YAML (`containerPort: 9229`).
4. Right-click the pod in the K8s sidebar → **Debug (Attach)**.
5. The extension auto-creates a `launch.json` entry that port-forwards to the debug port and attaches your VS Code debugger.

Breakpoints in your local source code now hit when the in-cluster code runs.

### Bridge to Kubernetes (the advanced trick)

`Bridge to Kubernetes` (Microsoft) lets you run **one service** of a larger app on your laptop with full debug, while the rest of the services keep running in the cluster. It routes traffic destined for the in-cluster service to your local process.

When to use it:

- You're working on `backend` in a 10-service app and don't want to run all 10 locally.
- You need full step-through debugging of one service.

Quick start: open the command palette (`Cmd/Ctrl + Shift + P`) → **Bridge to Kubernetes: Configure**. Pick the service to redirect. Then press F5 to launch.

### Recommended VS Code keybindings to add

In `keybindings.json` (Command Palette → "Open Keyboard Shortcuts (JSON)"):

```jsonc
[
  // Quick `kubectl apply` of the current YAML file
  {
    "key": "cmd+shift+k a",
    "command": "kubernetes.fileApply",
    "when": "editorTextFocus && editorLangId == 'yaml'"
  },
  // Open a shell in the currently-selected pod
  {
    "key": "cmd+shift+k t",
    "command": "extension.vsKubernetesTerminal"
  }
]
```

Use `ctrl+shift+k` on Windows/Linux.

### Workspace structure that plays well with the tooling

```
my-project/
├── .vscode/
│   ├── settings.json          # yaml.schemas pointing at k8s/
│   └── launch.json            # debug configs (auto-generated by K8s extension)
├── backend/
│   ├── Dockerfile
│   └── src/
├── frontend/
│   ├── Dockerfile
│   └── src/
├── k8s/
│   ├── namespace.yaml
│   ├── backend-deployment.yaml
│   ├── backend-service.yaml
│   ├── frontend-deployment.yaml
│   ├── frontend-service.yaml
│   └── ingress.yaml
└── README.md
```

Keep all manifests under `k8s/`. The `yaml.schemas` config glob picks them up; `kubectl apply -f k8s/` applies them all in one shot.

---

## Daily Workflow Cheat Sheet

Print this section, tape it next to your monitor.

```bash
# === Build + deploy a local change ===
docker build -t myapp:dev .
kubectl rollout restart deployment/myapp        # forces pods to recreate with the rebuilt image
kubectl rollout status deployment/myapp

# === See what's running ===
kubectl get pods                                # current namespace
kubectl get all                                 # pods + services + deployments + replicasets
kubens                                          # list namespaces / set current
k9s                                             # full TUI — use this; you'll thank yourself

# === Logs ===
kubectl logs -f deployment/myapp                # follow the latest pod's logs
stern myapp                                     # tail logs from every matching pod in color

# === Shell into a pod ===
kubectl exec -it deployment/myapp -- sh         # or bash if the image has it

# === Hit the app from your laptop ===
kubectl port-forward svc/myapp 8080:80          # ad-hoc; foreground; ctrl-C to stop
# Or with Ingress + /etc/hosts: just visit http://myapp.local

# === Inspect why something's broken ===
kubectl describe pod <pod-name>                 # bottom of the output has the Events log
kubectl get events --sort-by=.lastTimestamp     # cluster-wide event log

# === Tear it all down ===
kubectl delete -f k8s/                          # delete every manifest in the dir
# or:
kubectl delete namespace my-app                 # nuke everything in the namespace

# === Reset the cluster ===
# Docker Desktop → Settings → Kubernetes → Reset Kubernetes Cluster
```

---

## Where to Go Next

- **Concepts deeper than this doc covers** → [K8s_README.md](K8s_README.md): pod anatomy, controllers, RBAC, Helm charts, HPA, stateful sets.
- **Full Node.js / Python deployment examples** → [K8s_README.md § Full Example](K8s_README.md#full-example-deploying-a-nodejs-backend--frontend) (these work identically on Docker Desktop's cluster).
- **Docker fundamentals** → [Docker_README.md](Docker_README.md): Dockerfile patterns, multi-stage builds, Compose.
- **kubectl reference** → `kubectl --help`, `kubectl <verb> --help`. Or the official cheat sheet: <https://kubernetes.io/docs/reference/kubectl/cheatsheet/>.

Happy clustering.

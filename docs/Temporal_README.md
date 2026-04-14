# Temporal — Comprehensive Guide

A thorough, beginner-friendly reference covering Temporal: a durable execution platform for building reliable distributed applications. Covers core concepts, setup, Python and TypeScript SDKs, data stores, and production patterns.

---

## Table of Contents

1. [What is Temporal?](#what-is-temporal)
2. [Key Concepts](#key-concepts)
3. [Architecture Overview](#architecture-overview)
4. [Does Temporal Need a Data Store?](#does-temporal-need-a-data-store)
5. [Installation — Temporal Server](#installation--temporal-server)
6. [Temporal CLI (temporal)](#temporal-cli-temporal)
7. [TypeScript SDK — Setup and Usage](#typescript-sdk--setup-and-usage)
8. [Python SDK — Setup and Usage](#python-sdk--setup-and-usage)
9. [Running Workflows](#running-workflows)
10. [Signals, Queries, and Updates](#signals-queries-and-updates)
11. [Retries and Timeouts](#retries-and-timeouts)
12. [Task Queues](#task-queues)
13. [Namespaces](#namespaces)
14. [Versioning Workflows](#versioning-workflows)
15. [Testing](#testing)
16. [Temporal Web UI](#temporal-web-ui)
17. [Temporal Cloud vs Self-Hosted](#temporal-cloud-vs-self-hosted)
18. [Production Considerations](#production-considerations)
19. [Common Pitfalls](#common-pitfalls)
20. [Cheat Sheet](#cheat-sheet)

---

## What is Temporal?

Temporal is an open-source **durable execution** platform. It lets you write application logic as regular code (called **Workflows**) that automatically survives process crashes, server restarts, and network failures. You write code that looks synchronous, and Temporal handles retries, state persistence, and failure recovery transparently.

### Why Use Temporal?

| Problem                                    | Without Temporal                          | With Temporal                               |
| ------------------------------------------ | ----------------------------------------- | ------------------------------------------- |
| Long-running processes (minutes to months) | Custom state machines, cron jobs, polling | A single Workflow function                  |
| Retrying failed operations                 | Manual retry logic, dead-letter queues    | Declarative retry policies                  |
| Coordinating microservices                 | Sagas, choreography, message buses        | Orchestrate directly in code                |
| Ensuring exactly-once execution            | Idempotency keys, deduplication tables    | Built-in deterministic replay               |
| Visibility into running processes          | Custom dashboards, log aggregation        | Built-in Web UI with full execution history |

### Use Cases

- Order processing and fulfillment pipelines
- Payment and billing workflows
- User onboarding / signup flows
- Data pipelines and ETL
- Infrastructure provisioning
- Long-running background jobs (report generation, batch processing)
- Subscription lifecycle management
- CI/CD pipeline orchestration

---

## Key Concepts

### Workflow

A **Workflow** is a durable function that orchestrates your business logic. It must be **deterministic** — given the same input and history, it produces the same sequence of commands. Workflows can run for seconds or years.

```
Workflow = your application logic as a function
         (deterministic, long-running, survives failures)
```

### Activity

An **Activity** is a function that performs a single, potentially non-deterministic operation — calling an API, querying a database, sending an email. Activities are where side effects live.

```
Activity = a single unit of work with side effects
          (non-deterministic OK, retried on failure)
```

### Worker

A **Worker** is a process that hosts and executes Workflow and Activity code. You run Workers — Temporal Server dispatches tasks to them.

```
Worker = your process that polls for and executes tasks
```

### Task Queue

A named queue that connects Workflow/Activity executions to Workers. Workers listen on one or more task queues.

### Workflow Execution

A single run of a Workflow, identified by a **Workflow ID** (user-defined, unique) and a **Run ID** (system-generated). The full execution history (every event) is persisted by Temporal Server.

### Signal

An asynchronous message sent to a running Workflow from the outside. Useful for pushing data into a running Workflow (e.g., "user approved the request").

### Query

A synchronous, read-only request to inspect a running Workflow's state without affecting its execution.

### Schedule

A way to run Workflows on a cron-like schedule, managed by Temporal Server.

---

## Architecture Overview

```
┌──────────────┐       ┌───────────────────┐       ┌──────────────┐
│  Your App /  │       │  Temporal Server   │       │   Workers    │
│  CLI / UI    │──────>│  (Frontend +       │──────>│  (your code) │
│              │       │   History +        │       │              │
│  Start       │       │   Matching +       │       │  Workflows   │
│  Workflow    │       │   Worker svc)      │       │  Activities  │
└──────────────┘       └────────┬───────────┘       └──────────────┘
                                │
                       ┌────────▼───────────┐
                       │   Data Store       │
                       │   (Cassandra /     │
                       │    PostgreSQL /    │
                       │    MySQL /         │
                       │    SQLite)         │
                       └────────────────────┘
```

Temporal Server consists of four internal services:

- **Frontend** — API gateway, rate limiting, auth
- **History** — manages Workflow execution state and history
- **Matching** — dispatches tasks to Workers via task queues
- **Worker** — internal Temporal system Workflows (not your Workers)

---

## Does Temporal Need a Data Store?

**Yes.** Temporal Server requires a persistent data store for Workflow execution histories, visibility data, and cluster metadata.

### Supported Data Stores

| Data Store         | Use Case                        | Notes                                             |
| ------------------ | ------------------------------- | ------------------------------------------------- |
| **SQLite**         | Local development only          | Used by `temporal server start-dev` automatically |
| **PostgreSQL**     | Production (small-medium scale) | Most common self-hosted choice                    |
| **MySQL**          | Production (small-medium scale) | Fully supported alternative to Postgres           |
| **Cassandra**      | Production (large scale)        | Best for very high throughput / large clusters    |
| **Temporal Cloud** | Managed SaaS                    | No data store management needed                   |

### Development Mode

For local development, you don't need to set up any external database. The `temporal server start-dev` command uses an **embedded SQLite** database automatically:

```bash
# starts server with embedded SQLite — no external DB required
temporal server start-dev
```

### Production Mode

For production, you must configure a persistent data store. Example with PostgreSQL:

```yaml
# temporal-server config (persistence section)
persistence:
  defaultStore: postgres-default
  visibilityStore: postgres-visibility
  datastores:
    postgres-default:
      sql:
        pluginName: postgres12
        databaseName: temporal
        connectAddr: "127.0.0.1:5432"
        user: temporal
        password: temporal
    postgres-visibility:
      sql:
        pluginName: postgres12
        databaseName: temporal_visibility
        connectAddr: "127.0.0.1:5432"
        user: temporal
        password: temporal
```

### Elasticsearch (Optional)

Temporal supports Elasticsearch for **advanced visibility** — complex queries, full-text search on Workflow metadata. Not required for basic operation. In newer Temporal versions, SQL-based visibility handles most use cases without Elasticsearch.

---

## Installation — Temporal Server

### Option 1: Temporal CLI (Recommended for Development)

The Temporal CLI includes a built-in dev server.

**macOS:**

```bash
brew install temporal
```

**Linux / macOS (via curl):**

```bash
curl -fsSL https://temporal.download/cli.sh | sh
```

This installs the `temporal` binary. Start the dev server:

```bash
temporal server start-dev
```

Server runs at `localhost:7233` (gRPC) and the Web UI at `http://localhost:8233`.

### Option 2: Docker Compose

```bash
git clone https://github.com/temporalio/docker-compose.git
cd docker-compose
docker compose up
```

This starts Temporal Server + PostgreSQL + Temporal Web UI.

- gRPC endpoint: `localhost:7233`
- Web UI: `http://localhost:8080`

### Option 3: Temporal Cloud (Managed)

Sign up at [cloud.temporal.io](https://cloud.temporal.io). No infrastructure to manage. You get a namespace, endpoint, and TLS certificates. Connect your Workers to the cloud endpoint instead of `localhost:7233`.

---

## Temporal CLI (temporal)

The `temporal` CLI manages Workflows, namespaces, schedules, and more.

### Common Commands

```bash
# Start the dev server
temporal server start-dev

# Start dev server with a specific namespace
temporal server start-dev --namespace my-app

# Start dev server with a specific port
temporal server start-dev --port 7233 --ui-port 8233

# List Workflows
temporal workflow list

# Start a Workflow
temporal workflow start \
  --task-queue my-queue \
  --type MyWorkflow \
  --input '"hello"'

# Describe a running Workflow
temporal workflow describe --workflow-id my-workflow-id

# Show Workflow execution history
temporal workflow show --workflow-id my-workflow-id

# Signal a running Workflow
temporal workflow signal \
  --workflow-id my-workflow-id \
  --name my-signal \
  --input '"data"'

# Query a running Workflow
temporal workflow query \
  --workflow-id my-workflow-id \
  --name my-query

# Cancel a Workflow
temporal workflow cancel --workflow-id my-workflow-id

# Terminate a Workflow (forceful)
temporal workflow terminate --workflow-id my-workflow-id

# List task queue pollers
temporal task-queue describe --task-queue my-queue
```

---

## TypeScript SDK — Setup and Usage

### Installation

```bash
mkdir my-temporal-app && cd my-temporal-app
npm init -y
npm install @temporalio/client @temporalio/worker @temporalio/workflow @temporalio/activity
npm install -D typescript @tsconfig/node20
npx tsc --init
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "moduleResolution": "node",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true
  },
  "include": ["src/**/*"]
}
```

### Project Structure

```
my-temporal-app/
  src/
    activities.ts     # Activity definitions
    workflows.ts      # Workflow definitions
    worker.ts         # Worker process
    client.ts         # Client to start Workflows
```

### Activities (src/activities.ts)

```typescript
// Activities are where side effects live — HTTP calls, DB queries, etc.

export async function greet(name: string): Promise<string> {
  console.log(`Greeting ${name}`);
  return `Hello, ${name}!`;
}

export async function sendEmail(to: string, body: string): Promise<void> {
  // call your email API here
  console.log(`Sending email to ${to}: ${body}`);
}

export async function fetchUserData(userId: string): Promise<{ name: string; email: string }> {
  // call your database or API here
  return { name: "Alice", email: "alice@example.com" };
}
```

### Workflows (src/workflows.ts)

```typescript
import { proxyActivities, sleep, defineSignal, defineQuery, setHandler } from "@temporalio/workflow";
import type * as activities from "./activities";

// Create activity proxies with retry/timeout config
const { greet, sendEmail, fetchUserData } = proxyActivities<typeof activities>({
  startToCloseTimeout: "30 seconds",
  retry: {
    maximumAttempts: 3,
  },
});

// Simple Workflow
export async function greetingWorkflow(name: string): Promise<string> {
  return await greet(name);
}

// Multi-step Workflow
export async function onboardUserWorkflow(userId: string): Promise<void> {
  // Step 1: fetch user data
  const user = await fetchUserData(userId);

  // Step 2: send welcome email
  await sendEmail(user.email, `Welcome, ${user.name}!`);

  // Step 3: wait 24 hours, then send follow-up
  await sleep("24 hours");
  await sendEmail(user.email, `How's it going, ${user.name}?`);
}

// Workflow with Signals and Queries
export const approvalSignal = defineSignal<[boolean]>("approval");
export const statusQuery = defineQuery<string>("status");

export async function approvalWorkflow(requestId: string): Promise<string> {
  let status = "pending";
  let approved: boolean | undefined;

  // Handle incoming signals
  setHandler(approvalSignal, (isApproved: boolean) => {
    approved = isApproved;
    status = isApproved ? "approved" : "rejected";
  });

  // Handle queries
  setHandler(statusQuery, () => status);

  // Wait for approval signal (up to 7 days)
  const deadline = Date.now() + 7 * 24 * 60 * 60 * 1000;
  while (approved === undefined && Date.now() < deadline) {
    await sleep("1 minute");
  }

  if (approved === undefined) {
    status = "timed_out";
    return "timed_out";
  }

  return status;
}
```

### Worker (src/worker.ts)

```typescript
import { Worker } from "@temporalio/worker";
import * as activities from "./activities";

async function run() {
  const worker = await Worker.create({
    // Workflows are bundled separately — point to the source file
    workflowsPath: require.resolve("./workflows"),
    // Activities are passed directly
    activities,
    // Task queue this worker listens on
    taskQueue: "my-task-queue",
  });

  console.log("Worker started");
  await worker.run();
}

run().catch((err) => {
  console.error("Worker failed", err);
  process.exit(1);
});
```

### Client (src/client.ts)

```typescript
import { Client } from "@temporalio/client";

async function run() {
  const client = new Client();

  // Start a Workflow
  const handle = await client.workflow.start("greetingWorkflow", {
    taskQueue: "my-task-queue",
    workflowId: "greeting-1",
    args: ["World"],
  });

  console.log(`Started Workflow ${handle.workflowId}`);

  // Wait for result
  const result = await handle.result();
  console.log(`Workflow result: ${result}`);
}

run().catch(console.error);
```

### Running (TypeScript)

```bash
# Terminal 1: start Temporal Server
temporal server start-dev

# Terminal 2: start the Worker
npx ts-node src/worker.ts

# Terminal 3: start a Workflow via client
npx ts-node src/client.ts

# Or start via CLI
temporal workflow start \
  --task-queue my-task-queue \
  --type greetingWorkflow \
  --input '"World"'
```

---

## Python SDK — Setup and Usage

### Installation

```bash
mkdir my-temporal-app && cd my-temporal-app
python -m venv .venv
source .venv/bin/activate
pip install temporalio
```

### Project Structure

```
my-temporal-app/
  activities.py     # Activity definitions
  workflows.py      # Workflow definitions
  worker.py         # Worker process
  client.py         # Client to start Workflows
```

### Activities (activities.py)

```python
from temporalio import activity
from dataclasses import dataclass


@dataclass
class UserData:
    name: str
    email: str


@activity.defn
async def greet(name: str) -> str:
    """Greet a user by name."""
    print(f"Greeting {name}")
    return f"Hello, {name}!"


@activity.defn
async def send_email(to: str, body: str) -> None:
    """Send an email."""
    print(f"Sending email to {to}: {body}")


@activity.defn
async def fetch_user_data(user_id: str) -> UserData:
    """Fetch user data from database or API."""
    return UserData(name="Alice", email="alice@example.com")
```

### Workflows (workflows.py)

```python
from datetime import timedelta
from temporalio import workflow
from temporalio.common import RetryPolicy

# Import activity types (must use string names at runtime)
with workflow.unsafe.imports_passed_through():
    from activities import greet, send_email, fetch_user_data, UserData


@workflow.defn
class GreetingWorkflow:
    """Simple single-step Workflow."""

    @workflow.run
    async def run(self, name: str) -> str:
        return await workflow.execute_activity(
            greet,
            name,
            start_to_close_timeout=timedelta(seconds=30),
        )


@workflow.defn
class OnboardUserWorkflow:
    """Multi-step user onboarding Workflow."""

    @workflow.run
    async def run(self, user_id: str) -> None:
        retry_policy = RetryPolicy(maximum_attempts=3)

        # Step 1: fetch user data
        user = await workflow.execute_activity(
            fetch_user_data,
            user_id,
            start_to_close_timeout=timedelta(seconds=30),
            retry_policy=retry_policy,
        )

        # Step 2: send welcome email
        await workflow.execute_activity(
            send_email,
            args=[user.email, f"Welcome, {user.name}!"],
            start_to_close_timeout=timedelta(seconds=30),
            retry_policy=retry_policy,
        )

        # Step 3: wait 24 hours, then follow up
        await workflow.sleep(timedelta(hours=24))

        await workflow.execute_activity(
            send_email,
            args=[user.email, f"How's it going, {user.name}?"],
            start_to_close_timeout=timedelta(seconds=30),
        )


@workflow.defn
class ApprovalWorkflow:
    """Workflow that waits for an external approval signal."""

    def __init__(self) -> None:
        self._status = "pending"
        self._approved: bool | None = None

    @workflow.run
    async def run(self, request_id: str) -> str:
        # Wait for approval signal (up to 7 days)
        try:
            await workflow.wait_condition(
                lambda: self._approved is not None,
                timeout=timedelta(days=7),
            )
        except TimeoutError:
            self._status = "timed_out"
            return "timed_out"

        return self._status

    @workflow.signal
    async def approval(self, is_approved: bool) -> None:
        """Receive approval decision."""
        self._approved = is_approved
        self._status = "approved" if is_approved else "rejected"

    @workflow.query
    def status(self) -> str:
        """Query current status."""
        return self._status
```

### Worker (worker.py)

```python
import asyncio
from temporalio.client import Client
from temporalio.worker import Worker
from activities import greet, send_email, fetch_user_data
from workflows import GreetingWorkflow, OnboardUserWorkflow, ApprovalWorkflow


async def main():
    client = await Client.connect("localhost:7233")

    worker = Worker(
        client,
        task_queue="my-task-queue",
        workflows=[GreetingWorkflow, OnboardUserWorkflow, ApprovalWorkflow],
        activities=[greet, send_email, fetch_user_data],
    )

    print("Worker started")
    await worker.run()


if __name__ == "__main__":
    asyncio.run(main())
```

### Client (client.py)

```python
import asyncio
from temporalio.client import Client
from workflows import GreetingWorkflow


async def main():
    client = await Client.connect("localhost:7233")

    # Start a Workflow
    handle = await client.start_workflow(
        GreetingWorkflow.run,
        "World",
        id="greeting-1",
        task_queue="my-task-queue",
    )

    print(f"Started Workflow {handle.id}")

    # Wait for result
    result = await handle.result()
    print(f"Workflow result: {result}")


if __name__ == "__main__":
    asyncio.run(main())
```

### Running (Python)

```bash
# Terminal 1: start Temporal Server
temporal server start-dev

# Terminal 2: start the Worker
python worker.py

# Terminal 3: start a Workflow via client
python client.py

# Or start via CLI
temporal workflow start \
  --task-queue my-task-queue \
  --type GreetingWorkflow \
  --input '"World"'
```

---

## Running Workflows

### From Client Code

See the TypeScript and Python client examples above. Key parameters when starting a Workflow:

| Parameter                  | Description                                            | Required |
| -------------------------- | ------------------------------------------------------ | -------- |
| `workflowId`               | Unique identifier (user-defined). Prevents duplicates. | Yes      |
| `taskQueue`                | Must match the Worker's task queue.                    | Yes      |
| `args`                     | Arguments passed to the Workflow function.             | No       |
| `workflowExecutionTimeout` | Max total time for the Workflow.                       | No       |
| `workflowRunTimeout`       | Max time for a single run (before continue-as-new).    | No       |
| `workflowTaskTimeout`      | Max time for a single Workflow task (default 10s).     | No       |

### From the CLI

```bash
# Start and don't wait
temporal workflow start \
  --task-queue my-task-queue \
  --type MyWorkflow \
  --workflow-id my-unique-id \
  --input '"arg1"' \
  --input '{"key": "value"}'

# Start and wait for result
temporal workflow execute \
  --task-queue my-task-queue \
  --type MyWorkflow \
  --input '"arg1"'
```

### Workflow ID Reuse Policy

If you start a Workflow with a Workflow ID that already exists, the behavior depends on the **ID reuse policy**:

- **AllowDuplicate** (default) — allows reuse if previous run completed
- **AllowDuplicateFailedOnly** — allows reuse only if previous run failed
- **RejectDuplicate** — always rejects if Workflow ID was ever used
- **TerminateIfRunning** — terminates the running Workflow and starts a new one

---

## Signals, Queries, and Updates

### Signals (Async, Fire-and-Forget)

Push data into a running Workflow without waiting for a response.

```bash
# CLI
temporal workflow signal \
  --workflow-id my-workflow-id \
  --name approval \
  --input 'true'
```

```typescript
// TypeScript client
const handle = client.workflow.getHandle("my-workflow-id");
await handle.signal(approvalSignal, true);
```

```python
# Python client
handle = client.get_workflow_handle("my-workflow-id")
await handle.signal(ApprovalWorkflow.approval, True)
```

### Queries (Sync, Read-Only)

Read Workflow state without affecting execution.

```bash
# CLI
temporal workflow query \
  --workflow-id my-workflow-id \
  --name status
```

```typescript
// TypeScript client
const status = await handle.query(statusQuery);
```

```python
# Python client
status = await handle.query(ApprovalWorkflow.status)
```

### Updates (Sync, Mutating)

Send data to a Workflow and wait for a response. Available in newer Temporal versions.

---

## Retries and Timeouts

### Activity Retry Policy

Activities are retried by default. Configure retry behavior:

| Setting              | Default      | Description                            |
| -------------------- | ------------ | -------------------------------------- |
| `initialInterval`    | 1 second     | First retry delay                      |
| `backoffCoefficient` | 2.0          | Multiplier for subsequent delays       |
| `maximumInterval`    | 100x initial | Cap on retry delay                     |
| `maximumAttempts`    | Unlimited    | Total attempts (including first try)   |
| `nonRetryableErrors` | None         | Error types that should not be retried |

### Activity Timeouts

| Timeout                  | Description                                                     |
| ------------------------ | --------------------------------------------------------------- |
| `startToCloseTimeout`    | Max time for a single Activity attempt. **Set this always.**    |
| `scheduleToCloseTimeout` | Max total time including all retries.                           |
| `scheduleToStartTimeout` | Max time waiting in the task queue before a Worker picks it up. |
| `heartbeatTimeout`       | For long Activities — must heartbeat within this interval.      |

### TypeScript Example

```typescript
const { myActivity } = proxyActivities<typeof activities>({
  startToCloseTimeout: "30 seconds",
  retry: {
    initialInterval: "1 second",
    backoffCoefficient: 2,
    maximumAttempts: 5,
    nonRetryableErrorTypes: ["InvalidInputError"],
  },
});
```

### Python Example

```python
await workflow.execute_activity(
    my_activity,
    arg,
    start_to_close_timeout=timedelta(seconds=30),
    retry_policy=RetryPolicy(
        initial_interval=timedelta(seconds=1),
        backoff_coefficient=2.0,
        maximum_attempts=5,
        non_retryable_error_types=["InvalidInputError"],
    ),
)
```

---

## Task Queues

Task queues route work to the correct set of Workers. Best practices:

- **Use separate task queues** for different types of work (e.g., `email-queue`, `payment-queue`)
- **Multiple Workers** can poll the same task queue for horizontal scaling
- **A single Worker** can poll multiple task queues
- Task queues are created lazily — no need to pre-register them

```
                         ┌─── Worker A (CPU-heavy activities)
  payment-queue ─────────┤
                         └─── Worker B (CPU-heavy activities)

  email-queue ───────────── Worker C (email activities)

  general-queue ─────────── Worker D (Workflows + lightweight activities)
```

---

## Namespaces

Namespaces provide isolation between different applications or environments sharing the same Temporal Server.

```bash
# Create a namespace
temporal operator namespace create staging

# List namespaces
temporal operator namespace list

# Use a specific namespace in CLI commands
temporal workflow list --namespace staging
```

In code, specify the namespace when creating the client:

```typescript
const client = new Client({ namespace: "staging" });
```

```python
client = await Client.connect("localhost:7233", namespace="staging")
```

---

## Versioning Workflows

Workflows must be **deterministic**. When you change Workflow logic, existing running Workflows still replay their old history. You must handle this carefully.

### Patching (Recommended)

```typescript
import { patched, deprecatePatch } from "@temporalio/workflow";

export async function myWorkflow() {
  if (patched("my-change-id")) {
    // new code path
    await newActivity();
  } else {
    // old code path (for existing executions)
    await oldActivity();
  }
}
```

```python
@workflow.defn
class MyWorkflow:
    @workflow.run
    async def run(self) -> None:
        if workflow.patched("my-change-id"):
            await workflow.execute_activity(new_activity, ...)
        else:
            await workflow.execute_activity(old_activity, ...)
```

### Worker Versioning

Temporal also supports **Worker Build ID-based versioning** for routing tasks to Workers running specific code versions. This is useful for gradual rollouts.

---

## Testing

### TypeScript Testing

```bash
npm install -D @temporalio/testing vitest
```

```typescript
import { TestWorkflowEnvironment } from "@temporalio/testing";
import { Worker } from "@temporalio/worker";
import { greetingWorkflow } from "./workflows";
import * as activities from "./activities";

describe("greetingWorkflow", () => {
  let testEnv: TestWorkflowEnvironment;

  beforeAll(async () => {
    testEnv = await TestWorkflowEnvironment.createLocal();
  });

  afterAll(async () => {
    await testEnv?.teardown();
  });

  it("returns greeting", async () => {
    const { client, nativeConnection } = testEnv;

    const worker = await Worker.create({
      connection: nativeConnection,
      workflowsPath: require.resolve("./workflows"),
      activities,
      taskQueue: "test-queue",
    });

    const result = await worker.runUntil(
      client.workflow.execute(greetingWorkflow, {
        taskQueue: "test-queue",
        workflowId: "test-greeting",
        args: ["World"],
      }),
    );

    expect(result).toBe("Hello, World!");
  });
});
```

### Python Testing

```bash
pip install pytest pytest-asyncio
```

```python
import pytest
from temporalio.testing import WorkflowEnvironment
from temporalio.worker import Worker
from workflows import GreetingWorkflow
from activities import greet


@pytest.mark.asyncio
async def test_greeting_workflow():
    async with await WorkflowEnvironment.start_local() as env:
        async with Worker(
            env.client,
            task_queue="test-queue",
            workflows=[GreetingWorkflow],
            activities=[greet],
        ):
            result = await env.client.execute_workflow(
                GreetingWorkflow.run,
                "World",
                id="test-greeting",
                task_queue="test-queue",
            )

            assert result == "Hello, World!"
```

### Mocking Activities

You can mock activities to test Workflow logic in isolation without real side effects.

### Time Skipping

Both test environments support **time skipping** — fast-forwarding through `sleep` calls and timers so tests run instantly instead of waiting for real time to pass.

```python
# Python: skip time automatically
async with await WorkflowEnvironment.start_time_skipping() as env:
    # sleeps and timers are fast-forwarded automatically
    ...
```

---

## Temporal Web UI

The Web UI provides visibility into Workflow executions.

- **Dev server:** `http://localhost:8233`
- **Docker Compose:** `http://localhost:8080`

Features:

- List and search Workflows (by ID, type, status, time range)
- View full Workflow execution history (every event)
- Inspect pending Activities and their retry state
- Send Signals to running Workflows
- Terminate or cancel Workflows
- View task queue metrics

---

## Temporal Cloud vs Self-Hosted

| Feature           | Self-Hosted                           | Temporal Cloud                    |
| ----------------- | ------------------------------------- | --------------------------------- |
| **Data store**    | You manage (Postgres/MySQL/Cassandra) | Managed for you                   |
| **Scaling**       | You scale server + DB                 | Auto-scaled                       |
| **Availability**  | You manage HA / replication           | Multi-region, 99.99% SLA          |
| **Security**      | You manage TLS, auth                  | mTLS built-in, SSO/SAML           |
| **Cost**          | Infrastructure + ops time             | Pay per action                    |
| **Upgrades**      | You perform rolling upgrades          | Automatic                         |
| **Web UI**        | Self-hosted                           | Hosted with advanced features     |
| **Multi-tenancy** | Namespaces                            | Namespaces with account isolation |

### Connecting to Temporal Cloud

```typescript
// TypeScript
import { Client, Connection } from "@temporalio/client";
import fs from "node:fs";

const connection = await Connection.connect({
  address: "your-namespace.tmprl.cloud:7233",
  tls: {
    clientCertPair: {
      crt: fs.readFileSync("client.pem"),
      key: fs.readFileSync("client.key"),
    },
  },
});
const client = new Client({ connection, namespace: "your-namespace" });
```

```python
# Python
from temporalio.client import Client, TLSConfig

client = await Client.connect(
    "your-namespace.tmprl.cloud:7233",
    namespace="your-namespace",
    tls=TLSConfig(
        client_cert=open("client.pem", "rb").read(),
        client_private_key=open("client.key", "rb").read(),
    ),
)
```

---

## Production Considerations

### Worker Deployment

- Run **multiple Worker instances** for availability and throughput
- Workers are stateless — deploy like any other application
- Use **health checks** on Worker processes
- Set `maxConcurrentActivityTaskExecutions` and `maxConcurrentWorkflowTaskExecutions` to control load

### Workflow Design

- Keep Workflows **deterministic** — no random numbers, no current time (use `workflow.now()`), no non-deterministic libraries
- Use **continue-as-new** for Workflows with unbounded history (e.g., polling loops)
- Keep Workflow history size reasonable (under ~50K events)
- Use **child Workflows** to split large orchestrations

### What NOT to Do in a Workflow

| Don't                                   | Do Instead                               |
| --------------------------------------- | ---------------------------------------- |
| `Math.random()`                         | Use deterministic seed or Activity       |
| `new Date()` / `Date.now()`             | `workflow.now()` (Python) / Temporal API |
| Direct HTTP calls                       | Use an Activity                          |
| Direct DB queries                       | Use an Activity                          |
| Mutate global/static state              | Use Workflow-local variables             |
| Use non-deterministic libraries         | Wrap in Activities                       |
| Unbounded loops without continue-as-new | Use `continueAsNew()` periodically       |

### Observability

- Temporal Server exports **Prometheus metrics** (default port 9090)
- Use structured logging in Workers
- Set **search attributes** on Workflows for better filtering in the Web UI

---

## Common Pitfalls

1. **Non-deterministic Workflow code** — using `Date.now()`, `Math.random()`, or making network calls directly in a Workflow causes replay failures.

2. **Forgetting `startToCloseTimeout` on Activities** — at least one timeout is required. Always set `startToCloseTimeout`.

3. **Worker not running** — Workflows stay in "Running" state indefinitely if no Worker is polling the task queue. Check task queue name matches.

4. **Large payloads** — Temporal stores all inputs/outputs in history. Keep payloads small (ideally under 1 MB). Store large data externally and pass references.

5. **Unbounded history** — long-running polling Workflows accumulate history events. Use `continueAsNew()` to reset history periodically.

6. **Mixing Activity and Workflow code** — Activities must be registered separately from Workflows. Don't import Activity implementations directly in Workflow code (TypeScript sandboxes Workflows).

7. **Not handling cancellation** — Workflows and Activities can be cancelled. Handle `CancelledError` / `CancelledFailure` to clean up properly.

8. **Task queue mismatch** — the client's `taskQueue` must exactly match the Worker's. A typo means work sits unprocessed.

9. **Using `time.sleep()` in Python Activities** — use `asyncio.sleep()` for async Activities, or `activity.heartbeat()` for long-running sync Activities.

10. **Not versioning Workflow changes** — changing Workflow logic without using `patched()` / `workflow.patched()` breaks existing running Workflows during replay.

---

## Cheat Sheet

### Quick Start (Any Language)

```bash
# 1. Install Temporal CLI
brew install temporal            # macOS
curl -fsSL https://temporal.download/cli.sh | sh  # linux

# 2. Start dev server
temporal server start-dev

# 3. Open Web UI
open http://localhost:8233
```

### TypeScript Quick Start

```bash
npm install @temporalio/client @temporalio/worker @temporalio/workflow @temporalio/activity
```

### Python Quick Start

```bash
pip install temporalio
```

### Essential CLI Commands

```bash
temporal server start-dev                          # Start dev server
temporal workflow list                              # List Workflows
temporal workflow start --task-queue Q --type W     # Start Workflow
temporal workflow execute --task-queue Q --type W   # Start + wait for result
temporal workflow describe --workflow-id ID         # Describe Workflow
temporal workflow show --workflow-id ID             # Show event history
temporal workflow signal --workflow-id ID --name S  # Send signal
temporal workflow query --workflow-id ID --name Q   # Query state
temporal workflow cancel --workflow-id ID           # Cancel Workflow
temporal workflow terminate --workflow-id ID        # Terminate Workflow
temporal task-queue describe --task-queue Q         # Inspect task queue
temporal operator namespace create NS              # Create namespace
```

### Key Ports

| Service         | Port | URL                     |
| --------------- | ---- | ----------------------- |
| gRPC endpoint   | 7233 | `localhost:7233`        |
| Web UI (dev)    | 8233 | `http://localhost:8233` |
| Web UI (docker) | 8080 | `http://localhost:8080` |
| Metrics         | 9090 | Prometheus endpoint     |

### Other Supported SDKs

Temporal also has official SDKs for:

- **Go** — `go.temporal.io/sdk`
- **Java** — `io.temporal:temporal-sdk`
- **.NET** — `Temporalio`
- **PHP** — `temporal/sdk`

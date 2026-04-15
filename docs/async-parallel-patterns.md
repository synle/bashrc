# Async & Parallel Patterns

A cross-language reference for common async/concurrency patterns. Each section shows the same logical pattern in Node.js, Python, Java, Rust, and Go.

---

## Table of Contents

- [Sequential: t1 then t2 then t3](#sequential-t1-then-t2-then-t3)
- [Parallel: all tasks, wait for all](#parallel-all-tasks-wait-for-all)
- [Grouped: t1+t2 parallel, then t3](#grouped-t1t2-parallel-then-t3)
- [Race: first to complete wins](#race-first-to-complete-wins)
- [Fire and forget](#fire-and-forget)
- [Parallel with error handling](#parallel-with-error-handling)
- [Throttled concurrency: N at a time](#throttled-concurrency-n-at-a-time)
- [Timeout: cancel if too slow](#timeout-cancel-if-too-slow)
- [Pipeline: stream results between stages](#pipeline-stream-results-between-stages)
- [Retry with backoff](#retry-with-backoff)

---

## Sequential: t1 then t2 then t3

Each task waits for the previous one to finish. Output of one can feed the next.

### Node.js

```js
const r1 = await t1();
const r2 = await t2(r1);
const r3 = await t3(r2);
```

### Python

```python
r1 = await t1()
r2 = await t2(r1)
r3 = await t3(r2)
```

### Java

```java
var r1 = t1().get();
var r2 = t2(r1).get();
var r3 = t3(r2).get();

// or with CompletableFuture chaining
var result = t1()
    .thenCompose(r1 -> t2(r1))
    .thenCompose(r2 -> t3(r2))
    .get();
```

### Rust

```rust
let r1 = t1().await;
let r2 = t2(r1).await;
let r3 = t3(r2).await;
```

### Go

```go
r1, err := t1()
if err != nil { return err }
r2, err := t2(r1)
if err != nil { return err }
r3, err := t3(r2)
if err != nil { return err }

// Go uses goroutines + channels for true async,
// but sequential work is just normal function calls.
```

---

## Parallel: all tasks, wait for all

Start everything at once, wait for all to complete. Order doesn't matter.

### Node.js

```js
const [r1, r2, r3] = await Promise.all([t1(), t2(), t3()]);
```

### Python

```python
import asyncio

r1, r2, r3 = await asyncio.gather(t1(), t2(), t3())
```

### Java

```java
var f1 = t1();
var f2 = t2();
var f3 = t3();
CompletableFuture.allOf(f1, f2, f3).join();
var r1 = f1.get();
var r2 = f2.get();
var r3 = f3.get();

// Java 21+ virtual threads
try (var scope = new StructuredTaskScope.ShutdownOnFailure()) {
    var f1 = scope.fork(() -> t1());
    var f2 = scope.fork(() -> t2());
    var f3 = scope.fork(() -> t3());
    scope.join().throwIfFailed();
    use(f1.get(), f2.get(), f3.get());
}
```

### Rust

```rust
let (r1, r2, r3) = tokio::join!(t1(), t2(), t3());

// or with JoinSet for dynamic task count
let mut set = tokio::task::JoinSet::new();
set.spawn(t1());
set.spawn(t2());
set.spawn(t3());
while let Some(result) = set.join_next().await {
    let val = result?;
}
```

### Go

```go
var r1, r2, r3 ResultType
var wg sync.WaitGroup
wg.Add(3)

go func() { defer wg.Done(); r1, _ = t1() }()
go func() { defer wg.Done(); r2, _ = t2() }()
go func() { defer wg.Done(); r3, _ = t3() }()

wg.Wait()

// or with errgroup for error propagation
g, ctx := errgroup.WithContext(ctx)
g.Go(func() error { var err error; r1, err = t1(); return err })
g.Go(func() error { var err error; r2, err = t2(); return err })
g.Go(func() error { var err error; r3, err = t3(); return err })
if err := g.Wait(); err != nil { return err }
```

---

## Grouped: t1+t2 parallel, then t3

Run the first batch in parallel, wait, then run the next step.

### Node.js

```js
const [r1, r2] = await Promise.all([t1(), t2()]);
const r3 = await t3(r1, r2);
```

### Python

```python
r1, r2 = await asyncio.gather(t1(), t2())
r3 = await t3(r1, r2)
```

### Java

```java
var f1 = t1();
var f2 = t2();
CompletableFuture.allOf(f1, f2).join();
var r3 = t3(f1.get(), f2.get()).get();

// or chained
var r3 = t1().thenCombine(t2(), (r1, r2) -> t3(r1, r2)).get();
```

### Rust

```rust
let (r1, r2) = tokio::join!(t1(), t2());
let r3 = t3(r1, r2).await;
```

### Go

```go
var r1, r2 ResultType
var wg sync.WaitGroup
wg.Add(2)

go func() { defer wg.Done(); r1, _ = t1() }()
go func() { defer wg.Done(); r2, _ = t2() }()

wg.Wait()
r3, err := t3(r1, r2)
```

---

## Race: first to complete wins

Multiple tasks start, use only the first result. Useful for redundant calls, fastest-mirror selection, or timeouts.

### Node.js

```js
const first = await Promise.race([t1(), t2(), t3()]);

// with AbortController to cancel losers
const ac = new AbortController();
const first = await Promise.race([t1(ac.signal), t2(ac.signal), t3(ac.signal)]);
ac.abort();
```

### Python

```python
done, pending = await asyncio.wait(
    [asyncio.create_task(t1()), asyncio.create_task(t2()), asyncio.create_task(t3())],
    return_when=asyncio.FIRST_COMPLETED,
)
first = done.pop().result()
for task in pending:
    task.cancel()
```

### Java

```java
var result = CompletableFuture.anyOf(t1(), t2(), t3()).get();

// Java 21+ structured concurrency
try (var scope = new StructuredTaskScope.ShutdownOnSuccess<Result>()) {
    scope.fork(() -> t1());
    scope.fork(() -> t2());
    scope.fork(() -> t3());
    scope.join();
    var first = scope.result();
}
```

### Rust

```rust
tokio::select! {
    r = t1() => use(r),
    r = t2() => use(r),
    r = t3() => use(r),
}
// losing branches are automatically dropped/cancelled
```

### Go

```go
ch := make(chan ResultType, 3)

go func() { r, _ := t1(); ch <- r }()
go func() { r, _ := t2(); ch <- r }()
go func() { r, _ := t3(); ch <- r }()

first := <-ch // goroutines leak — use context cancellation in production
```

---

## Fire and forget

Start a task, don't wait for the result. Useful for logging, analytics, cache warming.

### Node.js

```js
// no await — promise runs in background
t1().catch((err) => console.error("background task failed:", err));

// or explicitly void it
void t1();
```

### Python

```python
asyncio.create_task(t1())  # must hold a reference or it may be GC'd

# safer pattern
background_tasks = set()
task = asyncio.create_task(t1())
background_tasks.add(task)
task.add_done_callback(background_tasks.discard)
```

### Java

```java
CompletableFuture.runAsync(() -> t1());

// with executor
executor.submit(() -> t1());
```

### Rust

```rust
tokio::spawn(async {
    if let Err(e) = t1().await {
        eprintln!("background task failed: {e}");
    }
});
```

### Go

```go
go func() {
    if _, err := t1(); err != nil {
        log.Printf("background task failed: %v", err)
    }
}()
```

---

## Parallel with error handling

Run all tasks, but handle failures gracefully. Don't let one failure kill everything.

### Node.js

```js
// Promise.all fails fast on first rejection
// Promise.allSettled always waits for all
const results = await Promise.allSettled([t1(), t2(), t3()]);

for (const r of results) {
  if (r.status === "fulfilled") use(r.value);
  else console.error("failed:", r.reason);
}
```

### Python

```python
results = await asyncio.gather(t1(), t2(), t3(), return_exceptions=True)

for r in results:
    if isinstance(r, Exception):
        print(f"failed: {r}")
    else:
        use(r)
```

### Java

```java
var futures = List.of(t1(), t2(), t3());
var results = futures.stream()
    .map(f -> {
        try { return f.get(); }
        catch (Exception e) { return e; }
    })
    .toList();
```

### Rust

```rust
let (r1, r2, r3) = tokio::join!(t1(), t2(), t3());
// each result is a Result<T, E> — handle individually
if let Err(e) = r1 { eprintln!("t1 failed: {e}"); }
if let Err(e) = r2 { eprintln!("t2 failed: {e}"); }
if let Err(e) = r3 { eprintln!("t3 failed: {e}"); }

// or with JoinSet + collect
let mut set = tokio::task::JoinSet::new();
set.spawn(t1());
set.spawn(t2());
set.spawn(t3());
let results: Vec<_> = set.join_all().await;
```

### Go

```go
type result struct {
    val ResultType
    err error
}

ch := make(chan result, 3)
go func() { v, e := t1(); ch <- result{v, e} }()
go func() { v, e := t2(); ch <- result{v, e} }()
go func() { v, e := t3(); ch <- result{v, e} }()

for i := 0; i < 3; i++ {
    r := <-ch
    if r.err != nil {
        log.Printf("failed: %v", r.err)
    } else {
        use(r.val)
    }
}
```

---

## Throttled concurrency: N at a time

Process many tasks but limit how many run simultaneously. Prevents resource exhaustion.

### Node.js

```js
// built-in: no native pool, use a simple helper
async function pooled(tasks, limit) {
  const results = [];
  const executing = new Set();
  for (const task of tasks) {
    const p = task().then((r) => {
      executing.delete(p);
      return r;
    });
    executing.add(p);
    results.push(p);
    if (executing.size >= limit) await Promise.race(executing);
  }
  return Promise.all(results);
}

await pooled([() => t1(), () => t2(), () => t3(), () => t4()], 2);
```

### Python

```python
sem = asyncio.Semaphore(2)

async def throttled(task):
    async with sem:
        return await task()

results = await asyncio.gather(
    throttled(t1), throttled(t2), throttled(t3), throttled(t4)
)
```

### Java

```java
var pool = Executors.newFixedThreadPool(2);
var tasks = List.of(
    () -> t1(), () -> t2(), () -> t3(), () -> t4()
);
var futures = pool.invokeAll(tasks);
var results = futures.stream().map(f -> f.get()).toList();
pool.shutdown();

// Java 21+ virtual threads with semaphore
var sem = new Semaphore(2);
try (var scope = new StructuredTaskScope.ShutdownOnFailure()) {
    for (var task : tasks) {
        scope.fork(() -> { sem.acquire(); try { return task.call(); } finally { sem.release(); } });
    }
    scope.join().throwIfFailed();
}
```

### Rust

```rust
use futures::stream::{self, StreamExt};

let tasks = vec![t1(), t2(), t3(), t4()];
let results: Vec<_> = stream::iter(tasks)
    .buffer_unordered(2)
    .collect()
    .await;

// or with tokio semaphore
let sem = Arc::new(tokio::sync::Semaphore::new(2));
let mut set = tokio::task::JoinSet::new();
for task_fn in task_fns {
    let permit = sem.clone().acquire_owned().await?;
    set.spawn(async move {
        let result = task_fn().await;
        drop(permit);
        result
    });
}
```

### Go

```go
sem := make(chan struct{}, 2) // buffered channel as semaphore
var wg sync.WaitGroup

for _, task := range tasks {
    wg.Add(1)
    sem <- struct{}{} // block if 2 already running
    go func(t Task) {
        defer wg.Done()
        defer func() { <-sem }()
        t()
    }(task)
}
wg.Wait()

// or with errgroup
g, ctx := errgroup.WithContext(ctx)
g.SetLimit(2)
for _, task := range tasks {
    g.Go(func() error { return task() })
}
err := g.Wait()
```

---

## Timeout: cancel if too slow

Wrap a task with a deadline. Cancel if it exceeds the limit.

### Node.js

```js
const result = await Promise.race([t1(), new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 5000))]);

// Node 16+ with AbortSignal.timeout
const result = await t1({ signal: AbortSignal.timeout(5000) });
```

### Python

```python
try:
    result = await asyncio.wait_for(t1(), timeout=5.0)
except asyncio.TimeoutError:
    print("timed out")
```

### Java

```java
try {
    var result = t1().get(5, TimeUnit.SECONDS);
} catch (TimeoutException e) {
    System.err.println("timed out");
}

// or with orTimeout (Java 9+)
var result = t1().orTimeout(5, TimeUnit.SECONDS).get();
```

### Rust

```rust
match tokio::time::timeout(Duration::from_secs(5), t1()).await {
    Ok(result) => use(result),
    Err(_) => eprintln!("timed out"),
}
```

### Go

```go
ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
defer cancel()

ch := make(chan ResultType, 1)
go func() { r, _ := t1(ctx); ch <- r }()

select {
case r := <-ch:
    use(r)
case <-ctx.Done():
    fmt.Println("timed out")
}
```

---

## Pipeline: stream results between stages

Process items through multiple stages, where each stage can run concurrently.

### Node.js

```js
// async generator pipeline
async function* stage1(items) {
  for (const item of items) yield await fetch(item);
}
async function* stage2(stream) {
  for await (const item of stream) yield await transform(item);
}
async function* stage3(stream) {
  for await (const item of stream) yield await save(item);
}

for await (const result of stage3(stage2(stage1(urls)))) {
  use(result);
}
```

### Python

```python
import asyncio

async def stage1(queue_in, queue_out):
    while (item := await queue_in.get()) is not None:
        result = await fetch(item)
        await queue_out.put(result)
    await queue_out.put(None)

async def stage2(queue_in, queue_out):
    while (item := await queue_in.get()) is not None:
        result = await transform(item)
        await queue_out.put(result)
    await queue_out.put(None)

q1, q2, q3 = asyncio.Queue(), asyncio.Queue(), asyncio.Queue()
for url in urls: await q1.put(url)
await q1.put(None)

await asyncio.gather(stage1(q1, q2), stage2(q2, q3))
```

### Java

```java
// CompletableFuture pipeline
var results = items.stream()
    .map(item -> CompletableFuture.supplyAsync(() -> fetch(item)))
    .map(f -> f.thenApply(r -> transform(r)))
    .map(f -> f.thenApply(r -> save(r)))
    .map(CompletableFuture::join)
    .toList();
```

### Rust

```rust
use tokio::sync::mpsc;

let (tx1, mut rx1) = mpsc::channel(32);
let (tx2, mut rx2) = mpsc::channel(32);

tokio::spawn(async move {
    while let Some(item) = rx1.recv().await {
        tx2.send(transform(item).await).await.ok();
    }
});

tokio::spawn(async move {
    while let Some(item) = rx2.recv().await {
        save(item).await;
    }
});

for url in urls { tx1.send(fetch(url).await).await.ok(); }
```

### Go

```go
func stage1(in <-chan Item) <-chan Item {
    out := make(chan Item)
    go func() {
        defer close(out)
        for item := range in { out <- fetch(item) }
    }()
    return out
}

func stage2(in <-chan Item) <-chan Item {
    out := make(chan Item)
    go func() {
        defer close(out)
        for item := range in { out <- transform(item) }
    }()
    return out
}

// wire up: input -> stage1 -> stage2 -> consume
for result := range stage2(stage1(input)) {
    use(result)
}
```

---

## Retry with backoff

Retry a flaky operation with increasing delays.

### Node.js

```js
async function retry(fn, maxRetries = 3) {
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === maxRetries) throw err;
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, i)));
    }
  }
}

const result = await retry(() => fetchData());
```

### Python

```python
async def retry(fn, max_retries=3):
    for i in range(max_retries + 1):
        try:
            return await fn()
        except Exception:
            if i == max_retries:
                raise
            await asyncio.sleep(2 ** i)

result = await retry(fetch_data)
```

### Java

```java
<T> T retry(Callable<T> fn, int maxRetries) throws Exception {
    for (int i = 0; i <= maxRetries; i++) {
        try { return fn.call(); }
        catch (Exception e) {
            if (i == maxRetries) throw e;
            Thread.sleep((long) Math.pow(2, i) * 1000);
        }
    }
    throw new IllegalStateException();
}

var result = retry(() -> fetchData(), 3);
```

### Rust

```rust
async fn retry<F, Fut, T, E>(f: F, max_retries: u32) -> Result<T, E>
where
    F: Fn() -> Fut,
    Fut: Future<Output = Result<T, E>>,
{
    for i in 0..=max_retries {
        match f().await {
            Ok(v) => return Ok(v),
            Err(e) if i == max_retries => return Err(e),
            _ => tokio::time::sleep(Duration::from_secs(2u64.pow(i))).await,
        }
    }
    unreachable!()
}

let result = retry(|| fetch_data(), 3).await?;
```

### Go

```go
func retry(fn func() (ResultType, error), maxRetries int) (ResultType, error) {
    var result ResultType
    var err error
    for i := 0; i <= maxRetries; i++ {
        result, err = fn()
        if err == nil { return result, nil }
        if i < maxRetries {
            time.Sleep(time.Duration(math.Pow(2, float64(i))) * time.Second)
        }
    }
    return result, err
}

result, err := retry(fetchData, 3)
```

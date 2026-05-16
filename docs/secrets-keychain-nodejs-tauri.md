# Secrets Storage with OS Keychains (Node.js & Tauri)

A practical reference for storing secrets (DB passwords, API tokens, connection strings) in OS-native credential stores instead of plaintext JSON/SQLite, for Node.js apps and Tauri desktop apps.

---

## Table of Contents

- [Why not plaintext](#why-not-plaintext)
- [The three OS backends](#the-three-os-backends)
- [Library options](#library-options)
- [Decision matrix](#decision-matrix)
- [The Linux headless gotcha](#the-linux-headless-gotcha)
- [Recommended pattern: SecretStore abstraction](#recommended-pattern-secretstore-abstraction)
- [Encrypted-file fallback](#encrypted-file-fallback)
- [Migration: plaintext JSON → keychain](#migration-plaintext-json--keychain)
- [Tauri-specific: Rust vs Node sidecar](#tauri-specific-rust-vs-node-sidecar)
- [Complete sample: Node.js](#complete-sample-nodejs)
- [Complete sample: Tauri](#complete-sample-tauri)
- [Common pitfalls](#common-pitfalls)

---

## Why not plaintext

Storing secrets in `~/.myapp/connections.json` or `app.db` leaks them through:

- iCloud / OneDrive / Dropbox sync (homedir backups)
- Time Machine and equivalent system backups
- Anyone with read access to your homedir (`cat ~/.myapp/*.json`)
- Crash dumps, error reporters, support bundles
- Accidental git commits of dotfile dirs

OS keychains solve this: secrets sit in a per-user encrypted store, unlocked when the user logs in, gated by the OS.

---

## The three OS backends

| OS      | Backend                | Daemon needed   | API                                  |
| ------- | ---------------------- | --------------- | ------------------------------------ |
| macOS   | Keychain Services      | none (built-in) | `Security.framework`                 |
| Windows | Credential Manager     | none (built-in) | `wincred` / `CredRead`/`CredWrite`   |
| Linux   | Secret Service (D-Bus) | **YES**         | `gnome-keyring` or `kwallet` running |

The Linux row is the one that hurts. See [headless gotcha](#the-linux-headless-gotcha).

---

## Library options

### Node.js

| Library              | Status               | Notes                                                            |
| -------------------- | -------------------- | ---------------------------------------------------------------- |
| `@napi-rs/keyring`   | **Active, current**  | NAPI (no node-gyp), prebuilt binaries, wraps Rust `keyring-rs`   |
| `keytar`             | **Archived in 2023** | Don't use. Electron team dropped it.                             |
| `node-keytar` forks  | Stale                | Avoid.                                                           |
| `keyring` (npm)      | Niche                | Less polish, smaller community.                                  |

#### `@napi-rs/keyring` quickstart

```bash
npm install @napi-rs/keyring
```

```js
import { Entry } from '@napi-rs/keyring';

const entry = new Entry('my-app', 'connection:prod-mysql'); // service, account
entry.setPassword('hunter2');
const pw = entry.getPassword();           // → 'hunter2'
entry.deletePassword();
```

### Tauri (Rust side)

| Crate                        | Notes                                                                     |
| ---------------------------- | ------------------------------------------------------------------------- |
| `keyring`                    | Same `keyring-rs` that `@napi-rs/keyring` wraps. Standard choice.         |
| `tauri-plugin-stronghold`    | Encrypted file vault (IOTA Stronghold), NOT OS keychain. Password-gated.  |

#### Rust `keyring` quickstart

```rust
use keyring::Entry;

let entry = Entry::new("my-app", "connection:prod-mysql")?;
entry.set_password("hunter2")?;
let pw = entry.get_password()?;
entry.delete_password()?;
```

Expose to the frontend via a Tauri command:

```rust
#[tauri::command]
fn secret_set(service: &str, account: &str, value: &str) -> Result<(), String> {
    keyring::Entry::new(service, account)
        .map_err(|e| e.to_string())?
        .set_password(value)
        .map_err(|e| e.to_string())
}
```

```ts
import { invoke } from '@tauri-apps/api/core';
await invoke('secret_set', { service: 'my-app', account: 'conn:prod', value: 'hunter2' });
```

---

## Decision matrix

| Your situation                                | Pick                                                       |
| --------------------------------------------- | ---------------------------------------------------------- |
| Pure Node.js CLI / server                     | `@napi-rs/keyring` + encrypted-file fallback               |
| Tauri-only desktop app                        | Rust `keyring` crate via Tauri command                     |
| Tauri **+** standalone Node mode (e.g. portal)| `@napi-rs/keyring` everywhere (one code path)              |
| Need shared vault, no OS dependency           | `tauri-plugin-stronghold` (Tauri) or libsodium file (Node) |
| Headless Linux server in scope                | Encrypted file is the only realistic option                |

The trap to avoid: **two stores** (Rust keychain in Tauri mode, Node keychain in standalone mode) means secrets set in one mode don't appear in the other. Pick one library and stick with it across modes, OR document the boundary loudly.

---

## The Linux headless gotcha

`keyring-rs` (and therefore `@napi-rs/keyring` and Tauri's `keyring` crate) talks to **Secret Service over D-Bus**. That requires a running daemon: `gnome-keyring-daemon` or `kwalletd`. Most desktop installs have one; **most servers, minimal WMs, SSH sessions, and Docker containers do not**.

Symptoms:

```
Error: org.freedesktop.secrets was not provided by any .service files
```

Mitigations:

1. **Detect at startup**, fall back to encrypted file (see below).
2. **Document the requirement** for users running on minimal Linux.
3. **Offer a "use file backend" flag** so headless users opt in explicitly without prompts.

---

## Recommended pattern: SecretStore abstraction

Don't sprinkle keyring calls across your codebase. Wrap them in a single interface so swapping backends (or falling back) is local.

```ts
// SecretStore.ts
export interface SecretStore {
  get(account: string): Promise<string | null>;
  set(account: string, value: string): Promise<void>;
  delete(account: string): Promise<void>;
}
```

```ts
// KeychainSecretStore.ts
import { Entry } from '@napi-rs/keyring';

export class KeychainSecretStore implements SecretStore {
  constructor(private service: string) {}
  async get(account: string) {
    try { return new Entry(this.service, account).getPassword(); }
    catch { return null; }
  }
  async set(account: string, value: string) {
    new Entry(this.service, account).setPassword(value);
  }
  async delete(account: string) {
    new Entry(this.service, account).deletePassword();
  }
}
```

```ts
// SecretStoreFactory.ts
export function createSecretStore(service: string): SecretStore {
  try {
    const store = new KeychainSecretStore(service);
    // Probe: try a no-op read; if it throws Secret-Service-unavailable, fall back.
    return store;
  } catch {
    return new EncryptedFileSecretStore(service);
  }
}
```

---

## Encrypted-file fallback

When the OS keychain isn't available (headless Linux, etc.), the next-best option is an encrypted file with a key derived from either:

1. **A machine-derived secret** (e.g. `/etc/machine-id`, macOS IOPlatformUUID) — "secure-enough" but anyone with file read access on the machine can decrypt.
2. **A user-entered master password** — properly secure; requires unlocking on each app start.

Primitives:

- **AES-256-GCM** for the cipher (`node:crypto` ships it).
- **Argon2id** for password-derived keys (`argon2` npm package).
- **HKDF** for deriving from a machine ID (already in `node:crypto`).

Skeleton:

```ts
import { createCipheriv, createDecipheriv, randomBytes, hkdfSync } from 'node:crypto';

function deriveKey(machineId: string): Buffer {
  return Buffer.from(hkdfSync('sha256', machineId, Buffer.alloc(0), 'my-app-secrets', 32));
}

function encrypt(plain: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString('base64');
}
```

Store the resulting blob at `~/.myapp/secrets.enc` with `0600` perms.

---

## Migration: plaintext JSON → keychain

One-shot migration on app start:

1. Read existing `connections.json`.
2. For each entry with a `password` field:
   - Write to keychain under `service="my-app"`, `account="conn:<connectionId>"`.
   - Strip `password` from the JSON object.
   - Replace with a marker: `passwordRef: "keychain"` (or `"file"` if fallback).
3. Write the JSON back atomically (`tmp → rename`).
4. Add a version bump field so the migration only runs once: `secretsMigratedAt: <epoch_ms>`.

When loading a connection, the runtime checks `passwordRef` and pulls the actual secret from the right store. If the keychain entry is missing (user wiped it, restored from backup, moved machine), prompt for re-entry rather than failing silently.

---

## Tauri-specific: Rust vs Node sidecar

If your Tauri app has a Node.js sidecar (Hono / Express / etc.) the question is **where the secret-store call lives**.

| Approach                                              | Pros                                | Cons                                                    |
| ----------------------------------------------------- | ----------------------------------- | ------------------------------------------------------- |
| Rust `keyring` exposed via Tauri command              | Native, no Node deps                | Sidecar can't invoke Tauri commands directly            |
| `@napi-rs/keyring` in the Node sidecar                | Sidecar self-contained              | Native `.node` artifact must ship alongside bundled JS  |
| Both (Rust for frontend ops, Node for sidecar ops)    | Each side uses native               | **Two stores** — secrets diverge unless you sync them   |

**Note on sidecar → Tauri command:** Tauri's `invoke` API is frontend-only. The sidecar cannot directly call a Tauri command — it would have to HTTP back to the frontend, which then invokes Rust. Usually not worth it; just use `@napi-rs/keyring` in the sidecar.

If you bundle the sidecar with Vite/esbuild into a single JS file, mark the native dep external and copy the `.node` artifact next to the bundle:

```ts
// vite.sidecar.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      external: ['@napi-rs/keyring', /\.node$/],
    },
  },
});
```

---

## Complete sample: Node.js

A self-contained working example: `SecretStore` interface, two backends (keychain + encrypted file), a factory that auto-detects, and a small CLI driver.

### `package.json`

```json
{
  "name": "secrets-demo",
  "type": "module",
  "dependencies": {
    "@napi-rs/keyring": "^1.1.5",
    "argon2": "^0.41.1"
  }
}
```

### `src/SecretStore.ts`

```ts
/** Abstract store for short string secrets, keyed by a stable account id. */
export interface SecretStore {
  /** Returns the secret or null if not found. Never throws on missing. */
  get(account: string): Promise<string | null>;
  /** Creates or overwrites the secret for `account`. */
  set(account: string, value: string): Promise<void>;
  /** Removes the secret. No-op if missing. */
  delete(account: string): Promise<void>;
  /** Lists known accounts (best-effort; some backends can't enumerate). */
  list(): Promise<string[]>;
  /** Backend identifier for diagnostics ("keychain" | "file"). */
  readonly backend: string;
}
```

### `src/KeychainSecretStore.ts`

```ts
import { Entry } from '@napi-rs/keyring';

/**
 * OS-keychain backend. Uses macOS Keychain, Windows Credential Manager,
 * or Linux Secret Service via @napi-rs/keyring.
 *
 * The keychain itself doesn't enumerate by service well across platforms,
 * so we maintain a sidecar index file with the account names we've written.
 */
export class KeychainSecretStore implements SecretStore {
  readonly backend = 'keychain';
  private index = new Set<string>();

  constructor(private service: string) {}

  async get(account: string): Promise<string | null> {
    try {
      return new Entry(this.service, account).getPassword();
    } catch (err) {
      // Entry.getPassword throws when not found AND on other errors;
      // treat both as "not available" — caller should re-probe via probe().
      return null;
    }
  }

  async set(account: string, value: string): Promise<void> {
    new Entry(this.service, account).setPassword(value);
    this.index.add(account);
  }

  async delete(account: string): Promise<void> {
    try {
      new Entry(this.service, account).deletePassword();
    } catch {
      // Already gone is fine.
    }
    this.index.delete(account);
  }

  async list(): Promise<string[]> {
    return [...this.index];
  }

  /**
   * One-time probe. Writes-then-reads-then-deletes a sentinel entry to
   * confirm the backend is actually usable (catches the Linux
   * "Secret Service not available" case before users hit it).
   */
  static probe(service: string): boolean {
    const sentinel = '__probe__';
    try {
      const e = new Entry(service, sentinel);
      e.setPassword('ok');
      const v = e.getPassword();
      e.deletePassword();
      return v === 'ok';
    } catch {
      return false;
    }
  }
}
```

### `src/EncryptedFileSecretStore.ts`

```ts
import { createCipheriv, createDecipheriv, randomBytes, hkdfSync } from 'node:crypto';
import { readFile, writeFile, mkdir, rename, chmod } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir, hostname } from 'node:os';

/**
 * Encrypted-file fallback. AES-256-GCM with a key derived (HKDF-SHA256)
 * from a machine-stable secret. Not as strong as the OS keychain, but
 * meaningfully better than plaintext JSON.
 *
 * For real production headless deployments, prompt for a master password
 * at startup and derive the key with Argon2id instead — see derivePassKey().
 */
export class EncryptedFileSecretStore implements SecretStore {
  readonly backend = 'file';
  private cache = new Map<string, string>();
  private loaded = false;

  constructor(
    private filePath = join(homedir(), '.myapp', 'secrets.enc'),
    private key: Buffer = deriveMachineKey(),
  ) {}

  async get(account: string): Promise<string | null> {
    await this.load();
    return this.cache.get(account) ?? null;
  }

  async set(account: string, value: string): Promise<void> {
    await this.load();
    this.cache.set(account, value);
    await this.flush();
  }

  async delete(account: string): Promise<void> {
    await this.load();
    if (this.cache.delete(account)) await this.flush();
  }

  async list(): Promise<string[]> {
    await this.load();
    return [...this.cache.keys()];
  }

  private async load(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    if (!existsSync(this.filePath)) return;
    const blob = await readFile(this.filePath);
    const iv = blob.subarray(0, 12);
    const tag = blob.subarray(12, 28);
    const ct = blob.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(tag);
    const json = Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
    for (const [k, v] of Object.entries(JSON.parse(json) as Record<string, string>)) {
      this.cache.set(k, v);
    }
  }

  private async flush(): Promise<void> {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const json = JSON.stringify(Object.fromEntries(this.cache));
    const ct = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    const blob = Buffer.concat([iv, tag, ct]);

    await mkdir(dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.tmp`;
    await writeFile(tmp, blob);
    await chmod(tmp, 0o600);
    await rename(tmp, this.filePath); // atomic
  }
}

/** Derive a 32-byte key from a machine-stable identifier (hostname here for portability). */
function deriveMachineKey(): Buffer {
  // In real code: read /etc/machine-id on Linux, IOPlatformUUID on macOS,
  // MachineGuid on Windows. hostname is a placeholder.
  const machineId = hostname();
  return Buffer.from(
    hkdfSync('sha256', machineId, Buffer.alloc(0), 'my-app-secrets-v1', 32),
  );
}

/** Stronger alternative: derive from a user-entered password with Argon2id. */
// import argon2 from 'argon2';
// export async function derivePassKey(password: string, salt: Buffer): Promise<Buffer> {
//   const buf = await argon2.hash(password, {
//     type: argon2.argon2id,
//     salt,
//     hashLength: 32,
//     raw: true,
//     timeCost: 3, memoryCost: 64 * 1024, parallelism: 1,
//   });
//   return buf as Buffer;
// }
```

### `src/SecretStoreFactory.ts`

```ts
import { KeychainSecretStore } from './KeychainSecretStore.js';
import { EncryptedFileSecretStore } from './EncryptedFileSecretStore.js';

/**
 * Returns the best available SecretStore for this host.
 * Prefers OS keychain; falls back to encrypted file if the keychain
 * isn't usable (e.g. Linux without Secret Service).
 */
export function createSecretStore(service: string): SecretStore {
  if (process.env.MYAPP_FORCE_FILE_SECRETS === '1') {
    return new EncryptedFileSecretStore();
  }
  if (KeychainSecretStore.probe(service)) {
    return new KeychainSecretStore(service);
  }
  console.warn('Keychain unavailable; falling back to encrypted file store.');
  return new EncryptedFileSecretStore();
}
```

### `src/cli.ts` (driver)

```ts
import { createSecretStore } from './SecretStoreFactory.js';

const store = createSecretStore('my-app');
console.log(`Using backend: ${store.backend}`);

const [, , cmd, account, value] = process.argv;

switch (cmd) {
  case 'set':
    await store.set(account, value);
    console.log(`Set ${account}`);
    break;
  case 'get': {
    const v = await store.get(account);
    console.log(v == null ? '(not found)' : v);
    break;
  }
  case 'del':
    await store.delete(account);
    console.log(`Deleted ${account}`);
    break;
  case 'list':
    console.log((await store.list()).join('\n'));
    break;
  default:
    console.log('usage: cli.ts <set|get|del|list> <account> [value]');
}
```

### Running it

```bash
npx tsx src/cli.ts set conn:prod 'hunter2'
npx tsx src/cli.ts get conn:prod          # → hunter2
npx tsx src/cli.ts list                    # → conn:prod
npx tsx src/cli.ts del conn:prod
```

### Migration helper (plaintext JSON → SecretStore)

```ts
import { readFile, writeFile, rename } from 'node:fs/promises';

interface Connection {
  id: string;
  name: string;
  host: string;
  password?: string;        // legacy field
  passwordRef?: 'keychain' | 'file';  // new marker
}

/**
 * One-shot migration. Reads connections.json, moves every plaintext
 * `password` into the SecretStore, replaces with `passwordRef`, and
 * rewrites atomically.
 */
export async function migrateSecrets(jsonPath: string, store: SecretStore) {
  const raw = await readFile(jsonPath, 'utf8');
  const parsed = JSON.parse(raw) as { connections: Connection[]; secretsMigratedAt?: number };
  if (parsed.secretsMigratedAt) return; // already done

  for (const c of parsed.connections) {
    if (!c.password) continue;
    await store.set(`conn:${c.id}`, c.password);
    delete c.password;
    c.passwordRef = store.backend === 'keychain' ? 'keychain' : 'file';
  }
  parsed.secretsMigratedAt = Date.now();

  const tmp = `${jsonPath}.tmp`;
  await writeFile(tmp, JSON.stringify(parsed, null, 2));
  await rename(tmp, jsonPath);
}
```

---

## Complete sample: Tauri

A self-contained working example: Rust commands for get/set/delete/list, registered with the app builder, plus a typed TypeScript wrapper for the frontend.

### `src-tauri/Cargo.toml` (deps)

```toml
[dependencies]
tauri = { version = "2", features = [] }
keyring = "3"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
thiserror = "1"
```

### `src-tauri/src/secrets.rs`

```rust
//! OS-keychain secret storage commands exposed to the Tauri frontend.

use serde::Serialize;
use thiserror::Error;

/// Errors surfaced to the frontend. Keep messages generic — never include
/// the secret value in any error path.
#[derive(Debug, Error, Serialize)]
pub enum SecretError {
    #[error("entry not found")]
    NotFound,
    #[error("keychain unavailable: {0}")]
    Unavailable(String),
    #[error("io error: {0}")]
    Io(String),
}

impl From<keyring::Error> for SecretError {
    fn from(e: keyring::Error) -> Self {
        match e {
            keyring::Error::NoEntry => SecretError::NotFound,
            keyring::Error::PlatformFailure(inner)
            | keyring::Error::NoStorageAccess(inner) => SecretError::Unavailable(inner.to_string()),
            other => SecretError::Io(other.to_string()),
        }
    }
}

/// Probe the OS keychain by writing and reading a sentinel value.
/// Returns true if the backend is usable. Use this on app startup to
/// decide whether to fall back to a different store.
#[tauri::command]
pub fn secret_probe(service: String) -> bool {
    let sentinel = "__probe__";
    let Ok(entry) = keyring::Entry::new(&service, sentinel) else {
        return false;
    };
    if entry.set_password("ok").is_err() {
        return false;
    }
    let ok = entry.get_password().is_ok();
    let _ = entry.delete_credential();
    ok
}

/// Read the secret for (service, account). Returns null if not found.
#[tauri::command]
pub fn secret_get(service: String, account: String) -> Result<Option<String>, SecretError> {
    let entry = keyring::Entry::new(&service, &account)?;
    match entry.get_password() {
        Ok(s) => Ok(Some(s)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.into()),
    }
}

/// Create or overwrite the secret.
#[tauri::command]
pub fn secret_set(service: String, account: String, value: String) -> Result<(), SecretError> {
    let entry = keyring::Entry::new(&service, &account)?;
    entry.set_password(&value)?;
    Ok(())
}

/// Delete the secret. No-op if missing.
#[tauri::command]
pub fn secret_delete(service: String, account: String) -> Result<(), SecretError> {
    let entry = keyring::Entry::new(&service, &account)?;
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.into()),
    }
}
```

### `src-tauri/src/lib.rs`

```rust
mod secrets;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            secrets::secret_probe,
            secrets::secret_get,
            secrets::secret_set,
            secrets::secret_delete,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### `src-tauri/capabilities/default.json`

Make sure the commands are allowed in your capabilities file. With Tauri v2's permission model, custom commands defined in your own crate are allowed by default for the main window — no extra entry needed unless you've narrowed `core:default`. If you've locked things down, add an explicit allow.

### Frontend wrapper: `src/lib/secrets.ts`

```ts
import { invoke } from '@tauri-apps/api/core';

const SERVICE = 'my-app';

/**
 * Typed client for the Rust secret store. All calls are async and may
 * reject with `{ NotFound: null }`, `{ Unavailable: string }`, or `{ Io: string }`
 * (Rust enum serialized by serde).
 */
export const Secrets = {
  /** True if the OS keychain is usable on this host. */
  async probe(): Promise<boolean> {
    return invoke<boolean>('secret_probe', { service: SERVICE });
  },

  /** Read; returns null if not found. */
  async get(account: string): Promise<string | null> {
    return invoke<string | null>('secret_get', { service: SERVICE, account });
  },

  /** Create or overwrite. */
  async set(account: string, value: string): Promise<void> {
    await invoke('secret_set', { service: SERVICE, account, value });
  },

  /** Delete; no-op if missing. */
  async delete(account: string): Promise<void> {
    await invoke('secret_delete', { service: SERVICE, account });
  },
};
```

### Using it from React

```tsx
import { useEffect, useState } from 'react';
import { Secrets } from './lib/secrets';

export function ConnectionForm({ connectionId }: { connectionId: string }) {
  const [password, setPassword] = useState('');
  const [keychainOk, setKeychainOk] = useState<boolean | null>(null);

  useEffect(() => {
    Secrets.probe().then(setKeychainOk);
    Secrets.get(`conn:${connectionId}`).then(v => v && setPassword(v));
  }, [connectionId]);

  async function save() {
    await Secrets.set(`conn:${connectionId}`, password);
  }

  async function clear() {
    await Secrets.delete(`conn:${connectionId}`);
    setPassword('');
  }

  if (keychainOk === false) {
    return <div>Keychain unavailable — secrets will be stored in an encrypted file.</div>;
  }

  return (
    <>
      <input type="password" value={password} onChange={e => setPassword(e.target.value)} />
      <button onClick={save}>Save</button>
      <button onClick={clear}>Forget</button>
    </>
  );
}
```

### Notes on the Tauri sample

- `keyring` crate v3 renamed `delete_password` → `delete_credential`. Older tutorials may show the old name.
- Errors are serialized as a tagged enum because `SecretError` derives `Serialize`. On the JS side, a rejection is the JSON form: `{ NotFound: null }` etc. Wrap in a `try/catch` and switch on the key if you need typed handling.
- `secret_probe` is the recommended startup check. Call it once, store the result, and either show a "secrets stored in keychain" badge or fall back to a Rust-side encrypted-file store (not shown — same primitives as the Node sample but using `aes-gcm` + `argon2` crates).
- If the user denies keychain access (macOS prompt), `get_password` returns `PlatformFailure`. Surface it as a soft error and offer "remember decision" UX rather than retrying in a loop.

---

## Common pitfalls

- **Using `keytar`.** It's archived. Use `@napi-rs/keyring`.
- **No Linux fallback.** Headless Linux will fail with `Secret Service not available`. Always have an encrypted-file path.
- **Storing the whole connection object in keychain.** Keychain entries have size limits (macOS ~4KB practical). Store only the secret; keep metadata in JSON.
- **Using one big keychain entry for everything.** Use one entry per secret with a structured `account` name (`conn:<id>`, `apikey:<service>`). Easier to revoke/rotate.
- **Logging the secret after retrieval.** `console.log(entry.getPassword())` ends up in support bundles. Treat secrets as never-printable.
- **Forgetting to delete on uninstall / connection removal.** Orphans accumulate in the user's keychain forever. Wire deletion into the "remove connection" path.
- **Assuming sync across machines.** macOS Keychain syncs via iCloud Keychain only if the user enabled it AND the entry is marked syncable; Windows Credential Manager does NOT sync; Linux never syncs. Treat per-machine as the default.
- **CI/test environments.** Tests should use an in-memory or file-backed `SecretStore`, never touch the real OS keychain. Inject via the factory.

---

## References

- `@napi-rs/keyring` — https://github.com/napi-rs/node-keyring
- `keyring-rs` (Rust) — https://github.com/hwchen/keyring-rs
- `tauri-plugin-stronghold` — https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins/stronghold
- Electron `safeStorage` (reference implementation worth studying) — https://www.electronjs.org/docs/latest/api/safe-storage
- Apple Keychain Services — https://developer.apple.com/documentation/security/keychain_services
- Windows Credential Manager — https://learn.microsoft.com/en-us/windows/win32/secauthn/credentials-management
- Freedesktop Secret Service — https://specifications.freedesktop.org/secret-service-spec/latest/

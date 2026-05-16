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

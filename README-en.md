<div align="center">
  <img src="public/logo.svg" alt="NekoVault Logo" width="128" />
  <h1>NekoVault</h1>
  <p>🔐 A personal TOTP and password manager built for Cloudflare Workers</p>
  <p>
    <strong>English</strong> · <a href="README.md">简体中文</a>
  </p>
</div>

---

NekoVault is a mobile-first personal web app built with **Nuxt 4 + Cloudflare Workers + D1**. It uses a single **Worker-side admin token** for global access control, while keeping an encrypted local snapshot in the browser for offline unlock and recovery.

## Features

### Simple global access control
- Configure `ADMIN_TOKEN` in your Worker environment.
- Enter that token in the client to unlock, read, and sync the vault.
- If `ADMIN_TOKEN` is missing, the server fails closed instead of allowing anonymous access.

### Personal self-hosted workflow
- Runs on Cloudflare Workers with D1 as the backing store.
- D1 keeps a single Vault JSON document plus a `revision` number for optimistic concurrency.
- The first successful unlock against an empty instance automatically bootstraps an empty vault.

### Local encrypted cache
- Uses `Dexie.js + IndexedDB` to keep an encrypted local snapshot.
- Previously synced data can still be unlocked offline.
- Pending writes are retried automatically after the network comes back.

### PWA support
- Ships with `@vite-pwa/nuxt`.
- Can be installed to desktop or mobile home screen.

### Mobile WebView and CSP compatibility
- The frontend build target is intentionally lowered to cover older mobile browsers and embedded WebViews.
- Icons and critical runtime assets are bundled locally as much as possible to avoid strict CSP environments breaking the first screen.

---

## Stack

- **Framework**: Nuxt 4 / Vue 3 / Nitro
- **UI**: Nuxt UI / Tailwind CSS
- **State & utilities**: Pinia / VueUse / Dexie
- **Deployment**: Cloudflare Workers + D1

---

## Deployment

### 1. Install dependencies

```bash
pnpm install
```

### 2. Create the D1 database

```bash
pnpm run d1:create
```

Copy the returned `database_id`.

### 3. Copy and configure Wrangler

Copy the example file first:

```bash
cp wrangler.toml.example wrangler.toml
```

On Windows PowerShell:

```powershell
Copy-Item wrangler.toml.example wrangler.toml
```

Then edit `wrangler.toml` and set at least:

```toml
[[d1_databases]]
binding = "DB"
database_name = "nekovault-db"
database_id = "your-database-id"

[vars]
ADMIN_TOKEN = "your-access-token"
```

The real `wrangler.toml` is intentionally not tracked. The repository only keeps `wrangler.toml.example`.

### 4. Deploy

```bash
pnpm run deploy
```

---

## Local development

### Plain Nuxt dev mode

```bash
pnpm run dev
```

If you want `/api/*` to work locally, provide `ADMIN_TOKEN` first. Example in PowerShell:

```powershell
$env:ADMIN_TOKEN="your-local-dev-token"
pnpm run dev
```

### Worker-like local runtime

For a closer Cloudflare environment:

```bash
npx wrangler dev
```

Make sure `wrangler.toml` already contains the D1 binding and `ADMIN_TOKEN`.

---

## Data model

- Remote: D1 stores one Vault document.
- Local: the browser stores an additional encrypted snapshot for offline unlock.
- Resetting local data only clears the current device cache, not the remote vault.

---

## License

MIT

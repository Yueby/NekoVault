# NekoVault v1 Plan: TOTP-First Mobile Web App

## Summary

- Create a new project in `E:\Projects\Github\NekoVault` as a mobile-first, single-user `Nuxt 4` app using `Nuxt UI`.
- Ship v1 as a `TOTP management + generation` product first: setup vault, unlock with a master password, create/edit/delete TOTP entries, generate current codes, and keep codes usable offline.
- Deploy on `Cloudflare Workers` with `D1` as the remote encrypted vault store. The server stores only ciphertext and verification metadata; plaintext secrets never leave the browser.
- Design direction: clean, cute, and light. Use soft mint/sky/sakura accents, rounded cards, quiet motion, and restrained "Neko" branding. Keep security-critical flows visually calm rather than playful.

## Implementation Changes

### App and runtime stack

- Use `Nuxt 4` with Nitro's Cloudflare Workers target.
- Use `Nuxt UI` for app shell, cards, forms, drawers/modals, notifications, and theme tokens.
- Use `Pinia` for UI/session state only.
- Use `VueUse` for clipboard, timers, online/offline state, and device helpers.
- Use `Dexie` for encrypted local persistence in `IndexedDB`.
- Use `@vite-pwa/nuxt` to cache the app shell and enable installable/offline behavior.
- Use `otpauth` for TOTP generation, validation, and `otpauth://` URI parsing.
- Use `zod` for payload/schema validation on both client and server.
- Use `hash-wasm` 提供 Argon2id WASM 实现，用于浏览器端密钥派生。选择 `hash-wasm` 因为它体积小、纯 WASM、无外部依赖，且在移动端表现良好。
- Use Web Crypto for AES-GCM encryption and SHA-256 hashing. Derive one encryption key and one sync-auth secret from the master password.
- Argon2id 参数推荐：`memory=64MB, iterations=3, parallelism=1`。在移动端首次加载时进行性能基准测试，若派生耗时超过 3 秒则自动降级 memory 参数至 `32MB`，并在 UI 上显示进度指示器。

### Product structure and UX

- Create these routes: `setup`, `unlock`, `codes`, `settings`.
- `setup`: first-run flow to create the master password, derive keys, initialize an empty encrypted vault, and persist the first snapshot remotely and locally.
  - 主密码强度要求：至少 12 字符，包含大小写字母和数字。使用实时强度指示器（弱/中/强/非常强）给用户反馈。
  - 派生密钥时展示加载动画和进度文案（如"正在生成加密密钥…"），避免用户困惑。
- `unlock`: prompt for master password, derive keys locally, fetch latest encrypted snapshot when online, fall back to local encrypted snapshot when offline, then hydrate the in-memory vault.
  - 错误密码尝试限制：连续错误 5 次后强制等待 30 秒，10 次后等待 5 分钟。限制状态存储在 IndexedDB 中，防止页面刷新绕过。
- `codes`: primary mobile screen. Show TOTP entries as large rounded cards with issuer/account label, 6-digit code, copy action, and countdown ring/progress. Use one-column mobile layout first; tablet layout can become a two-column grid.
  - 搜索与过滤：顶部提供即时搜索框，支持按 issuer、label、accountName 模糊匹配，条目少于 3 个时自动隐藏搜索框。
  - 排序：支持按 issuer 字母序、最近使用、手动拖拽排序。默认按 issuer 字母序。排序偏好和手动排序结果持久化到 vault 文档中。
  - 条目分组：按 issuer 首字母或自定义分组（v1 先实现首字母分组，自定义分组列为 v2）。
- `codes` create/edit flow: use a bottom sheet or full-screen mobile modal with fields for `label`, `issuer`, `accountName`, `secret`, `digits`, `period`, and `algorithm`. Defaults: `digits=6`, `period=30`, `algorithm=SHA1`.
  - 支持通过粘贴 `otpauth://totp/...` URI 自动解析填充所有字段。检测到剪贴板中包含 `otpauth://` 前缀时弹出快捷导入提示。
  - 手动输入 secret 时自动去除空格并转为大写，校验 Base32 格式合法性。
- `settings`: local session controls, vault sync status, and app security configuration.
  - 自动锁定：支持设置自动锁定超时时间（1 分钟 / 5 分钟 / 15 分钟 / 30 分钟 / 从不）。默认 5 分钟。使用 `visibilitychange` 事件和 `VueUse` 的 `useIdle` 检测用户活动。切换标签页或锁屏也触发锁定计时。
  - 加密备份导出：将整个加密 vault 快照导出为 `.nekovault` 文件（实际是加密 JSON），可在其他设备的 NekoVault 上导入恢复。导入时需要输入原主密码解密。
  - 明文导出（危险操作）：需二次确认主密码后，导出为标准 `otpauth://` URI 列表的纯文本文件，方便迁移到其他 TOTP 应用。导出后立即弹出安全警告提示用户删除文件。
  - 同步状态显示：最后同步时间、同步状态（成功/失败/冲突/离线）。
  - 修改主密码：验证旧密码 → 输入新密码 → 用新密码重新派生密钥 → 重新加密 vault → 同步到远程。
  - 本地数据重置：仅清除当前设备的本地数据（IndexedDB），不影响远程 vault。需二次确认。
- Keep future password-manager expansion in mind, but do not build password storage UI or routes in v1.

### Session management and auto-lock

- 解锁后，加密密钥（`CryptoKey` 对象）仅存留在内存中，绝不持久化到 IndexedDB 或 localStorage。
- 自动锁定触发条件：
  - 用户空闲超过设定时间（默认 5 分钟）。
  - 页面 `visibilitychange` 为 `hidden` 后超过设定时间。
  - 用户主动点击锁定按钮。
- 锁定时清除：内存中的 `CryptoKey`、解密后的 vault 明文、Pinia session state。
- 锁定后跳转回 `unlock` 路由，用户重新输入主密码解锁。

### Security hardening

- HTTP 安全头（通过 Nitro server middleware 或 Cloudflare Workers 响应头设置）：
  - `Content-Security-Policy`: 严格白名单，禁止 `unsafe-inline`（如果 Nuxt UI 兼容的话）、禁止 `unsafe-eval`、限制 `connect-src` 仅允许自身 origin。
  - `Strict-Transport-Security`: `max-age=31536000; includeSubDomains; preload`。
  - `X-Content-Type-Options`: `nosniff`。
  - `X-Frame-Options`: `DENY`。
  - `Referrer-Policy`: `no-referrer`。
  - `Permissions-Policy`: 禁用不需要的 API（camera、microphone、geolocation 等）。
- API 安全：
  - 所有 `/api/*` 端点验证 `syncAuthSecret`，通过 `Authorization: Bearer SHA256(syncAuthSecret)` 头传递。
  - POST/PUT 请求体使用 `zod` 严格校验，拒绝未知字段。
  - D1 操作使用参数化查询防止 SQL 注入。
  - Rate limiting：通过 Cloudflare 的内置速率限制或自定义计数器，限制 `/api/bootstrap` 和 `/api/vault` 的请求频率（如每分钟 30 次）。

### Data, crypto, and server boundaries

- Use a single encrypted vault document for v1, not per-item rows. This keeps the MVP simpler and easier for AI-generated code to keep consistent.
- **注意 v1 的已知限制**：单文档模式意味着每次同步传输完整密文。当条目超过约 500 个时性能可能下降。v2 应考虑分片或增量同步方案。
- Vault document shape:
  - `schemaVersion`
  - `entries: TotpEntry[]`
  - `sortOrder: string[]` — 条目 ID 的有序数组，记录用户自定义排序
  - `preferences: VaultPreferences` — 用户偏好设置（排序方式、自动锁定时间等）
  - `updatedAt`
- `TotpEntry` shape:
  - `id`
  - `label`
  - `issuer`
  - `accountName`
  - `secret`
  - `digits`
  - `period`
  - `algorithm`
  - `icon` — 可选，issuer 对应的图标标识符（v1 使用内置的品牌图标映射表，无需用户上传）
  - `lastUsedAt` — 可选，最后一次复制/使用的时间戳，用于"最近使用"排序
  - `createdAt`
  - `updatedAt`
- `VaultPreferences` shape:
  - `sortMode`: `'alpha' | 'recent' | 'manual'` — 排序方式，默认 `'alpha'`
  - `autoLockMinutes`: `number` — 自动锁定时间（分钟），默认 `5`，`0` 表示从不
  - `showCodesOnUnlock`: `boolean` — 解锁后是否直接显示验证码，默认 `true`
- Persist the remote snapshot in one D1 row with fields for:
  - `vaultId`
  - `ciphertext`
  - `iv`
  - `salt`
  - `kdfParams` — JSON 字符串，包含 `{ memory, iterations, parallelism }` Argon2id 参数
  - `authTokenHash`
  - `revision`
  - `updatedAt`
- Key model:
  - Derive a 64-byte result from the master password with Argon2id and a per-vault salt.
  - Split the derived bytes into `encryptionKey` (first 32 bytes → AES-256-GCM) and `syncAuthSecret` (last 32 bytes).
  - Encrypt the vault JSON with `AES-GCM` in the browser, using a fresh random IV for every encryption operation.
  - Store only `SHA-256(syncAuthSecret)` on the server for request verification.
  - **密钥派生结果绝不缓存到持久存储**，每次解锁都从主密码重新派生。
- API surface:
  - `POST /api/bootstrap`: create the first vault snapshot and store verifier metadata. 仅在 vault 不存在时允许调用，否则返回 `409`。
  - `GET /api/vault`: return the latest encrypted snapshot after sync-auth verification.
  - `PUT /api/vault`: replace the encrypted snapshot with optimistic concurrency via `revision`.
  - `POST /api/vault/verify`: 轻量级端点，仅验证 sync-auth 凭证是否有效，不返回 vault 数据。用于 setup 完成后的连通性验证和修改密码后的远程验证。
- Conflict behavior:
  - Client sends current `revision` on update.
  - Server returns `409` on mismatch.
  - v1 does not auto-merge; the client shows冲突对话框，展示本地和远程的 `updatedAt` 时间戳，用户选择"使用远程版本"或"覆盖为本地版本"。
- Offline model:
  - Cache the app shell with PWA support.
  - Store the latest encrypted snapshot and pending write intent locally in IndexedDB.
  - When offline, unlock against the local encrypted snapshot and allow full create/edit/delete.
  - On reconnect, sync the pending snapshot if the remote `revision` still matches; otherwise surface a conflict prompt.
  - 使用 `VueUse` 的 `useOnline` 监听网络状态变化，在线恢复时自动尝试同步，状态栏显示同步进度。

## Important Public Interfaces and Types

- `TotpEntry`: canonical client type for all TOTP items.
- `VaultDocument`: decrypted client-side vault payload, including `entries`, `sortOrder`, and `preferences`.
- `VaultPreferences`: user preferences stored within the encrypted vault.
- `EncryptedVaultSnapshot`: shared transport shape for D1 and local encrypted persistence.
- `CryptoContext`: 包含 `encryptionKey: CryptoKey` 和 `syncAuthSecret: Uint8Array` 的内存运行时对象，解锁后创建，锁定时销毁。
- `POST /api/bootstrap`, `GET /api/vault`, `PUT /api/vault`, `POST /api/vault/verify` as the v1 server endpoints.
- Cloudflare bindings:
  - `DB` for D1
  - standard Worker environment config for runtime secrets and optional app metadata

## Test Plan

### 核心加密与安全

- Setup flow creates a vault, stores only ciphertext remotely, and unlocks successfully on the same device.
- Unlock fails with the wrong master password and does not corrupt local state.
- 连续多次错误密码触发限速机制（5 次后等待 30 秒，10 次后等待 5 分钟）。
- D1 inspection confirms no plaintext secret, issuer, or account fields are stored unencrypted.
- 修改主密码后，旧密码无法解锁，新密码可以正常解锁，远程 vault 同步更新。

### TOTP 功能

- Creating, editing, and deleting TOTP entries updates the decrypted in-memory vault and persists an encrypted snapshot.
- Generated TOTP codes match known test vectors for default `SHA1/6 digits/30s` and at least one non-default configuration.
- Copy-to-clipboard works on mobile browsers supported by the app.
- 粘贴 `otpauth://totp/GitHub:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=GitHub` 自动解析出 issuer、accountName、secret 等字段。
- 搜索框输入关键词后即时过滤匹配的 TOTP 条目。

### 离线与同步

- App remains usable offline after first successful setup/unlock, including TOTP generation.
- Offline edits sync correctly after reconnect when `revision` still matches.
- Sync returns `409` on concurrent remote change and surfaces a user-visible conflict state with clear resolution options.
- PWA installability and shell caching work on mobile Chromium and Safari-class browsers to the extent supported by platform constraints.

### Session 与自动锁定

- 空闲超过设定时间后自动锁定，跳转至 unlock 页面。
- 切换标签页后锁定计时正确触发。
- 锁定后内存中无残留的加密密钥或明文数据（通过开发者工具检查）。

### 备份与导出

- 加密备份导出的 `.nekovault` 文件可在另一浏览器中成功导入恢复。
- 明文导出的 `otpauth://` URI 列表可被其他 TOTP 应用正确识别。

### 安全头

- 响应头包含完整的 CSP、HSTS、X-Frame-Options 等安全策略。
- API 端点拒绝未授权请求，返回 `401`。

## Assumptions and Defaults

- Single-user product for personal use only in v1.
- Master-password-only unlock; no separate account system, OAuth, or Cloudflare Access gate in v1.
- D1 is used in v1, but only for encrypted snapshot sync/storage.
- TOTP is the only managed secret type in v1.
- No QR camera scan in v1 (requires camera permission and additional library), but support `otpauth://` URI paste-to-import as a lightweight alternative.
- No automatic multi-device merge; conflict resolution is explicit and manual.
- The repo starts empty, so the initial implementation should scaffold the entire app from scratch around this architecture.
- Auto-lock defaults to 5 minutes; configurable through settings.
- Argon2id WASM implementation via `hash-wasm`; parameters may be auto-tuned based on device performance.
- v1 icon mapping is a static built-in table of common issuers (GitHub, Google, AWS, etc.); no custom icon upload.

## v2 Considerations (Out of Scope for v1)

- QR code camera scanning for TOTP secret import.
- Password entries and secure notes storage.
- Custom entry grouping and tagging.
- Per-item encryption for granular sync (replacing single-document model).
- WebAuthn/passkey unlock as an alternative to master password.
- Backup recovery via secret recovery key generated during setup.
- Multi-vault support (e.g., personal and work vaults).
- Browser extension for auto-fill TOTP codes on login pages.

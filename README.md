<div align="center">
  <img src="public/logo.svg" alt="NekoVault Logo" width="128" />
  <h1>NekoVault</h1>
  <p>🔐 一个基于 Cloudflare Workers 的个人 TOTP / 密码管理器</p>
  <p>
    <a href="README-en.md">English</a> · <strong>简体中文</strong>
  </p>
</div>

---

NekoVault 是一个面向个人使用的移动优先 Web App。它运行在 **Nuxt 4 + Cloudflare Workers + D1** 上，使用 **Worker 侧管理员密钥** 控制全局访问，并在浏览器本地通过 `IndexedDB` 缓存加密快照，兼顾跨设备同步和离线读取。

## 核心特性

### 访问控制简单直接
- 在 Worker 环境变量中配置一个 `ADMIN_TOKEN` 作为全局访问密钥。
- 客户端输入该密钥后即可读取、同步和管理 Vault。
- 未配置 `ADMIN_TOKEN` 时服务端会直接拒绝请求，不会默认放行。
- 解锁后保持解锁状态，直到手动点击「锁定」按钮或刷新/关闭页面；不做定时自动锁定，避免误踢。

### 适合个人自部署
- 服务端部署在 Cloudflare Workers，数据库使用 D1。
- D1 中保存的是单份 Vault JSON 文档，配合 `revision` 做乐观并发控制。
- 首次访问空实例时，输入正确访问密钥会自动初始化一个空 Vault。

### TOTP 验证码管理
- 支持 `otpauth://` 导入，显示倒计时圆环与验证码位数/周期/算法配置。
- 可将验证码与账号密码条目一键关联，快速查看「某账号对应的 2FA」。

### 账号密码管理
- 字段包含平台分类、账号、密码、备注、可选关联 TOTP。
- **可选会员/订阅到期提醒**：单个账号可以开启到期日期，卡片上会显示剩余天数彩色徽章（绿/橙/红），让会员续费一目了然。

### 本地缓存与离线访问
- 浏览器本地使用 `Dexie.js + IndexedDB` 保存加密快照。
- 已经同步过的数据，在离线时仍然可以继续解锁和查看。
- 重新联网后会自动尝试把待同步修改推回远端。

### PWA 支持
- 内置 `@vite-pwa/nuxt`，可安装到桌面或主屏幕。
- 适合在手机浏览器、Android WebView 和桌面端直接使用。

### 移动端与受限 WebView 适配
- 默认面向手机浏览器、Android WebView 和桌面浏览器使用。
- 图标与关键运行资源优先本地打包，尽量减少严格 CSP 环境下对外部资源的依赖。

---

## 技术栈

- **框架**：Nuxt 4 / Vue 3 / Nitro
- **UI**：Nuxt UI / Tailwind CSS
- **状态与工具**：Pinia / VueUse / Dexie
- **部署**：Cloudflare Workers + D1

---

## 部署

### 1. 安装依赖

```bash
pnpm install
```

### 2. 创建 D1 数据库

```bash
pnpm run d1:create
```

执行后记下输出中的 `database_id`。

### 3. 复制并配置 Wrangler

先把示例配置复制成正式配置：

```bash
cp wrangler.toml.example wrangler.toml
```

Windows PowerShell 可用：

```powershell
Copy-Item wrangler.toml.example wrangler.toml
```

然后编辑 `wrangler.toml`，至少填写这两项：

```toml
[[d1_databases]]
binding = "DB"
database_name = "nekovault-db"
database_id = "你的-database-id"

[vars]
ADMIN_TOKEN = "你自己的访问密钥"
```

项目默认不提交真实的 `wrangler.toml`，仓库内只保留 `wrangler.toml.example`。

### 4. 部署

```bash
pnpm run deploy
```

---

## 本地开发

### 普通 Nuxt 开发模式

```bash
pnpm run dev
```

如果你要在本地调用 `/api/*`，需要先给当前环境提供 `ADMIN_TOKEN`。例如 PowerShell：

```powershell
$env:ADMIN_TOKEN="your-local-dev-token"
pnpm run dev
```

### 使用 Wrangler 本地模拟 Worker

如果你希望更接近 Cloudflare 运行时，可以使用：

```bash
npx wrangler dev
```

同样需要确保 `wrangler.toml` 中已经配置好 `ADMIN_TOKEN` 和 D1 绑定。

---

## 数据说明

- 远端：D1 中保存一份当前 Vault 文档。
- 本地：浏览器会额外保存一份加密快照，用于离线解锁和恢复。
- 重置本地数据只会清空当前设备缓存，不会删除远端数据。

---

## License

MIT


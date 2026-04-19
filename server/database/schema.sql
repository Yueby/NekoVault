-- NekoVault D1 数据库 Schema
-- 单表设计，存储 Vault 明文 JSON（API 层由 ADMIN_TOKEN 保护）

CREATE TABLE IF NOT EXISTS vault (
  vault_id TEXT PRIMARY KEY DEFAULT 'default',
  data TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

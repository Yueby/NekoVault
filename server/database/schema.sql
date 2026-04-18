-- NekoVault D1 数据库 Schema
-- 单表设计，存储加密后的 Vault 快照

CREATE TABLE IF NOT EXISTS vault (
  vault_id TEXT PRIMARY KEY DEFAULT 'default',
  ciphertext TEXT NOT NULL,
  iv TEXT NOT NULL,
  salt TEXT NOT NULL,
  kdf_params TEXT NOT NULL,
  auth_token_hash TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

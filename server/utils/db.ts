/**
 * D1 数据库操作封装
 * 所有 SQL 使用参数化查询防止注入
 */
/// <reference types="@cloudflare/workers-types" />
import type { H3Event } from 'h3'

/** D1 中的 Vault 行记录 */
export interface VaultRow {
  vault_id: string
  ciphertext: string
  iv: string
  salt: string
  kdf_params: string
  auth_token_hash: string
  revision: number
  updated_at: string
}

/**
 * 获取 D1 数据库绑定
 */
export function getDB(event: H3Event): D1Database {
  const cf = (event.context as Record<string, Record<string, Record<string, unknown>>>).cloudflare
  if (!cf?.env?.DB) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      data: { error: 'config', message: 'D1 数据库未配置' }
    })
  }
  return cf.env.DB as D1Database
}

/**
 * 初始化数据库表（如果不存在）
 */
export async function ensureTable(db: D1Database): Promise<void> {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS vault (
      vault_id TEXT PRIMARY KEY DEFAULT 'default',
      ciphertext TEXT NOT NULL,
      iv TEXT NOT NULL,
      salt TEXT NOT NULL,
      kdf_params TEXT NOT NULL,
      auth_token_hash TEXT NOT NULL,
      revision INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run()
}

/**
 * 检查 vault 是否存在
 */
export async function vaultExists(db: D1Database): Promise<boolean> {
  const result = await db.prepare(
    'SELECT COUNT(*) as count FROM vault WHERE vault_id = ?'
  ).bind('default').first<{ count: number }>()
  return (result?.count ?? 0) > 0
}

/**
 * 创建初始 vault
 */
export async function createVault(
  db: D1Database,
  data: {
    ciphertext: string
    iv: string
    salt: string
    kdfParams: string
    authTokenHash: string
  }
): Promise<VaultRow> {
  const now = new Date().toISOString()
  await db.prepare(`
    INSERT INTO vault (vault_id, ciphertext, iv, salt, kdf_params, auth_token_hash, revision, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?)
  `).bind(
    'default',
    data.ciphertext,
    data.iv,
    data.salt,
    data.kdfParams,
    data.authTokenHash,
    now
  ).run()

  return {
    vault_id: 'default',
    ciphertext: data.ciphertext,
    iv: data.iv,
    salt: data.salt,
    kdf_params: data.kdfParams,
    auth_token_hash: data.authTokenHash,
    revision: 1,
    updated_at: now
  }
}

/**
 * 获取 vault（用于验证 auth token）
 */
export async function getVaultMeta(db: D1Database): Promise<{ auth_token_hash: string, revision: number } | null> {
  return db.prepare(
    'SELECT auth_token_hash, revision FROM vault WHERE vault_id = ?'
  ).bind('default').first<{ auth_token_hash: string, revision: number }>()
}

/**
 * 获取完整的 vault 快照
 */
export async function getVault(db: D1Database): Promise<VaultRow | null> {
  return db.prepare(
    'SELECT * FROM vault WHERE vault_id = ?'
  ).bind('default').first<VaultRow>()
}

/**
 * 更新 vault（带乐观并发控制）
 * @returns 更新后的 vault 行，如果 revision 不匹配则返回 null
 */
export async function updateVault(
  db: D1Database,
  data: {
    ciphertext: string
    iv: string
    salt: string
    kdfParams: string
    authTokenHash: string
    expectedRevision: number
  }
): Promise<VaultRow | null> {
  const now = new Date().toISOString()
  const newRevision = data.expectedRevision + 1

  const result = await db.prepare(`
    UPDATE vault
    SET ciphertext = ?, iv = ?, salt = ?, kdf_params = ?, auth_token_hash = ?, revision = ?, updated_at = ?
    WHERE vault_id = ? AND revision = ?
  `).bind(
    data.ciphertext,
    data.iv,
    data.salt,
    data.kdfParams,
    data.authTokenHash,
    newRevision,
    now,
    'default',
    data.expectedRevision
  ).run()

  if (!result.meta.changes || result.meta.changes === 0) {
    return null // revision 不匹配，发生冲突
  }

  return {
    vault_id: 'default',
    ciphertext: data.ciphertext,
    iv: data.iv,
    salt: data.salt,
    kdf_params: data.kdfParams,
    auth_token_hash: data.authTokenHash,
    revision: newRevision,
    updated_at: now
  }
}

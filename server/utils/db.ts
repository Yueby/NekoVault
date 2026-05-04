/**
 * D1 数据库操作封装
 * 所有 SQL 使用参数化查询防止注入
 *
 * 新架构：vault 数据以明文 JSON 存储，由 ADMIN_TOKEN 保护 API 访问
 */
/// <reference types="@cloudflare/workers-types" />
import type { H3Event } from 'h3'

/** D1 中的 Vault 行记录 */
export interface VaultRow {
  vault_id: string
  data: string
  revision: number
  updated_at: string
}

interface LocalDevDB {
  kind: 'local-dev-file'
  filePath: string
}

type VaultDB = D1Database | LocalDevDB

function isErrorWithCode(error: unknown, code: string): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && error.code === code
}

function isNoSuchTableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('no such table')
}

function isLocalDevDB(db: VaultDB): db is LocalDevDB {
  return (db as LocalDevDB).kind === 'local-dev-file'
}

function createLocalDevDB(): LocalDevDB {
  return {
    kind: 'local-dev-file',
    filePath: `${process.cwd().replace(/\\/g, '/')}/.data/nekovault-dev-vault.json`
  }
}

function getLocalDevDir(filePath: string): string {
  const index = filePath.lastIndexOf('/')
  return index === -1 ? '.' : filePath.slice(0, index)
}

async function readLocalDevVault(filePath: string): Promise<VaultRow | null> {
  const fs = await import('node:fs/promises')

  try {
    const raw = await fs.readFile(filePath, 'utf8')
    const parsed = JSON.parse(raw) as Partial<VaultRow>
    if (
      typeof parsed.vault_id !== 'string'
      || typeof parsed.data !== 'string'
      || typeof parsed.revision !== 'number'
      || typeof parsed.updated_at !== 'string'
    ) {
      return null
    }

    return parsed as VaultRow
  } catch (error: unknown) {
    if (isErrorWithCode(error, 'ENOENT')) {
      return null
    }
    throw error
  }
}

async function writeLocalDevVault(filePath: string, row: VaultRow): Promise<void> {
  const fs = await import('node:fs/promises')
  await fs.mkdir(getLocalDevDir(filePath), { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(row, null, 2), 'utf8')
}

/**
 * 获取 D1 数据库绑定
 */
export function getDB(event: H3Event): VaultDB {
  const cf = (
    event.context as Record<string, Record<string, Record<string, unknown>>>
  ).cloudflare

  if (cf?.env?.DB) {
    return cf.env.DB as D1Database
  }

  if (import.meta.dev || process.env.NODE_ENV === 'development') {
    return createLocalDevDB()
  }

  throw createError({
    statusCode: 500,
    statusMessage: 'Internal Server Error',
    data: { error: 'config', message: 'D1 数据库未配置' }
  })
}

/**
 * 初始化数据库表（如果不存在）
 */
export async function ensureTable(db: VaultDB): Promise<void> {
  if (isLocalDevDB(db)) {
    const fs = await import('node:fs/promises')
    await fs.mkdir(getLocalDevDir(db.filePath), { recursive: true })
    return
  }

  await db
    .prepare(
      `
    CREATE TABLE IF NOT EXISTS vault (
      vault_id TEXT PRIMARY KEY DEFAULT 'default',
      data TEXT NOT NULL,
      revision INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `
    )
    .run()
}

/**
 * 检查 vault 是否存在
 */
export async function vaultExists(db: VaultDB): Promise<boolean> {
  if (isLocalDevDB(db)) {
    return !!(await readLocalDevVault(db.filePath))
  }

  try {
    const result = await db
      .prepare('SELECT COUNT(*) as count FROM vault WHERE vault_id = ?')
      .bind('default')
      .first<{ count: number }>()
    return (result?.count ?? 0) > 0
  } catch (err: unknown) {
    if (isNoSuchTableError(err)) {
      await ensureTable(db)
      return false
    }
    throw err
  }
}

/**
 * 创建初始 vault
 */
export async function createVault(
  db: VaultDB,
  data: string
): Promise<VaultRow> {
  const now = new Date().toISOString()

  if (isLocalDevDB(db)) {
    const row: VaultRow = {
      vault_id: 'default',
      data,
      revision: 1,
      updated_at: now
    }
    await writeLocalDevVault(db.filePath, row)
    return row
  }

  await db
    .prepare(
      `
    INSERT INTO vault (vault_id, data, revision, updated_at)
    VALUES (?, ?, 1, ?)
  `
    )
    .bind('default', data, now)
    .run()

  return {
    vault_id: 'default',
    data,
    revision: 1,
    updated_at: now
  }
}

/**
 * 获取完整的 vault 数据
 */
export async function getVault(db: VaultDB): Promise<VaultRow | null> {
  if (isLocalDevDB(db)) {
    return readLocalDevVault(db.filePath)
  }

  try {
    return await db
      .prepare('SELECT * FROM vault WHERE vault_id = ?')
      .bind('default')
      .first<VaultRow>()
  } catch (err: unknown) {
    if (isNoSuchTableError(err)) {
      await ensureTable(db)
      return null
    }
    throw err
  }
}

/**
 * 更新 vault（带乐观并发控制）
 * @returns 更新后的 vault 行，如果 revision 不匹配则返回 null
 */
export async function updateVault(
  db: VaultDB,
  data: string,
  expectedRevision: number
): Promise<VaultRow | null> {
  const now = new Date().toISOString()
  const newRevision = expectedRevision + 1

  if (isLocalDevDB(db)) {
    const current = await readLocalDevVault(db.filePath)
    if (!current || current.revision !== expectedRevision) {
      return null
    }

    const updated: VaultRow = {
      vault_id: current.vault_id,
      data,
      revision: newRevision,
      updated_at: now
    }
    await writeLocalDevVault(db.filePath, updated)
    return updated
  }

  try {
    const result = await db
      .prepare(
        `
      UPDATE vault
      SET data = ?, revision = ?, updated_at = ?
      WHERE vault_id = ? AND revision = ?
    `
      )
      .bind(data, newRevision, now, 'default', expectedRevision)
      .run()

    if (!result.meta.changes || result.meta.changes === 0) {
      return null // revision 不匹配，发生冲突
    }
  } catch (err: unknown) {
    if (isNoSuchTableError(err)) {
      await ensureTable(db)
      return null
    }
    throw err
  }

  return {
    vault_id: 'default',
    data,
    revision: newRevision,
    updated_at: now
  }
}

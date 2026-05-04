/**
 * Vault 数据迁移管道
 *
 * 解密后、hydrate 前调用，按 schemaVersion 逐步升级数据结构。
 * 每个迁移函数负责一个版本跳跃，保证向下兼容。
 */
import type { VaultDocument } from '~/types/vault'

/** 当前最新 schema 版本 */
export const CURRENT_SCHEMA_VERSION = 3

function mergeOrder(savedOrder: string[] | undefined, ids: string[]): string[] {
  const validIds = new Set(ids)
  const seenIds = new Set<string>()
  const order: string[] = []

  for (const id of savedOrder ?? []) {
    if (validIds.has(id) && !seenIds.has(id)) {
      order.push(id)
      seenIds.add(id)
    }
  }

  for (const id of ids) {
    if (!seenIds.has(id)) {
      order.push(id)
      seenIds.add(id)
    }
  }

  return order
}

/**
 * 对解密后的 VaultDocument 执行必要的数据迁移
 *
 * @returns 迁移后的文档和是否发生了变更
 */
export function migrateVault(vault: VaultDocument): {
  vault: VaultDocument
  migrated: boolean
} {
  let migrated = false

  // v0 → v1：补齐缺失字段（兼容初期无 schemaVersion 的数据）
  if (!vault.schemaVersion || vault.schemaVersion < 1) {
    vault.schemaVersion = 1
    vault.passwords ??= []
    vault.sortOrder ??= vault.entries.map(e => e.id)
    vault.preferences ??= {
      sortMode: 'alpha',
      autoLockMinutes: 5,
      showCodesOnUnlock: true,
      totpViewMode: 'grid',
      passwordViewMode: 'grid'
    }
    migrated = true
  }

  // v1 → v2：为账号密码补齐独立的手动排序持久化字段
  if (vault.schemaVersion < 2) {
    vault.passwords ??= []
    vault.passwordSortOrder = mergeOrder(vault.passwordSortOrder, vault.passwords.map(p => p.id))
    vault.schemaVersion = 2
    migrated = true
  }

  // v2 → v3：持久化 TOTP / 账号密码的布局模式偏好
  if (vault.schemaVersion < 3) {
    vault.preferences.totpViewMode ??= 'grid'
    vault.preferences.passwordViewMode ??= 'grid'
    vault.schemaVersion = 3
    migrated = true
  }

  // 未来迁移示例：
  // if (vault.schemaVersion === 1) {
  //   vault.entries.forEach(e => { e.tags ??= [] })
  //   vault.schemaVersion = 2
  //   migrated = true
  // }

  return { vault, migrated }
}

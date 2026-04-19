/**
 * Vault 数据迁移管道
 *
 * 解密后、hydrate 前调用，按 schemaVersion 逐步升级数据结构。
 * 每个迁移函数负责一个版本跳跃，保证向下兼容。
 */
import type { VaultDocument } from '~/types/vault'

/** 当前最新 schema 版本 */
export const CURRENT_SCHEMA_VERSION = 1

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
      showCodesOnUnlock: true
    }
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

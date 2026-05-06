/**
 * Vault 数据迁移管道
 *
 * 解密后、hydrate 前调用，按 schemaVersion 逐步升级数据结构。
 * 每个迁移函数负责一个版本跳跃，保证向下兼容。
 */
import type { PasswordSecret, VaultDocument } from '~/types/vault'
import { DEFAULT_SECRET_ID, DEFAULT_SECRET_NAME } from '~/utils/password-secrets'

/** 当前最新 schema 版本 */
export const CURRENT_SCHEMA_VERSION = 4

const LEGACY_PASSWORD_SECRET_ID = 'legacy-password'
const LEGACY_PASSWORD_SECRET_NAME = '旧密码'

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

function normalizeLegacySecret(secret: unknown, index: number): PasswordSecret | null {
  if (!secret || typeof secret !== 'object') return null

  const raw = secret as Partial<PasswordSecret>
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : `legacy-${index}`,
    name: typeof raw.name === 'string' && raw.name ? raw.name : `密钥 ${index + 1}`,
    value: typeof raw.value === 'string' ? raw.value : ''
  }
}

function makeUniqueSecretId(baseId: string, secrets: PasswordSecret[]): string {
  const ids = new Set(secrets.map(secret => secret.id))
  if (!ids.has(baseId)) return baseId

  let suffix = 1
  while (ids.has(`${baseId}-${suffix}`)) {
    suffix += 1
  }
  return `${baseId}-${suffix}`
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

  // v1 → v2：为账号密钥补齐独立的手动排序持久化字段
  if (vault.schemaVersion < 2) {
    vault.passwords ??= []
    vault.passwordSortOrder = mergeOrder(vault.passwordSortOrder, vault.passwords.map(p => p.id))
    vault.schemaVersion = 2
    migrated = true
  }

  // v2 → v3：持久化 TOTP / 账号密钥的布局模式偏好
  if (vault.schemaVersion < 3) {
    vault.preferences.totpViewMode ??= 'grid'
    vault.preferences.passwordViewMode ??= 'grid'
    vault.schemaVersion = 3
    migrated = true
  }

  // v3 → v4：为账号补齐 secrets 数组（多密钥支持），移除旧 password 字段
  if (vault.schemaVersion < 4) {
    vault.passwords ??= []
    for (const pw of vault.passwords) {
      // 读取旧 password 字段（v3 数据），类型断言处理遗留属性
      const legacyPassword = 'password' in pw ? (pw as Record<string, unknown>).password : ''
      const legacyPasswordStr = typeof legacyPassword === 'string' ? legacyPassword : ''

      const existingSecrets = Array.isArray(pw.secrets)
        ? pw.secrets
            .map((secret, index) => normalizeLegacySecret(secret, index))
            .filter((secret): secret is PasswordSecret => !!secret)
        : []

      const defaultIndex = existingSecrets.findIndex(secret =>
        secret.id === DEFAULT_SECRET_ID || secret.name === DEFAULT_SECRET_NAME
      )
      const existingDefault = defaultIndex >= 0 ? existingSecrets[defaultIndex] : undefined
      const defaultValue = existingDefault?.value || legacyPasswordStr
      const nonDefaultSecrets = existingSecrets.filter((_, index) => index !== defaultIndex)

      if (
        legacyPasswordStr
        && legacyPasswordStr !== defaultValue
        && !nonDefaultSecrets.some(secret => secret.value === legacyPasswordStr)
      ) {
        nonDefaultSecrets.push({
          id: makeUniqueSecretId(LEGACY_PASSWORD_SECRET_ID, existingSecrets),
          name: LEGACY_PASSWORD_SECRET_NAME,
          value: legacyPasswordStr
        })
      }

      // 删除旧 password 字段
      if ('password' in pw) {
        delete (pw as Record<string, unknown>).password
      }

      pw.secrets = [
        { id: DEFAULT_SECRET_ID, name: DEFAULT_SECRET_NAME, value: defaultValue },
        ...nonDefaultSecrets
      ]
    }
    vault.schemaVersion = 4
    migrated = true
  }

  return { vault, migrated }
}

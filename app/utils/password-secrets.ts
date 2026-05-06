/**
 * 密钥工具
 *
 * 为 PasswordEntry 提供多密钥支持：
 * - secrets 数组存储多个密钥
 * - 默认密钥 id/name 固定为 'default'/'默认'
 * - 运行时只依赖 secrets，不再使用 password 字段
 */
import type { PasswordEntry, PasswordSecret } from '~/types/vault'
import { generateId } from '~/utils/crypto'

/** 默认密钥 ID */
export const DEFAULT_SECRET_ID = 'default'

/** 默认密钥名称 */
export const DEFAULT_SECRET_NAME = '默认'

/**
 * 从 entry 的 secrets 字段解析出完整密钥列表
 *
 * 策略：
 * 1. 确保默认密钥始终存在
 * 2. 每项都有合法 name/value
 * 3. 输入脏数据也保留已有非默认 secrets
 */
export function getPasswordSecrets(entry: Pick<PasswordEntry, 'secrets'>): PasswordSecret[] {
  const secrets = entry.secrets

  // 无 secrets 或空数组 → 构建唯一默认密钥
  if (!secrets || secrets.length === 0) {
    return [{ id: DEFAULT_SECRET_ID, name: DEFAULT_SECRET_NAME, value: '' }]
  }

  // 确保默认项存在
  const hasDefault = secrets.some(s => s.id === DEFAULT_SECRET_ID)
  if (hasDefault) {
    return secrets.map(s =>
      s.id === DEFAULT_SECRET_ID
        ? { ...s, name: DEFAULT_SECRET_NAME, value: s.value ?? '' }
        : { ...s, name: s.name || '未命名', value: s.value ?? '' }
    )
  }

  // 无默认项：在头部插入默认项
  return [
    { id: DEFAULT_SECRET_ID, name: DEFAULT_SECRET_NAME, value: '' },
    ...secrets.map(s => ({ ...s, name: s.name || '未命名', value: s.value ?? '' }))
  ]
}

/**
 * 规范化 entry 的 secrets，确保数据完整性
 *
 * 用于保存前调用，保证：
 * - 默认密钥存在
 * - 每项都有 id（缺失时生成）
 * - 每项都有合法 name/value
 */
export function normalizePasswordEntrySecrets(entry: Pick<PasswordEntry, 'secrets'>): PasswordSecret[] {
  const secrets = entry.secrets

  if (!secrets || secrets.length === 0) {
    return [{ id: DEFAULT_SECRET_ID, name: DEFAULT_SECRET_NAME, value: '' }]
  }

  const result: PasswordSecret[] = []

  // 确保默认项存在且在首位
  const defaultItem = secrets.find(s => s.id === DEFAULT_SECRET_ID)
  if (defaultItem) {
    result.push({
      id: DEFAULT_SECRET_ID,
      name: DEFAULT_SECRET_NAME,
      value: defaultItem.value ?? ''
    })
  } else {
    result.push({
      id: DEFAULT_SECRET_ID,
      name: DEFAULT_SECRET_NAME,
      value: ''
    })
  }

  // 保留非默认项，缺失 id 时生成
  for (const s of secrets) {
    if (s.id === DEFAULT_SECRET_ID) continue
    result.push({
      id: s.id || generateId(),
      name: s.name || '未命名',
      value: s.value ?? ''
    })
  }

  return result
}

/**
 * 获取默认密钥的 value
 */
export function getDefaultPasswordValue(entry: Pick<PasswordEntry, 'secrets'>): string {
  const secrets = getPasswordSecrets(entry)
  const defaultItem = secrets.find(s => s.id === DEFAULT_SECRET_ID)
  return defaultItem?.value ?? ''
}

/**
 * 创建一个新的密钥对象
 */
export function makePasswordSecret(name: string, value: string): PasswordSecret {
  return {
    id: generateId(),
    name,
    value
  }
}

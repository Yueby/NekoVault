/**
 * NekoVault 核心类型定义
 * 涵盖 Vault 文档、TOTP 条目、密码条目等所有核心数据结构
 */

// ============================================================
// TOTP 条目
// ============================================================

/** TOTP 哈希算法类型 */
export type TotpAlgorithm = 'SHA1' | 'SHA256' | 'SHA512'

/** 排序模式 */
export type SortMode = 'alpha' | 'recent' | 'manual'

/** 单个 TOTP 条目 */
export interface TotpEntry {
  /** 唯一标识符（UUID v4） */
  id: string
  /** 显示标签 */
  label: string
  /** 发行方（如 GitHub、Google） */
  issuer: string
  /** 账户名 */
  accountName: string
  /** Base32 编码的密钥 */
  secret: string
  /** 验证码位数，默认 6 */
  digits: number
  /** 刷新周期（秒），默认 30 */
  period: number
  /** 哈希算法，默认 SHA1 */
  algorithm: TotpAlgorithm
  /** 可选，issuer 对应的图标标识符 */
  icon?: string
  /** 可选，最后一次使用的时间戳 */
  lastUsedAt?: number
  /** 创建时间戳 */
  createdAt: number
  /** 更新时间戳 */
  updatedAt: number
}

// ============================================================
// 账号密码条目
// ============================================================

/** 单个账号密码条目 */
export interface PasswordEntry {
  /** 唯一标识符（UUID v4） */
  id: string
  /** 服务名称（如 GitHub、Google） */
  serviceName: string
  /** 登录账号 */
  username: string
  /** 密码（明文存储在 Vault 内） */
  password: string
  /** 备注（可选） */
  notes?: string
  /** 关联的 TOTP 条目 ID（可选） */
  linkedTotpId?: string
  /** 可选，最后一次使用的时间戳 */
  lastUsedAt?: number
  /** 创建时间戳 */
  createdAt: number
  /** 更新时间戳 */
  updatedAt: number
}

// ============================================================
// Vault 文档（解密后的明文结构）
// ============================================================

/** 用户偏好设置 */
export interface VaultPreferences {
  /** 排序方式，默认 'alpha' */
  sortMode: SortMode
  /** 自动锁定时间（分钟），默认 5，0 表示从不 */
  autoLockMinutes: number
  /** 解锁后是否直接显示验证码，默认 true */
  showCodesOnUnlock: boolean
}

/** Vault 文档 */
export interface VaultDocument {
  /** Schema 版本号 */
  schemaVersion: number
  /** TOTP 条目数组 */
  entries: TotpEntry[]
  /** 账号密码条目数组 */
  passwords: PasswordEntry[]
  /** 条目 ID 的有序数组，记录用户自定义排序 */
  sortOrder: string[]
  /** 用户偏好设置 */
  preferences: VaultPreferences
  /** 最后更新时间戳 */
  updatedAt: number
}

// ============================================================
// 本地离线缓存加密
// ============================================================

/** 本地缓存的加密负载 */
export interface LocalEncryptedCache {
  /** Base64 编码的密文 */
  ciphertext: string
  /** Base64 编码的初始化向量 */
  iv: string
  /** Base64 编码的盐值（用于从密码派生加密密钥） */
  salt: string
}

// ============================================================
// 同步相关
// ============================================================

/** 同步状态 */
export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'conflict' | 'offline' | 'error'

/** 待同步的写入意图 */
export interface PendingSyncIntent {
  /** vault 明文 JSON 字符串 */
  data: string
  /** 当前 revision */
  revision: number
  /** 创建时间戳 */
  createdAt: number
}

// ============================================================
// API 请求/响应
// ============================================================

/** GET /api/vault 响应体 */
export interface VaultResponse {
  data: string
  revision: number
  updatedAt: string
}

/** 通用 API 错误响应 */
export interface ApiErrorResponse {
  error: string
  message: string
}

// ============================================================
// 本地存储
// ============================================================

/** IndexedDB 中存储的本地快照记录 */
export interface LocalSnapshot {
  /** 固定为 'default'，单 vault */
  id: string
  /** 加密的本地缓存 */
  encrypted: LocalEncryptedCache
  /** 远程 revision */
  revision: number
  /** 本地存储时间戳 */
  savedAt: number
}

/** 密码错误限速状态 */
export interface LockoutState {
  /** 固定为 'default' */
  id: string
  /** 连续失败次数 */
  failedAttempts: number
  /** 锁定到期时间戳（0 表示未锁定） */
  lockoutUntil: number
}

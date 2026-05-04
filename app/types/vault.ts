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

/** 列表布局模式 */
export type VaultViewMode = 'grid' | 'grouped'

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
  /** 会员/订阅到期时间戳（毫秒，可选）。用于显示剩余时间 */
  membershipExpiresAt?: number
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
  /** TOTP 列表布局方式 */
  totpViewMode: VaultViewMode
  /** 账号密码列表布局方式 */
  passwordViewMode: VaultViewMode
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
  /** 账号密码 ID 的有序数组，记录用户自定义排序 */
  passwordSortOrder: string[]
  /** 用户偏好设置 */
  preferences: VaultPreferences
  /** 最后更新时间戳 */
  updatedAt: number
}

// ============================================================
// 同步相关
// ============================================================

/** 同步状态 */
export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'conflict' | 'error'

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

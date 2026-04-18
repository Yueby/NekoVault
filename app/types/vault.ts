/**
 * NekoVault 核心类型定义
 * 涵盖 Vault 文档、TOTP 条目、加密上下文等所有核心数据结构
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
  /** 密码（明文存储在加密 Vault 内） */
  password: string
  /** 备注（可选） */
  notes?: string
  /** 关联的 TOTP 条目 ID（可选） */
  linkedTotpId?: string
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

/** 解密后的 Vault 文档 */
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
// 加密相关
// ============================================================

/** Argon2id 密钥派生参数 */
export interface KdfParams {
  /** 内存消耗（KB），默认 32768 (32MB) */
  memory: number
  /** 迭代次数，默认 3 */
  iterations: number
  /** 并行度，默认 1 */
  parallelism: number
}

/** 加密后的 Vault 快照（传输/存储结构） */
export interface EncryptedVaultSnapshot {
  /** Vault 标识符 */
  vaultId: string
  /** Base64 编码的密文 */
  ciphertext: string
  /** Base64 编码的初始化向量 */
  iv: string
  /** Base64 编码的盐值 */
  salt: string
  /** JSON 字符串，包含 KdfParams */
  kdfParams: string
  /** SHA-256(syncAuthSecret) 的十六进制字符串 */
  authTokenHash: string
  /** 文档版本号（乐观并发控制） */
  revision: number
  /** 最后更新时间（ISO 字符串） */
  updatedAt: string
}

/** 内存中的加密上下文，解锁后创建，锁定时销毁 */
export interface CryptoContext {
  /** AES-256-GCM 加密密钥 */
  encryptionKey: CryptoKey
  /** 同步认证密钥（32字节） */
  syncAuthSecret: Uint8Array
}

/** 加密后的负载数据 */
export interface EncryptedPayload {
  /** Base64 编码的密文 */
  ciphertext: string
  /** Base64 编码的初始化向量 */
  iv: string
}

// ============================================================
// 同步相关
// ============================================================

/** 同步状态 */
export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'conflict' | 'offline' | 'error'

/** 待同步的写入意图 */
export interface PendingSyncIntent {
  /** 本地加密快照 */
  snapshot: EncryptedVaultSnapshot
  /** 创建时间戳 */
  createdAt: number
}

// ============================================================
// API 请求/响应
// ============================================================

/** POST /api/bootstrap 请求体 */
export interface BootstrapRequest {
  ciphertext: string
  iv: string
  salt: string
  kdfParams: string
  authTokenHash: string
}

/** GET /api/vault 响应体 */
export interface VaultResponse {
  ciphertext: string
  iv: string
  salt: string
  kdfParams: string
  revision: number
  updatedAt: string
}

/** PUT /api/vault 请求体 */
export interface VaultUpdateRequest {
  ciphertext: string
  iv: string
  salt: string
  kdfParams: string
  authTokenHash: string
  revision: number
}

/** 通用 API 错误响应 */
export interface ApiErrorResponse {
  error: string
  message: string
}

// ============================================================
// 本地存储
// ============================================================

/** IndexedDB 中存储的加密快照记录 */
export interface LocalEncryptedSnapshot {
  /** 固定为 'default'，单 vault */
  id: string
  /** 加密快照数据 */
  snapshot: EncryptedVaultSnapshot
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

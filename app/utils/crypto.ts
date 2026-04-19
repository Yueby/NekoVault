/**
 * 核心加密工具
 *
 * 安全模型：
 * - Argon2id 从主密码 + salt 派生 64 字节
 * - 前 32 字节 → AES-256-GCM encryptionKey
 * - 后 32 字节 → syncAuthSecret（SHA-256 后存服务端验证）
 * - 每次加密使用随机 IV
 * - 密钥仅存内存，绝不持久化
 */
import { argon2id } from 'hash-wasm'
import type {
  CryptoContext,
  EncryptedPayload,
  KdfParams,
  VaultDocument
} from '~/types/vault'

// ============================================================
// 默认 KDF 参数
// ============================================================

/** 默认 Argon2id 参数：32MB 内存起步，移动端友好 */
export const DEFAULT_KDF_PARAMS: KdfParams = {
  memory: 32768, // 32MB (KB)
  iterations: 3,
  parallelism: 1
}

// ============================================================
// 辅助函数
// ============================================================

/** Uint8Array 转 Base64 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  const binary = Array.from(bytes, b => String.fromCharCode(b)).join('')
  return btoa(binary)
}

/** Base64 转 Uint8Array */
export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/** 生成指定长度的随机字节 */
export function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length))
}

/** 生成 32 字节随机盐值 */
export function generateSalt(): Uint8Array {
  return randomBytes(32)
}

/** 生成 UUID v4 */
export function generateId(): string {
  return crypto.randomUUID()
}

// ============================================================
// 密钥派生
// ============================================================

/**
 * 使用 Argon2id 从主密码和盐值派生加密上下文
 *
 * @param password 主密码
 * @param salt 32 字节盐值
 * @param params KDF 参数
 * @returns CryptoContext，包含 encryptionKey 和 syncAuthSecret
 */
export async function deriveKeys(
  password: string,
  salt: Uint8Array,
  params: KdfParams = DEFAULT_KDF_PARAMS
): Promise<CryptoContext> {
  // Argon2id 派生 64 字节
  const derivedHex = await argon2id({
    password,
    salt,
    parallelism: params.parallelism,
    iterations: params.iterations,
    memorySize: params.memory,
    hashLength: 64,
    outputType: 'hex'
  })

  // 将十六进制字符串转为 Uint8Array
  const derived = new Uint8Array(64)
  for (let i = 0; i < 64; i++) {
    derived[i] = parseInt(derivedHex.slice(i * 2, i * 2 + 2), 16)
  }

  // 前 32 字节 → AES-256-GCM 加密密钥
  const encryptionKeyBytes = derived.slice(0, 32)
  const encryptionKey = await crypto.subtle.importKey(
    'raw',
    encryptionKeyBytes,
    { name: 'AES-GCM' },
    false, // 不可导出
    ['encrypt', 'decrypt']
  )

  // 后 32 字节 → 同步认证密钥
  const syncAuthSecret = derived.slice(32, 64)

  return { encryptionKey, syncAuthSecret }
}

// ============================================================
// 加密 / 解密
// ============================================================

/**
 * 使用 AES-256-GCM 加密 Vault 文档
 * 每次加密生成新的随机 IV
 */
export async function encrypt(
  data: VaultDocument,
  key: CryptoKey
): Promise<EncryptedPayload> {
  const iv = randomBytes(12) // AES-GCM 推荐 12 字节 IV
  const plaintext = new TextEncoder().encode(JSON.stringify(data))

  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    key,
    plaintext.buffer as ArrayBuffer
  )

  return {
    ciphertext: uint8ArrayToBase64(new Uint8Array(ciphertextBuffer)),
    iv: uint8ArrayToBase64(iv)
  }
}

/**
 * 使用 AES-256-GCM 解密为 Vault 文档
 */
export async function decrypt(
  payload: EncryptedPayload,
  key: CryptoKey
): Promise<VaultDocument> {
  const iv = base64ToUint8Array(payload.iv)
  const ciphertext = base64ToUint8Array(payload.ciphertext)

  const plaintextBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    key,
    ciphertext.buffer as ArrayBuffer
  )

  const json = new TextDecoder().decode(plaintextBuffer)
  return JSON.parse(json) as VaultDocument
}

// ============================================================
// 哈希
// ============================================================

/**
 * 计算 syncAuthSecret 的 SHA-256 哈希（十六进制）
 * 服务端仅存储此哈希值，用于请求验证
 */
export async function hashSyncAuthSecret(secret: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', secret.buffer as ArrayBuffer)
  const hashArray = new Uint8Array(hashBuffer)
  return Array.from(hashArray, b => b.toString(16).padStart(2, '0')).join('')
}

// ============================================================
// 性能基准测试
// ============================================================

/**
 * 在当前设备上测试 Argon2id 性能
 * 如果默认参数耗时超过目标值，自动降级内存参数
 *
 * @param targetMs 目标耗时上限（毫秒），默认 3000
 * @returns 适合当前设备的 KDF 参数
 */
export async function benchmarkArgon2(targetMs: number = 3000): Promise<KdfParams> {
  const testSalt = randomBytes(32)
  const testPassword = 'benchmark-test-password'

  // 先用默认参数测试
  const start = performance.now()
  await argon2id({
    password: testPassword,
    salt: testSalt,
    parallelism: DEFAULT_KDF_PARAMS.parallelism,
    iterations: DEFAULT_KDF_PARAMS.iterations,
    memorySize: DEFAULT_KDF_PARAMS.memory,
    hashLength: 64,
    outputType: 'hex'
  })
  const elapsed = performance.now() - start

  if (elapsed <= targetMs) {
    return { ...DEFAULT_KDF_PARAMS }
  }

  // 默认参数太慢，降级到 16MB
  console.warn(`Argon2id 基准测试：${elapsed.toFixed(0)}ms 超过 ${targetMs}ms 目标，降级内存至 16MB`)
  return {
    memory: 16384, // 16MB
    iterations: 3,
    parallelism: 1
  }
}

// ============================================================
// 密码强度评估
// ============================================================

export type PasswordStrength = 'weak' | 'medium' | 'strong' | 'very-strong'

/**
 * 评估密码强度
 * @returns 强度等级和分数
 */
export function evaluatePasswordStrength(password: string): {
  strength: PasswordStrength
  score: number
} {
  let score = 0

  if (password.length >= 12) score += 1
  if (password.length >= 16) score += 1
  if (password.length >= 20) score += 1
  if (/[a-z]/.test(password)) score += 1
  if (/[A-Z]/.test(password)) score += 1
  if (/[0-9]/.test(password)) score += 1
  if (/[^a-zA-Z0-9]/.test(password)) score += 1
  // 检查是否有重复字符模式
  if (!/(.)\1{2,}/.test(password)) score += 1

  let strength: PasswordStrength
  if (score <= 3) strength = 'weak'
  else if (score <= 5) strength = 'medium'
  else if (score <= 7) strength = 'strong'
  else strength = 'very-strong'

  return { strength, score }
}

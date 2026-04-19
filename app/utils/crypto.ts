/**
 * 加密工具（简化版）
 *
 * 新架构：
 * - 服务端数据由 ADMIN_TOKEN 保护，存明文 JSON
 * - 本地 IndexedDB 缓存使用 AES-256-GCM 加密（密码派生密钥）
 * - 密码变更时自动用新密码重新加密本地缓存
 */

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

/** 生成 UUID v4 */
export function generateId(): string {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = crypto.getRandomValues(new Uint8Array(1))[0]! % 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

// ============================================================
// 密钥派生（简化版：PBKDF2）
// ============================================================

/**
 * 使用 PBKDF2 从密码和盐值派生 AES-256 密钥
 * 用于本地 IndexedDB 离线缓存加密
 */
async function deriveLocalKey(
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: 100_000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

// ============================================================
// 本地缓存加密 / 解密
// ============================================================

/** 加密后的本地缓存负载 */
interface LocalEncryptedPayload {
  ciphertext: string
  iv: string
  salt: string
}

/**
 * 使用密码加密数据（用于本地 IndexedDB 离线缓存）
 * 每次加密生成新的随机 salt 和 IV
 */
export async function encryptLocal(
  data: string,
  password: string
): Promise<LocalEncryptedPayload> {
  const salt = randomBytes(32)
  const iv = randomBytes(12) // AES-GCM 推荐 12 字节 IV
  const key = await deriveLocalKey(password, salt)

  const plaintext = new TextEncoder().encode(data)
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    key,
    plaintext.buffer as ArrayBuffer
  )

  return {
    ciphertext: uint8ArrayToBase64(new Uint8Array(ciphertextBuffer)),
    iv: uint8ArrayToBase64(iv),
    salt: uint8ArrayToBase64(salt)
  }
}

/**
 * 使用密码解密本地缓存数据
 */
export async function decryptLocal(
  payload: LocalEncryptedPayload,
  password: string
): Promise<string> {
  const salt = base64ToUint8Array(payload.salt)
  const iv = base64ToUint8Array(payload.iv)
  const ciphertext = base64ToUint8Array(payload.ciphertext)
  const key = await deriveLocalKey(password, salt)

  const plaintextBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    key,
    ciphertext.buffer as ArrayBuffer
  )

  return new TextDecoder().decode(plaintextBuffer)
}

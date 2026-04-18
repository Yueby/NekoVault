/**
 * Zod Schema 定义
 * 用于 API 请求体校验，客户端和服务端共享
 */
import { z } from 'zod'

// ============================================================
// 基础校验
// ============================================================

/** Base64 字符串校验 */
const base64String = z.string().min(1).regex(/^[A-Za-z0-9+/]+=*$/, '无效的 Base64 格式')

/** SHA-256 十六进制哈希校验（64字符） */
const sha256Hex = z.string().length(64).regex(/^[a-f0-9]{64}$/, '无效的 SHA-256 哈希')

/** KDF 参数 JSON 字符串校验 */
const kdfParamsString = z.string().refine((val) => {
  try {
    const parsed = JSON.parse(val) as Record<string, unknown>
    return (
      typeof parsed.memory === 'number'
      && typeof parsed.iterations === 'number'
      && typeof parsed.parallelism === 'number'
      && parsed.memory > 0
      && parsed.iterations > 0
      && parsed.parallelism > 0
    )
  } catch {
    return false
  }
}, '无效的 KDF 参数格式')

// ============================================================
// API 请求 Schema
// ============================================================

/** POST /api/bootstrap 请求体 Schema */
export const bootstrapRequestSchema = z.object({
  ciphertext: base64String,
  iv: base64String,
  salt: base64String,
  kdfParams: kdfParamsString,
  authTokenHash: sha256Hex
}).strict()

/** PUT /api/vault 请求体 Schema */
export const vaultUpdateRequestSchema = z.object({
  ciphertext: base64String,
  iv: base64String,
  salt: base64String,
  kdfParams: kdfParamsString,
  authTokenHash: sha256Hex,
  revision: z.number().int().positive()
}).strict()

/** POST /api/vault/verify 请求体 Schema */
export const vaultVerifyRequestSchema = z.object({
  authTokenHash: sha256Hex
}).strict()

// ============================================================
// TOTP 条目校验
// ============================================================

/** Base32 字符串校验（TOTP secret） */
const base32Secret = z.string()
  .min(1)
  .transform(val => val.replace(/\s/g, '').toUpperCase())
  .pipe(z.string().regex(/^[A-Z2-7]+=*$/, '无效的 Base32 密钥'))

/** TOTP 算法类型 */
const totpAlgorithm = z.enum(['SHA1', 'SHA256', 'SHA512'])

/** 新建/编辑 TOTP 条目的输入校验 */
export const totpEntryInputSchema = z.object({
  label: z.string().min(1).max(100),
  issuer: z.string().max(100).default(''),
  accountName: z.string().max(200).default(''),
  secret: base32Secret,
  digits: z.number().int().min(6).max(8).default(6),
  period: z.number().int().min(10).max(120).default(30),
  algorithm: totpAlgorithm.default('SHA1')
}).strict()

/** 主密码强度校验（≥12字符，大小写+数字） */
export const masterPasswordSchema = z.string()
  .min(12, '主密码至少需要 12 个字符')
  .regex(/[a-z]/, '需要包含小写字母')
  .regex(/[A-Z]/, '需要包含大写字母')
  .regex(/[0-9]/, '需要包含数字')

// ============================================================
// otpauth URI 解析校验
// ============================================================

/** otpauth:// URI 格式校验 */
export const otpauthUriSchema = z.string()
  .startsWith('otpauth://totp/', '仅支持 otpauth://totp/ 格式')

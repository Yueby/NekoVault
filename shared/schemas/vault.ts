/**
 * Zod Schema 定义
 * 用于 API 请求体校验，客户端和服务端共享
 */
import { z } from 'zod'

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

// ============================================================
// otpauth URI 解析校验
// ============================================================

/** otpauth:// URI 格式校验 */
export const otpauthUriSchema = z.string()
  .startsWith('otpauth://totp/', '仅支持 otpauth://totp/ 格式')

/**
 * API 鉴权工具
 *
 * 验证请求中的 Authorization header
 * 格式: Bearer <SHA256(syncAuthSecret)>
 */
import type { H3Event } from 'h3'

/**
 * 验证 API 请求的 sync-auth 凭证
 */
export async function verifyAuth(event: H3Event): Promise<boolean> {
  const authHeader = getHeader(event, 'authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      data: { error: 'unauthorized', message: '缺少 Authorization 头' }
    })
  }

  const providedHash = authHeader.slice(7) // 去掉 "Bearer " 前缀

  // 验证格式：应为 64 字符的十六进制 SHA-256 哈希
  if (!/^[a-f0-9]{64}$/.test(providedHash)) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      data: { error: 'unauthorized', message: '无效的凭证格式' }
    })
  }

  const db = getDB(event)
  await ensureTable(db)

  const meta = await getVaultMeta(db)
  if (!meta) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      data: { error: 'not_found', message: 'Vault 不存在' }
    })
  }

  // 使用恒定时间比较防止时序攻击
  if (!timingSafeEqual(providedHash, meta.auth_token_hash)) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      data: { error: 'unauthorized', message: '凭证验证失败' }
    })
  }

  return true
}

/**
 * 恒定时间字符串比较（防时序攻击）
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

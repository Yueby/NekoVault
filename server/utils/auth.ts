/**
 * API 鉴权工具
 *
 * 仅通过 ADMIN_TOKEN 环境变量进行全局访问控制
 * 客户端通过 x-admin-token 请求头传递密码
 */
import type { H3Event } from 'h3'

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false

  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }

  return diff === 0
}

/**
 * 验证服务器级全局访问令牌 (Admin Token)
 * 从 Cloudflare Worker 环境变量 ADMIN_TOKEN 读取，未配置则拒绝服务
 */
export async function verifyAdminToken(event: H3Event): Promise<boolean> {
  // 直接从 Cloudflare Worker 的 env 绑定读取，本地开发回退到 process.env
  const env = (event.context.cloudflare?.env ?? {}) as Record<string, string | undefined>
  const expectedToken = env.ADMIN_TOKEN || process.env.ADMIN_TOKEN

  if (!expectedToken) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      data: {
        error: 'config',
        message: '服务端未配置 ADMIN_TOKEN'
      }
    })
  }

  const providedToken = getHeader(event, 'x-admin-token')
  if (!providedToken || !timingSafeEqual(providedToken, expectedToken)) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      data: { error: 'unauthorized', message: '访问密钥错误' }
    })
  }
  return true
}

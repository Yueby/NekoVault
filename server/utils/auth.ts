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

function isErrorWithCode(error: unknown, code: string): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && error.code === code
}

function readTomlStringValue(section: string, key: string): string | undefined {
  const match = section.match(new RegExp(`^\\s*${key}\\s*=\\s*(.+?)\\s*$`, 'm'))
  const rawValue = match?.[1]?.trim()
  if (!rawValue) return undefined

  const quoted = rawValue.match(/^(['"])(.*)\1(?:\s*#.*)?$/)
  if (quoted?.[2]) return quoted[2]

  return rawValue.split('#')[0]?.trim() || undefined
}

async function readLocalWranglerAdminToken(): Promise<string | undefined> {
  if (!import.meta.dev && process.env.NODE_ENV !== 'development') return undefined

  const fs = await import('node:fs/promises')

  try {
    const source = await fs.readFile('wrangler.toml', 'utf8')
    const lines = source.split(/\r?\n/)
    const varsLines: string[] = []
    let inVarsSection = false

    for (const line of lines) {
      const trimmed = line.trim()
      if (/^\[.*\]$/.test(trimmed)) {
        if (inVarsSection) break
        inVarsSection = trimmed === '[vars]'
        continue
      }

      if (inVarsSection) {
        varsLines.push(line)
      }
    }

    return readTomlStringValue(varsLines.join('\n'), 'ADMIN_TOKEN')
  } catch (error: unknown) {
    if (isErrorWithCode(error, 'ENOENT')) return undefined
    throw error
  }
}

/**
 * 验证服务器级全局访问令牌 (Admin Token)
 * 从 Cloudflare Worker 环境变量 ADMIN_TOKEN 读取，未配置则拒绝服务
 */
export async function verifyAdminToken(event: H3Event): Promise<boolean> {
  // 直接从 Cloudflare Worker 的 env 绑定读取，本地开发回退到 process.env
  const env = (event.context.cloudflare?.env ?? {}) as Record<string, string | undefined>
  const expectedToken = env.ADMIN_TOKEN
    || process.env.ADMIN_TOKEN
    || await readLocalWranglerAdminToken()

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

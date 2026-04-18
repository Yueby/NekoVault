/**
 * TOTP 工具 Composable
 *
 * 提供 TOTP 验证码生成、URI 解析、倒计时等功能
 */
import { TOTP } from 'otpauth'
import type { TotpEntry, TotpAlgorithm } from '~/types/vault'

/**
 * 生成当前 TOTP 验证码
 */
export function generateCode(entry: TotpEntry): string {
  const totp = new TOTP({
    issuer: entry.issuer,
    label: entry.label,
    algorithm: entry.algorithm,
    digits: entry.digits,
    period: entry.period,
    secret: entry.secret
  })

  return totp.generate()
}

/**
 * 获取当前周期剩余秒数
 */
export function getRemainingSeconds(period: number = 30): number {
  const now = Math.floor(Date.now() / 1000)
  return period - (now % period)
}

/**
 * 解析 otpauth:// URI
 *
 * 格式: otpauth://totp/ISSUER:ACCOUNT?secret=XXX&issuer=XXX&digits=6&period=30&algorithm=SHA1
 */
export function parseOtpauthUri(uri: string): Partial<TotpEntry> | null {
  try {
    const url = new URL(uri)

    if (url.protocol !== 'otpauth:' || url.hostname !== 'totp') {
      return null
    }

    // 解析 label 部分：/ISSUER:ACCOUNT 或 /ACCOUNT
    const pathLabel = decodeURIComponent(url.pathname.slice(1)) // 去掉前导 /
    let issuer = ''
    let accountName = ''
    let label = pathLabel

    if (pathLabel.includes(':')) {
      const parts = pathLabel.split(':')
      issuer = parts[0]?.trim() ?? ''
      accountName = parts.slice(1).join(':').trim()
    } else {
      accountName = pathLabel
    }

    // 从查询参数获取值
    const params = url.searchParams
    const secret = params.get('secret') ?? ''
    const queryIssuer = params.get('issuer')
    if (queryIssuer) {
      issuer = queryIssuer
    }

    // 重建 label
    if (issuer && accountName) {
      label = `${issuer}:${accountName}`
    }

    const digits = parseInt(params.get('digits') ?? '6', 10)
    const period = parseInt(params.get('period') ?? '30', 10)
    const algorithm = (params.get('algorithm')?.toUpperCase() ?? 'SHA1') as TotpAlgorithm

    return {
      label,
      issuer,
      accountName,
      secret: secret.replace(/\s/g, '').toUpperCase(),
      digits: isNaN(digits) ? 6 : digits,
      period: isNaN(period) ? 30 : period,
      algorithm: ['SHA1', 'SHA256', 'SHA512'].includes(algorithm) ? algorithm : 'SHA1'
    }
  } catch {
    return null
  }
}

/**
 * 批量解析多条 otpauth URI（从文本中逐行解析）
 */
export function parseMultipleUris(text: string): Array<Partial<TotpEntry>> {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.startsWith('otpauth://'))
  const results: Array<Partial<TotpEntry>> = []

  for (const line of lines) {
    const parsed = parseOtpauthUri(line)
    if (parsed) {
      results.push(parsed)
    }
  }

  return results
}

/**
 * 将 TotpEntry 转为 otpauth URI
 */
export function toOtpauthUri(entry: TotpEntry): string {
  const totp = new TOTP({
    issuer: entry.issuer,
    label: entry.accountName || entry.label,
    algorithm: entry.algorithm,
    digits: entry.digits,
    period: entry.period,
    secret: entry.secret
  })

  return totp.toString()
}

/**
 * 响应式倒计时 Composable
 *
 * @param period TOTP 刷新周期（秒）
 * @returns 响应式的剩余秒数和进度百分比
 */
export function useCountdown(period: Ref<number> | number = 30) {
  const periodValue = isRef(period) ? period : ref(period)
  const remaining = ref(getRemainingSeconds(periodValue.value))
  const progress = computed(() => remaining.value / periodValue.value)

  let timer: ReturnType<typeof setInterval> | null = null

  function update() {
    remaining.value = getRemainingSeconds(periodValue.value)
  }

  onMounted(() => {
    update()
    timer = setInterval(update, 250) // 每 250ms 更新一次，保证动画流畅
  })

  onUnmounted(() => {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  })

  return {
    /** 当前周期剩余秒数 */
    remaining: readonly(remaining),
    /** 剩余时间占总周期的比例 (0-1) */
    progress: readonly(progress)
  }
}

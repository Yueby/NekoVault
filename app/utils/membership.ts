/**
 * 会员/订阅剩余时间相关工具
 */

/** 剩余时间展示状态 */
export type MembershipStatus = 'healthy' | 'normal' | 'soon' | 'today' | 'expired'

export interface MembershipInfo {
  /** 剩余天数（向上取整；负数代表已过期） */
  days: number
  /** 状态分级 */
  status: MembershipStatus
  /** 简短展示文本，如 "会员 23天" / "已过期 3天" */
  label: string
  /** 徽章颜色（对应 Nuxt UI color 选项） */
  color: 'success' | 'primary' | 'warning' | 'error' | 'neutral'
  /** 本地化完整到期日期，例如 "2026-01-15" */
  expiresAtLabel: string
}

/** 一天毫秒数 */
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * 把 Date 或时间戳格式化为本地日期字符串 (YYYY-MM-DD)
 */
export function toLocalDateInputValue(ts: number | undefined): string {
  if (!ts) return ''
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * 把本地日期字符串 (YYYY-MM-DD) 解析为当日 23:59:59.999 的本地时间戳。
 * 空串或非法输入返回 undefined。
 */
export function parseLocalDateEndOfDay(value: string): number | undefined {
  if (!value) return undefined
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!m) return undefined
  const year = Number(m[1])
  const month = Number(m[2]) - 1
  const day = Number(m[3])
  const ts = new Date(year, month, day, 23, 59, 59, 999).getTime()
  return Number.isFinite(ts) ? ts : undefined
}

/**
 * 根据到期时间戳与当前时间计算会员剩余信息。
 * 未设置到期时间则返回 null。
 */
export function getMembershipInfo(
  expiresAt: number | undefined,
  now: number = Date.now()
): MembershipInfo | null {
  if (!expiresAt) return null

  const diff = expiresAt - now
  // 向上取整：还有 0.3 天也算 1 天，避免提前显示"已过期"
  const days = diff >= 0
    ? Math.ceil(diff / DAY_MS)
    : -Math.ceil(Math.abs(diff) / DAY_MS)

  let status: MembershipStatus
  let color: MembershipInfo['color']
  let label: string

  if (diff < 0) {
    status = 'expired'
    color = 'error'
    const overdueDays = Math.abs(days)
    label = overdueDays <= 0 ? '已过期' : `已过期 ${overdueDays}天`
  } else if (days <= 0) {
    status = 'today'
    color = 'warning'
    label = '今日到期'
  } else if (days <= 7) {
    status = 'soon'
    color = 'warning'
    label = `仅剩 ${days}天`
  } else if (days <= 30) {
    status = 'normal'
    color = 'primary'
    label = `会员 ${days}天`
  } else {
    status = 'healthy'
    color = 'success'
    label = `会员 ${days}天`
  }

  return {
    days,
    status,
    label,
    color,
    expiresAtLabel: toLocalDateInputValue(expiresAt)
  }
}

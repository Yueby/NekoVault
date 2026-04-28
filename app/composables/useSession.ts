/**
 * Session 管理 Composable
 *
 * 在线优先架构（不再支持离线）：
 * - 密码 = ADMIN_TOKEN，用于 API 鉴权
 * - 输入密码 → 远端验证 → 有数据则拉取，无数据则自动创建空 vault → 解锁
 * - 网络不可用时直接报错，不再回退本地缓存
 */
import type { VaultDocument } from '~/types/vault'
import { migrateVault } from '~/utils/migrate'
import { useVaultStore } from '~/stores/vault'

/** Session 状态 */
type SessionState = 'loading' | 'locked' | 'unlocked'

// ============================================================
// 客户端内存级密码错误限速（刷新页面即重置）
// ============================================================

const LOCKOUT_CONFIG = {
  /** 第一次触发限速的失败次数 */
  firstThreshold: 5,
  /** 第一次限速等待时间（毫秒）：30 秒 */
  firstLockoutMs: 30_000,
  /** 第二次触发限速的失败次数 */
  secondThreshold: 10,
  /** 第二次限速等待时间（毫秒）：5 分钟 */
  secondLockoutMs: 5 * 60_000
} as const

const lockoutMemory = {
  failedAttempts: 0,
  lockoutUntil: 0
}

function checkLockoutSeconds(): number {
  if (lockoutMemory.lockoutUntil <= 0) return 0
  const remaining = lockoutMemory.lockoutUntil - Date.now()
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0
}

function recordFailedAttempt(): number {
  lockoutMemory.failedAttempts += 1

  let lockoutMs = 0
  if (lockoutMemory.failedAttempts >= LOCKOUT_CONFIG.secondThreshold) {
    lockoutMs = LOCKOUT_CONFIG.secondLockoutMs
  } else if (lockoutMemory.failedAttempts >= LOCKOUT_CONFIG.firstThreshold) {
    lockoutMs = LOCKOUT_CONFIG.firstLockoutMs
  }

  if (lockoutMs > 0) {
    lockoutMemory.lockoutUntil = Date.now() + lockoutMs
  }
  return lockoutMs > 0 ? Math.ceil(lockoutMs / 1000) : 0
}

function resetLockout() {
  lockoutMemory.failedAttempts = 0
  lockoutMemory.lockoutUntil = 0
}

// ============================================================
// Composable
// ============================================================

export function useSession() {
  const vaultStore = useVaultStore()

  const sessionState = useState<SessionState>('session-state', () => 'loading')
  const unlockError = ref('')
  const lockoutRemaining = ref(0)

  /**
   * 解锁 Vault（必须联网）
   *
   * 流程：
   * 1. 密码作为 ADMIN_TOKEN 去远端拉数据
   * 2. 远端有数据 → 拉取 → 解锁
   * 3. 远端返回 404 → 自动创建空 vault → 解锁
   * 4. 远端返回 401 → 密码错误
   * 5. 网络/服务端不可达 → 报错（不再回退本地缓存）
   */
  async function unlockVault(password: string): Promise<boolean> {
    unlockError.value = ''

    // 检查限速
    const remaining = checkLockoutSeconds()
    if (remaining > 0) {
      lockoutRemaining.value = remaining
      unlockError.value = `访问密钥尝试过多，请等待 ${remaining} 秒后重试`
      return false
    }

    try {
      vaultStore.setAdminToken(password)

      try {
        const remoteData = await $fetch<{
          data: string
          revision: number
          updatedAt: string
        }>('/api/vault', {
          headers: {
            'x-admin-token': password
          }
        })

        // 远程成功！解析数据
        const rawVault = JSON.parse(remoteData.data) as VaultDocument
        const { vault, migrated } = migrateVault(rawVault)

        // 加载到 store
        vaultStore.hydrate(vault, remoteData.revision)

        // 若发生迁移，立即回写
        if (migrated) {
          await vaultStore.persistVault()
        }

        resetLockout()
        sessionState.value = 'unlocked'
        return true
      } catch (remoteErr: unknown) {
        const statusCode = (remoteErr && typeof remoteErr === 'object' && 'statusCode' in remoteErr)
          ? (remoteErr as { statusCode: number }).statusCode
          : undefined
        const errorCode = (
          remoteErr
          && typeof remoteErr === 'object'
          && 'data' in remoteErr
          && (remoteErr as { data?: { error?: string } }).data
          && typeof (remoteErr as { data?: { error?: string } }).data?.error === 'string'
        )
          ? (remoteErr as { data: { error: string } }).data.error
          : undefined

        if (statusCode === 401) {
          // 密码错误
          const waitSeconds = recordFailedAttempt()
          if (waitSeconds > 0) {
            lockoutRemaining.value = waitSeconds
            unlockError.value = `访问密钥错误。请等待 ${waitSeconds} 秒后重试`
          } else {
            unlockError.value = '访问密钥错误，请重试'
          }
          return false
        }

        if (statusCode === 500 && errorCode === 'config') {
          unlockError.value = '服务端未配置访问密钥（ADMIN_TOKEN）'
          return false
        }

        if (statusCode === 404) {
          // 远端没有 vault → 密码验证已通过，自动创建空 vault
          try {
            vaultStore.initializeEmpty()
            const emptyVaultJson = JSON.stringify(vaultStore.decryptedVault)

            const bootstrapResult = await $fetch<{ success: boolean, revision: number }>('/api/bootstrap', {
              method: 'POST',
              headers: { 'x-admin-token': password },
              body: { data: emptyVaultJson }
            })

            vaultStore.setRevision(bootstrapResult.revision)

            resetLockout()
            sessionState.value = 'unlocked'
            return true
          } catch {
            unlockError.value = '创建金库失败，请检查网络后重试'
            return false
          }
        }

        // 其他错误（网络异常、5xx 等） → 报错
        unlockError.value = '无法连接服务器，请检查网络后重试'
        return false
      }
    } catch {
      unlockError.value = '解锁失败，请重试'
      return false
    }
  }

  /**
   * 锁定 Vault
   */
  function lockVault() {
    vaultStore.lock()
    sessionState.value = 'locked'
    navigateTo('/unlock')
  }

  return {
    sessionState: readonly(sessionState),
    unlockError: readonly(unlockError),
    lockoutRemaining: readonly(lockoutRemaining),

    unlockVault,
    lockVault
  }
}

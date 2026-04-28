/**
 * Session 管理 Composable
 *
 * 极简架构：
 * - 密码 = ADMIN_TOKEN，用于 API 鉴权
 * - 输入密码 → 远端验证 → 有数据则拉取，无数据则自动创建空 vault → 解锁
 * - 离线时降级用本地加密缓存
 * - 改密后自动刷新本地缓存
 */
import type { VaultDocument } from '~/types/vault'
import { encryptLocal, decryptLocal } from '~/utils/crypto'
import {
  getLocalSnapshot,
  saveLocalSnapshot,
  checkLockout,
  recordFailedAttempt,
  resetLockout,
  getPendingSyncIntent
} from '~/utils/local-db'
import { migrateVault } from '~/utils/migrate'
import { useVaultStore } from '~/stores/vault'

/** Session 状态 */
type SessionState = 'loading' | 'locked' | 'unlocked'

export function useSession() {
  const vaultStore = useVaultStore()

  const sessionState = useState<SessionState>('session-state', () => 'loading')
  const unlockError = ref('')
  const lockoutRemaining = ref(0)

  // 应用级一次性初始化（只注册一次在线同步重试监听）
  const sessionInitialized = useState<boolean>(
    'session-initialized',
    () => false
  )

  if (!sessionInitialized.value) {
    sessionInitialized.value = true

    // 在线恢复时自动重试同步队列（ssr: false，代码仅在客户端运行）
    window.addEventListener('online', async () => {
      if (!vaultStore.isUnlocked) return
      const pending = await getPendingSyncIntent()
      if (pending) {
        await vaultStore.syncToRemote(pending.data, pending.revision)
      }
    })
  }

  /**
   * 解锁 Vault
   *
   * 极简流程：
   * 1. 密码作为 ADMIN_TOKEN 去远端拉数据
   * 2. 远端有数据 → 拉取 → 本地缓存 → 解锁
   * 3. 远端返回 404（无 vault） → 自动创建空 vault → 解锁
   * 4. 远端返回 401 → 密码错误
   * 5. 远端不可达（离线） → 用密码解密本地缓存 → 解锁
   */
  async function unlockVault(password: string): Promise<boolean> {
    unlockError.value = ''

    // 检查限速
    const remaining = await checkLockout()
    if (remaining > 0) {
      lockoutRemaining.value = remaining
      unlockError.value = `访问密钥尝试过多，请等待 ${remaining} 秒后重试`
      return false
    }

    try {
      vaultStore.setAdminToken(password)

      // 策略 1：尝试从远程获取（用密码作为 admin-token）
      let remoteSuccess = false
      let skipLocalFallback = false
      try {
        console.log('[v0] 尝试从远程获取 vault...')
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

        // 用当前密码重新加密并保存本地缓存（支持改密后自动刷新）
        const encrypted = await encryptLocal(remoteData.data, password)
        await saveLocalSnapshot({
          id: 'default',
          encrypted,
          revision: remoteData.revision,
          savedAt: Date.now()
        })

        remoteSuccess = true

        // 若发生迁移，立即回写
        if (migrated) {
          await vaultStore.persistVault()
        }
      } catch (remoteErr: unknown) {
        console.log('[v0] 远程请求失败:', remoteErr)
        // 区分远程失败原因
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

        console.log('[v0] 错误状态码:', statusCode, '错误代码:', errorCode)

        if (statusCode === 401) {
          // 密码错误
          const waitSeconds = await recordFailedAttempt()
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
          skipLocalFallback = true
        }

        if (statusCode === 404) {
          // 远端没有 vault → 密码验证已通过（不是 401），自动创建空 vault
          try {
            console.log('[v0] Vault 不存在，创建新 vault...')
            vaultStore.initializeEmpty()
            const emptyVaultJson = JSON.stringify(vaultStore.decryptedVault)

            const bootstrapResult = await $fetch<{ success: boolean, revision: number }>('/api/bootstrap', {
              method: 'POST',
              headers: { 'x-admin-token': password },
              body: { data: emptyVaultJson }
            })

            vaultStore.setRevision(bootstrapResult.revision)

            // 保存本地缓存
            const encrypted = await encryptLocal(emptyVaultJson, password)
            await saveLocalSnapshot({
              id: 'default',
              encrypted,
              revision: bootstrapResult.revision,
              savedAt: Date.now()
            })

            remoteSuccess = true
          } catch (bootstrapErr) {
            console.log('[v0] 创建 vault 失败:', bootstrapErr)
            unlockError.value = '创建金库失败，请检查网络后重试'
            return false
          }
        }

        // 其他错误（离线等），继续尝试本地缓存
      }

      // 策略 2：远程失败时，尝试解密本地缓存
      if (!remoteSuccess) {
        // 如果是配置错误，直接返回，不尝试本地缓存
        if (skipLocalFallback) {
          return false
        }

        console.log('[v0] 尝试使用本地缓存...')
        const localSnapshot = await getLocalSnapshot()
        if (!localSnapshot) {
          console.log('[v0] 本地无缓存数据')
          unlockError.value = '无法连接服务器，且本地无缓存数据'
          return false
        }

        try {
          const dataJson = await decryptLocal(localSnapshot.encrypted, password)
          const rawVault = JSON.parse(dataJson) as VaultDocument
          const { vault, migrated } = migrateVault(rawVault)

          vaultStore.hydrate(vault, localSnapshot.revision)
          vaultStore.setSyncStatus('offline')

          if (migrated) {
            await vaultStore.persistVault()
          }
        } catch {
          // 本地解密也失败 → 密码错误
          const waitSeconds = await recordFailedAttempt()
          if (waitSeconds > 0) {
            lockoutRemaining.value = waitSeconds
            unlockError.value = `访问密钥错误。请等待 ${waitSeconds} 秒后重试`
          } else {
            unlockError.value = '访问密钥错误，请重试'
          }
          return false
        }
      }

      // 解锁成功
      await resetLockout()
      sessionState.value = 'unlocked'
      return true
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

/**
 * 全局路由守卫
 *
 * 根据 session 状态决定路由跳转：
 * - 未初始化 → /setup
 * - 未解锁 → /unlock
 * - 已解锁 → 允许访问 /codes、/settings
 */
import { hasLocalVault } from '~/utils/local-db'
import { useVaultStore } from '~/stores/vault'

export default defineNuxtRouteMiddleware(async (to) => {
  // 仅在客户端运行
  if (import.meta.server) return

  const vaultStore = useVaultStore()
  const hasVault = await hasLocalVault()

  // /setup 页面：只有未初始化时才允许访问
  if (to.path === '/setup') {
    if (hasVault) {
      return navigateTo('/unlock')
    }
    return // 允许访问 setup
  }

  // 其他页面：需要先初始化
  if (!hasVault) {
    return navigateTo('/setup')
  }

  // /unlock 页面：已解锁时跳转到 codes
  if (to.path === '/unlock') {
    if (vaultStore.isUnlocked) {
      return navigateTo('/codes')
    }
    return // 允许访问 unlock
  }

  // /codes 和 /settings：需要已解锁
  if (!vaultStore.isUnlocked) {
    return navigateTo('/unlock')
  }

  // 首页重定向
  if (to.path === '/') {
    return navigateTo('/codes')
  }
})

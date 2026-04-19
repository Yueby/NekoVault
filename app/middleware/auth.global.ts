/**
 * 全局路由守卫
 *
 * 极简逻辑：
 * - 未解锁 → /unlock
 * - 已解锁 → 允许访问 /codes、/settings
 */
import { useVaultStore } from '~/stores/vault'

export default defineNuxtRouteMiddleware(async (to) => {
  const vaultStore = useVaultStore()

  // /unlock 页面：已解锁时跳转到 codes
  if (to.path === '/unlock') {
    if (vaultStore.isUnlocked) {
      return navigateTo('/codes')
    }
    return
  }

  // 其他所有页面：需要已解锁
  if (!vaultStore.isUnlocked) {
    return navigateTo('/unlock')
  }

  // 首页重定向
  if (to.path === '/') {
    return navigateTo('/codes')
  }
})

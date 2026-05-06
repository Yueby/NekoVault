<script setup lang="ts">
import AppHeader from '~/components/layout/AppHeader.vue'
import AppBottomNav from '~/components/layout/AppBottomNav.vue'
import TotpListView from '~/components/vault/TotpListView.vue'
import PasswordListView from '~/components/vault/PasswordListView.vue'
import IdentityView from '~/components/identity/IdentityView.vue'
import SettingsView from '~/components/settings/SettingsView.vue'
/**
 * 金库主页面 — 验证码 + 账号 + 身份 + 设置
 *
 * 采用响应式组合架构：
 * - 布局组件：AppHeader / AppBottomNav
 * - 业务视图：TotpListView / PasswordListView / IdentityView / SettingsView
 */

definePageMeta({
  layout: false
})

const currentTab = ref<'codes' | 'passwords' | 'identity' | 'settings'>('codes')

// 页面标题
const pageTitle = computed(() => {
  switch (currentTab.value) {
    case 'codes': return '验证码'
    case 'passwords': return '账号密码'
    case 'identity': return '身份信息'
    case 'settings': return '设置'
    default: return 'NekoVault'
  }
})

// 用于调用子组件的方法
const totpViewRef = ref()
const passwordViewRef = ref()

// 懒挂载 IdentityView：用户首次切到 identity tab 后才挂载，之后保持
const hasVisitedIdentity = ref(false)

// 监听 tab 切换，记录是否访问过 identity
watch(currentTab, (tab) => {
  if (tab === 'identity') hasVisitedIdentity.value = true
})

function handleFabClick() {
  if (currentTab.value === 'codes') totpViewRef.value?.openAddTotp()
  else if (currentTab.value === 'passwords') passwordViewRef.value?.openAddPassword()
}
</script>

<template>
  <div class="min-h-dvh flex flex-col">
    <!-- 顶部布局 -->
    <AppHeader
      v-model:current-tab="currentTab"
      :page-title="pageTitle"
    />

    <!-- 主内容区域 -->
    <UContainer
      as="main"
      class="flex-1 w-full py-4 pb-24 lg:pb-8 flex flex-col"
    >
      <!-- 使用 v-show 代替 keep-alive + v-if，保持组件缓存且正确切换 -->
      <TotpListView
        v-show="currentTab === 'codes'"
        ref="totpViewRef"
      />

      <PasswordListView
        v-show="currentTab === 'passwords'"
        ref="passwordViewRef"
      />

      <!-- 懒挂载：v-if 控制首次挂载，v-show 保持切换后状态 -->
      <IdentityView
        v-if="hasVisitedIdentity"
        v-show="currentTab === 'identity'"
      />

      <SettingsView v-show="currentTab === 'settings'" />
    </UContainer>

    <!-- FAB 添加按钮（全局通用） -->
    <div
      v-if="currentTab === 'codes' || currentTab === 'passwords'"
      class="fixed bottom-20 right-5 z-40 lg:bottom-10 lg:right-10"
    >
      <UButton
        icon="i-lucide-plus"
        size="xl"
        class="rounded-full shadow-lg !p-3"
        @click="handleFabClick"
      />
    </div>

    <!-- 底部导航栏 -->
    <AppBottomNav v-model:current-tab="currentTab" />
  </div>
</template>

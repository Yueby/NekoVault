<script setup lang="ts">
import AppHeader from '~/components/layout/AppHeader.vue'
import AppBottomNav from '~/components/layout/AppBottomNav.vue'
import TotpListView from '~/components/vault/TotpListView.vue'
import PasswordListView from '~/components/vault/PasswordListView.vue'
import TrashView from '~/components/vault/TrashView.vue'
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

const currentTab = ref<'codes' | 'passwords' | 'identity' | 'trash' | 'settings'>('codes')

// 页面标题
const pageTitle = computed(() => {
  switch (currentTab.value) {
    case 'codes': return '验证码'
    case 'passwords': return '账号密码'
    case 'identity': return '随机身份'
    case 'trash': return '回收站'
    case 'settings': return '设置'
    default: return 'NekoVault'
  }
})

// tab 切换动画：先淡出 → 切换内容 → 再淡入
const tabAnimating = ref(false)
const displayTab = ref<'codes' | 'passwords' | 'identity' | 'trash' | 'settings'>('codes')

watch(currentTab, (newTab) => {
  if (newTab === displayTab.value) return
  // 1. 先淡出
  tabAnimating.value = true
  // 2. 等淡出结束再切换内容
  setTimeout(() => {
    displayTab.value = newTab
    // 3. 内容切换后淡入
    requestAnimationFrame(() => {
      tabAnimating.value = false
    })
  }, 200)
})

// 用于调用子组件的方法
const totpViewRef = ref()
const passwordViewRef = ref()

// 懒挂载 IdentityView：用户首次切到 identity tab 后才挂载，之后保持
const hasVisitedIdentity = ref(false)

// 监听 displayTab 切换，记录是否访问过 identity
watch(displayTab, (tab) => {
  if (tab === 'identity') hasVisitedIdentity.value = true
})

function handleFabClick() {
  if (displayTab.value === 'codes') totpViewRef.value?.openAddTotp()
  else if (displayTab.value === 'passwords') passwordViewRef.value?.openAddPassword()
}
</script>

<template>
  <!-- 使用 fixed inset-0 锁定整个页面在视口，防止 body 滚动，彻底解决滚动条被遮挡问题 -->
  <div class="fixed inset-0 flex flex-col overflow-hidden bg-[var(--ui-bg)]">
    <!-- 顶部布局 (shrink-0，不滚动) -->
    <AppHeader
      v-model:current-tab="currentTab"
      :page-title="pageTitle"
      class="shrink-0"
    />

    <!-- 主内容区域 (flex-1，独立滚动区，滚动条止于底部导航栏之上) -->
    <div class="flex-1 w-full overflow-y-auto overflow-x-hidden relative">
      <UContainer
        as="main"
        class="w-full py-4 lg:pb-8 flex flex-col transition-opacity duration-200 min-h-full"
        :class="tabAnimating ? 'opacity-0' : 'opacity-100'"
      >
        <!-- 使用 v-show 代替 keep-alive + v-if，保持组件缓存且正确切换 -->
        <TotpListView
          v-show="displayTab === 'codes'"
          ref="totpViewRef"
        />

        <PasswordListView
          v-show="displayTab === 'passwords'"
          ref="passwordViewRef"
        />

        <!-- 懒挂载：v-if 控制首次挂载，v-show 保持切换后状态 -->
        <IdentityView
          v-if="hasVisitedIdentity"
          v-show="displayTab === 'identity'"
        />

        <TrashView v-show="displayTab === 'trash'" />

        <SettingsView
          v-show="displayTab === 'settings'"
          @open-trash="currentTab = 'trash'"
        />
      </UContainer>
    </div>

    <!-- FAB 添加按钮（全局通用） -->
    <div
      v-if="displayTab === 'codes' || displayTab === 'passwords'"
      class="fixed right-5 z-40 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] lg:bottom-10 lg:right-10"
    >
      <UButton
        icon="i-lucide-plus"
        size="xl"
        class="rounded-full shadow-lg !p-3"
        @click="handleFabClick"
      />
    </div>

    <!-- 底部导航栏 -->
    <AppBottomNav
      v-model:current-tab="currentTab"
      class="shrink-0"
    />
  </div>
</template>

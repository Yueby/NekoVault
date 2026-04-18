<script setup lang="ts">
/**
 * 金库主页面 — 验证码 + 账号密码 + 设置
 * 
 * 采用响应式组合架构：
 * - 布局组件：AppHeader / AppBottomNav
 * - 业务视图：TotpListView / PasswordListView / SettingsView
 */
import { ref, computed } from 'vue'

import AppHeader from '~/components/layout/AppHeader.vue'
import AppBottomNav from '~/components/layout/AppBottomNav.vue'
import TotpListView from '~/components/vault/TotpListView.vue'
import PasswordListView from '~/components/vault/PasswordListView.vue'
import SettingsView from '~/components/settings/SettingsView.vue'

definePageMeta({
  layout: false
})

const currentTab = ref<'codes' | 'passwords' | 'settings'>('codes')

// 页面标题
const pageTitle = computed(() => {
  switch (currentTab.value) {
    case 'codes': return '验证码'
    case 'passwords': return '账号密码'
    case 'settings': return '设置'
    default: return 'NekoVault'
  }
})

// 用于调用子组件的方法
const totpViewRef = ref()
const passwordViewRef = ref()

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
      <keep-alive>
        <TotpListView
          v-if="currentTab === 'codes'"
          ref="totpViewRef"
        />
      </keep-alive>
      
      <keep-alive>
        <PasswordListView
          v-if="currentTab === 'passwords'"
          ref="passwordViewRef"
        />
      </keep-alive>

      <keep-alive>
        <SettingsView v-if="currentTab === 'settings'" />
      </keep-alive>
    </UContainer>

    <!-- FAB 添加按钮（全局通用） -->
    <div
      v-if="currentTab !== 'settings'"
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

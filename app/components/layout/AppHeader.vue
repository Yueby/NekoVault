<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  currentTab: 'codes' | 'passwords' | 'settings'
  pageTitle: string
}>()

const emit = defineEmits<{
  'update:currentTab': [value: 'codes' | 'passwords' | 'settings']
}>()

const vaultStore = useVaultStore()
const { lockVault } = useSession()

const syncStatusIcon = computed(() => {
  switch (vaultStore.syncStatus) {
    case 'synced': return 'i-lucide-cloud-check'
    case 'syncing': return 'i-lucide-cloud-upload'
    case 'conflict': return 'i-lucide-cloud-alert'
    case 'offline': return 'i-lucide-cloud-off'
    case 'error': return 'i-lucide-cloud-x'
    default: return 'i-lucide-cloud'
  }
})
</script>

<template>
  <header class="sticky top-0 z-50 bg-[var(--ui-bg)]/80 backdrop-blur-xl border-b border-[var(--ui-border)]">
    <UContainer class="py-3">
      <div class="flex items-center justify-between">
        <!-- 移动端：显示当前页面标题 -->
        <h1 class="text-lg font-bold text-[var(--ui-text-highlighted)] lg:hidden">
          {{ pageTitle }}
        </h1>

        <!-- 桌面端：Logo + 顶部 Tab 导航 -->
        <div class="hidden lg:flex items-center gap-6">
          <div class="flex items-center gap-2">
            <UIcon
              name="i-lucide-shield-check"
              class="w-5 h-5 text-[var(--ui-color-primary)]"
            />
            <span class="text-lg font-bold text-[var(--ui-text-highlighted)]">NekoVault</span>
          </div>
          <nav class="flex items-center gap-1">
            <UButton
              icon="i-lucide-shield-check"
              :color="currentTab === 'codes' ? 'primary' : 'neutral'"
              :variant="currentTab === 'codes' ? 'soft' : 'ghost'"
              size="sm"
              @click="emit('update:currentTab', 'codes')"
            >
              验证码
            </UButton>
            <UButton
              icon="i-lucide-key-round"
              :color="currentTab === 'passwords' ? 'primary' : 'neutral'"
              :variant="currentTab === 'passwords' ? 'soft' : 'ghost'"
              size="sm"
              @click="emit('update:currentTab', 'passwords')"
            >
              账号密码
            </UButton>
            <UButton
              icon="i-lucide-settings"
              :color="currentTab === 'settings' ? 'primary' : 'neutral'"
              :variant="currentTab === 'settings' ? 'soft' : 'ghost'"
              size="sm"
              @click="emit('update:currentTab', 'settings')"
            >
              设置
            </UButton>
          </nav>
        </div>

        <div class="flex items-center gap-1">
          <UTooltip :text="vaultStore.syncStatus">
            <UButton
              :icon="syncStatusIcon"
              color="neutral"
              variant="ghost"
              size="xs"
            />
          </UTooltip>
          <UColorModeButton size="xs" />
          <UButton
            icon="i-lucide-lock"
            color="neutral"
            variant="ghost"
            size="xs"
            @click="lockVault"
          />
        </div>
      </div>

      <!-- 搜索框等底部插槽 -->
      <slot name="bottom" />
    </UContainer>
  </header>
</template>

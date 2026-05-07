<script setup lang="ts">
defineProps<{
  currentTab: 'codes' | 'passwords' | 'identity' | 'settings'
}>()

const emit = defineEmits<{
  'update:currentTab': [value: 'codes' | 'passwords' | 'identity' | 'settings']
}>()
</script>

<template>
  <!-- ==================== 底部导航栏（仅移动端） ==================== -->
  <nav class="fixed bottom-0 left-0 right-0 z-50 bg-[var(--ui-bg)]/90 backdrop-blur-xl border-t border-[var(--ui-border)] pb-[env(safe-area-inset-bottom)] lg:hidden">
    <div class="flex items-center justify-around h-14 max-w-lg mx-auto">
      <button
        class="flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors"
        :class="currentTab === 'codes' ? 'text-[var(--ui-text-highlighted)]' : 'text-[var(--ui-text-muted)]'"
        @click="emit('update:currentTab', 'codes')"
      >
        <UIcon
          name="i-lucide-shield-check"
          class="w-5 h-5"
        />
        <span class="text-[10px] font-medium">验证码</span>
      </button>
      <button
        class="flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors"
        :class="currentTab === 'passwords' ? 'text-[var(--ui-text-highlighted)]' : 'text-[var(--ui-text-muted)]'"
        @click="emit('update:currentTab', 'passwords')"
      >
        <UIcon
          name="i-lucide-key-round"
          class="w-5 h-5"
        />
        <span class="text-[10px] font-medium">账号密码</span>
      </button>
      <button
        class="flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors"
        :class="currentTab === 'identity' ? 'text-[var(--ui-text-highlighted)]' : 'text-[var(--ui-text-muted)]'"
        @click="emit('update:currentTab', 'identity')"
      >
        <UIcon
          name="i-lucide-users"
          class="w-5 h-5"
        />
        <span class="text-[10px] font-medium">随机身份</span>
      </button>
      <button
        class="flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors"
        :class="currentTab === 'settings' ? 'text-[var(--ui-text-highlighted)]' : 'text-[var(--ui-text-muted)]'"
        @click="emit('update:currentTab', 'settings')"
      >
        <UIcon
          name="i-lucide-settings"
          class="w-5 h-5"
        />
        <span class="text-[10px] font-medium">设置</span>
      </button>
    </div>
  </nav>
</template>

<script setup lang="ts">
/**
 * Unlock 页面 — 输入访问密钥解锁 Vault
 */

definePageMeta({
  layout: false,
  ssr: false
})

const { unlockVault, unlockError, lockoutRemaining } = useSession()

const password = ref('')
const isUnlocking = ref(false)

// 限速倒计时
const lockoutTimer = ref<ReturnType<typeof setInterval> | null>(null)
const displayLockout = ref(0)

watch(lockoutRemaining, (val) => {
  if (val > 0) {
    displayLockout.value = val
    if (lockoutTimer.value) clearInterval(lockoutTimer.value)
    lockoutTimer.value = setInterval(() => {
      displayLockout.value--
      if (displayLockout.value <= 0 && lockoutTimer.value) {
        clearInterval(lockoutTimer.value)
        lockoutTimer.value = null
      }
    }, 1000)
  }
})

onUnmounted(() => {
  if (lockoutTimer.value) clearInterval(lockoutTimer.value)
})

async function handleUnlock() {
  if (!password.value || isUnlocking.value || displayLockout.value > 0) return

  isUnlocking.value = true
  try {
    const success = await unlockVault(password.value)
    if (success) {
      navigateTo('/codes')
    }
  } finally {
    isUnlocking.value = false
    password.value = ''
  }
}
</script>

<template>
  <div class="min-h-dvh flex flex-col items-center justify-center p-4">
    <div class="w-full max-w-sm space-y-8">
      <!-- Logo & 标题 -->
      <div class="flex flex-col items-center justify-center space-y-3">
        <div class="flex items-center justify-center gap-2">
          <img
            src="/logo.svg"
            alt="NekoVault Logo"
            class="w-10 h-10 shrink-0"
          >
          <h1 class="text-3xl font-bold text-[var(--ui-text-highlighted)] tracking-tight">
            NekoVault
          </h1>
        </div>
        <p class="text-sm text-[var(--ui-text-muted)] text-center">
          输入访问密码解锁金库
        </p>
      </div>

      <!-- 登录卡片 -->
      <UCard>
        <div class="space-y-5">
          <UFormField
            label="访问密码"
            :error="unlockError || undefined"
          >
            <UInput
              v-model="password"
              type="password"
              placeholder="输入访问密码"
              size="lg"
              autofocus
              :disabled="isUnlocking || displayLockout > 0"
              @keyup.enter="handleUnlock"
            />
          </UFormField>

          <UAlert
            v-if="displayLockout > 0"
            color="warning"
            variant="subtle"
            icon="i-lucide-timer"
            :title="`请等待 ${displayLockout} 秒后重试`"
          />

          <UButton
            block
            size="lg"
            :loading="isUnlocking"
            :disabled="!password || displayLockout > 0"
            @click="handleUnlock"
          >
            {{ isUnlocking ? '解锁中…' : '解锁' }}
          </UButton>
        </div>
      </UCard>
    </div>
  </div>
</template>

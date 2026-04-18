<script setup lang="ts">
/**
 * Setup 页面 — 首次运行创建 Vault
 *
 * 流程：输入主密码 → 确认密码 → 派生密钥 → 创建 vault → 展示 Recovery Key
 */
import { evaluatePasswordStrength } from '~/utils/crypto'
import type { PasswordStrength } from '~/utils/crypto'
import { masterPasswordSchema } from '~~/shared/schemas/vault'

definePageMeta({
  layout: false,
  ssr: false
})

const { setupVault } = useSession()

// 表单状态
const password = ref('')
const confirmPassword = ref('')
const showPassword = ref(false)
const step = ref<'create' | 'confirm' | 'deriving' | 'recovery'>('create')
const recoveryKey = ref('')
const setupError = ref('')

// 密码强度
const passwordStrength = computed(() => {
  if (!password.value) return { strength: 'weak' as PasswordStrength, score: 0 }
  return evaluatePasswordStrength(password.value)
})

type BadgeColor = 'error' | 'warning' | 'success' | 'primary'
const strengthColors: Record<PasswordStrength, BadgeColor> = {
  'weak': 'error',
  'medium': 'warning',
  'strong': 'success',
  'very-strong': 'primary'
}

const strengthLabels: Record<PasswordStrength, string> = {
  'weak': '弱',
  'medium': '中等',
  'strong': '强',
  'very-strong': '非常强'
}

// 密码校验
const passwordValidation = computed(() => {
  const result = masterPasswordSchema.safeParse(password.value)
  if (result.success) return null
  return result.error.issues[0]?.message ?? '密码不符合要求'
})

const passwordsMatch = computed(() => password.value === confirmPassword.value)

const canProceed = computed(() => {
  if (step.value === 'create') {
    return !passwordValidation.value && password.value.length >= 12
  }
  if (step.value === 'confirm') {
    return passwordsMatch.value && confirmPassword.value.length > 0
  }
  return false
})

// 操作
function goToConfirm() {
  if (!canProceed.value) return
  step.value = 'confirm'
}

async function createVault() {
  if (!passwordsMatch.value) return

  step.value = 'deriving'
  setupError.value = ''

  try {
    const result = await setupVault(password.value)
    recoveryKey.value = result.recoveryKey
    step.value = 'recovery'
  } catch (err) {
    setupError.value = `创建失败: ${err instanceof Error ? err.message : '未知错误'}`
    step.value = 'confirm'
  }
}

function goToCodes() {
  navigateTo('/codes')
}
</script>

<template>
  <div class="min-h-dvh flex flex-col items-center justify-center p-4">
    <div class="w-full max-w-sm space-y-8">
      <!-- Logo & 标题 -->
      <div class="text-center space-y-3">
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--ui-color-primary)]/10">
          <UIcon
            name="i-lucide-shield-check"
            class="w-8 h-8 text-[var(--ui-color-primary)]"
          />
        </div>
        <h1 class="text-2xl font-bold text-[var(--ui-text-highlighted)]">
          NekoVault
        </h1>
        <p class="text-sm text-[var(--ui-text-muted)]">
          设置你的主密码来保护金库
        </p>
      </div>

      <!-- 步骤 1：创建密码 -->
      <UCard v-if="step === 'create'">
        <template #header>
          <h2 class="text-lg font-semibold text-[var(--ui-text-highlighted)]">
            创建主密码
          </h2>
        </template>

        <div class="space-y-5">
          <UFormField
            label="主密码"
            :error="password.length > 0 ? passwordValidation ?? undefined : undefined"
          >
            <UInput
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="至少 12 个字符"
              size="lg"
              autofocus
              @keyup.enter="goToConfirm"
            >
              <template #trailing>
                <UButton
                  :icon="showPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  :padded="false"
                  @click="showPassword = !showPassword"
                />
              </template>
            </UInput>
          </UFormField>

          <!-- 密码强度 -->
          <div
            v-if="password.length > 0"
            class="space-y-2"
          >
            <div class="flex items-center justify-between">
              <span class="text-xs text-[var(--ui-text-muted)]">密码强度</span>
              <UBadge
                :color="strengthColors[passwordStrength.strength]"
                variant="subtle"
                size="xs"
              >
                {{ strengthLabels[passwordStrength.strength] }}
              </UBadge>
            </div>
            <div class="h-1.5 bg-[var(--ui-bg-elevated)] rounded-full overflow-hidden">
              <div
                class="h-full rounded-full transition-all duration-300"
                :class="{
                  'bg-red-500 w-1/4': passwordStrength.strength === 'weak',
                  'bg-amber-500 w-2/4': passwordStrength.strength === 'medium',
                  'bg-green-500 w-3/4': passwordStrength.strength === 'strong',
                  'bg-[var(--ui-color-primary)] w-full': passwordStrength.strength === 'very-strong'
                }"
              />
            </div>
          </div>

          <UButton
            block
            size="lg"
            :disabled="!canProceed"
            @click="goToConfirm"
          >
            继续
          </UButton>
        </div>
      </UCard>

      <!-- 步骤 2：确认密码 -->
      <UCard v-if="step === 'confirm'">
        <template #header>
          <div class="flex items-center gap-2">
            <UButton
              icon="i-lucide-arrow-left"
              color="neutral"
              variant="ghost"
              size="xs"
              @click="step = 'create'"
            />
            <h2 class="text-lg font-semibold text-[var(--ui-text-highlighted)]">
              确认主密码
            </h2>
          </div>
        </template>

        <div class="space-y-5">
          <UFormField
            label="再次输入主密码"
            :error="confirmPassword.length > 0 && !passwordsMatch ? '密码不一致' : undefined"
          >
            <UInput
              v-model="confirmPassword"
              type="password"
              placeholder="再次输入主密码"
              size="lg"
              autofocus
              @keyup.enter="createVault"
            />
          </UFormField>

          <UAlert
            v-if="setupError"
            color="error"
            variant="subtle"
            icon="i-lucide-alert-circle"
            :title="setupError"
          />

          <UButton
            block
            size="lg"
            :disabled="!canProceed"
            @click="createVault"
          >
            创建金库
          </UButton>
        </div>
      </UCard>

      <!-- 步骤 3：派生密钥中 -->
      <UCard v-if="step === 'deriving'">
        <div class="space-y-5 text-center py-8">
          <UIcon
            name="i-lucide-loader-2"
            class="w-12 h-12 text-[var(--ui-color-primary)] animate-spin mx-auto"
          />
          <div>
            <p class="text-lg font-medium text-[var(--ui-text-highlighted)]">
              正在生成加密密钥…
            </p>
            <p class="text-sm text-[var(--ui-text-muted)] mt-2">
              这可能需要几秒钟，请勿关闭页面
            </p>
          </div>
        </div>
      </UCard>

      <!-- 步骤 4：展示 Recovery Key -->
      <UCard v-if="step === 'recovery'">
        <div class="space-y-5">
          <div class="text-center">
            <UIcon
              name="i-lucide-check-circle"
              class="w-12 h-12 text-green-500 mx-auto"
            />
            <h2 class="text-lg font-semibold text-[var(--ui-text-highlighted)] mt-3">
              金库创建成功！
            </h2>
          </div>

          <UAlert
            color="warning"
            variant="subtle"
            icon="i-lucide-alert-triangle"
            title="请妥善保存以下恢复密钥"
            description="如果你忘记了主密码，可以使用此密钥恢复数据。请将它记录在安全的地方。"
          />

          <div class="bg-[var(--ui-bg-elevated)] rounded-lg p-4 text-center">
            <code class="text-lg font-mono font-bold tracking-wider text-[var(--ui-color-primary)] select-all">
              {{ recoveryKey }}
            </code>
          </div>

          <UButton
            block
            size="lg"
            @click="goToCodes"
          >
            我已安全保存，开始使用
          </UButton>
        </div>
      </UCard>
    </div>
  </div>
</template>

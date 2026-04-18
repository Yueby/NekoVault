<script setup lang="ts">
/**
 * TotpCard — 单个 TOTP 条目卡片（Grid Item）
 *
 * 显示 issuer、标签、验证码、倒计时环、复制按钮
 */
import type { TotpEntry } from '~/types/vault'
import { generateCode } from '~/composables/useTotp'

const props = defineProps<{
  entry: TotpEntry
}>()

const emit = defineEmits<{
  edit: [entry: TotpEntry]
  delete: [id: string]
}>()

const toast = useToast()
const vaultStore = useVaultStore()
const { remaining } = useCountdown(toRef(() => props.entry.period))

// 响应式验证码（每秒更新检查）
const code = ref(generateCode(props.entry))
const previousRemaining = ref(remaining.value)

// 检测周期切换时更新验证码
watch(remaining, (newVal) => {
  if (newVal > previousRemaining.value) {
    // 新周期开始
    code.value = generateCode(props.entry)
  }
  previousRemaining.value = newVal
})

// 也响应 entry 变化
watch(() => props.entry.secret, () => {
  code.value = generateCode(props.entry)
})

// 格式化验证码（中间加空格）
const formattedCode = computed(() => {
  const c = code.value
  if (c.length === 6) return `${c.slice(0, 3)} ${c.slice(3)}`
  if (c.length === 8) return `${c.slice(0, 4)} ${c.slice(4)}`
  return c
})

// 复制验证码
async function copyCode() {
  try {
    await navigator.clipboard.writeText(code.value)
    toast.add({ title: '验证码已复制', icon: 'i-lucide-check', color: 'success' })
    await vaultStore.markEntryUsed(props.entry.id)
  } catch {
    toast.add({ title: '复制失败', icon: 'i-lucide-x', color: 'error' })
  }
}

// 右键菜单
const contextItems = [
  [{
    label: '编辑',
    icon: 'i-lucide-pencil',
    onSelect: () => emit('edit', props.entry)
  }],
  [{
    label: '删除',
    icon: 'i-lucide-trash-2',
    color: 'error' as const,
    onSelect: () => emit('delete', props.entry.id)
  }]
]
</script>

<template>
  <VaultEntryCard
    :icon-name="entry.icon"
    :title="entry.accountName || entry.label"
    :subtitle="entry.issuer"
    :context-items="contextItems"
    @click="copyCode"
  >
    <!-- 倒计时圆环 -->
    <template #top-right>
      <CountdownRing
        :period="entry.period"
        :size="36"
        :stroke-width="2.5"
      />
    </template>

    <!-- 底部验证码块 -->
    <template #bottom>
      <span class="text-2xl font-mono font-bold tracking-[0.15em] text-[var(--ui-text-highlighted)]">
        {{ formattedCode }}
      </span>
    </template>
  </VaultEntryCard>
</template>

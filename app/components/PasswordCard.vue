<script setup lang="ts">
/**
 * PasswordCard — 单个账号密码条目卡片（Grid Item）
 *
 * 显示服务名称、账号、密码（默认隐藏）、复制按钮
 */
import type { PasswordEntry } from '~/types/vault'
import type { ContextMenuItem } from '~/components/VaultEntryCard.vue'
import { getMembershipInfo } from '~/utils/membership'

const props = defineProps<{
  entry: PasswordEntry
  /** 关联的 TOTP 条目 issuer（可选） */
  linkedTotpLabel?: string
}>()

const emit = defineEmits<{
  edit: [entry: PasswordEntry]
  delete: [id: string]
}>()

const toast = useToast()
const vaultStore = useVaultStore()
const showPassword = ref(false)

// 会员到期剩余时间（如用户开启了则展示），每分钟刷新一次
const now = useNow({ interval: 60_000 })
const membership = computed(() =>
  getMembershipInfo(props.entry.membershipExpiresAt, now.value.getTime())
)

// 复制账号
async function copyUsername() {
  try {
    await navigator.clipboard.writeText(props.entry.username)
    toast.add({ title: '账号已复制', icon: 'i-lucide-check', color: 'success' })
    await vaultStore.markPasswordUsed(props.entry.id)
  } catch {
    toast.add({ title: '复制失败', icon: 'i-lucide-x', color: 'error' })
  }
}

// 复制密码
async function copyPassword() {
  try {
    await navigator.clipboard.writeText(props.entry.password)
    toast.add({ title: '密码已复制', icon: 'i-lucide-check', color: 'success' })
    await vaultStore.markPasswordUsed(props.entry.id)
  } catch {
    toast.add({ title: '复制失败', icon: 'i-lucide-x', color: 'error' })
  }
}

// 右键菜单
const contextItems: ContextMenuItem[][] = [
  [{
    label: '复制账号',
    icon: 'i-lucide-user',
    onSelect: () => copyUsername()
  },
  {
    label: '复制密码',
    icon: 'i-lucide-key',
    onSelect: () => copyPassword()
  }],
  [{
    label: '编辑',
    icon: 'i-lucide-pencil',
    onSelect: () => emit('edit', props.entry)
  }],
  [{
    label: '删除',
    icon: 'i-lucide-trash-2',
    color: 'error',
    onSelect: () => emit('delete', props.entry.id)
  }]
]
</script>

<template>
  <VaultEntryCard
    :title="entry.username"
    :subtitle="entry.serviceName"
    :context-items="contextItems"
    @click="copyPassword"
  >
    <!-- 2FA 与会员剩余时间徽章 -->
    <template #badge>
      <UBadge
        v-if="linkedTotpLabel"
        color="primary"
        variant="subtle"
        size="xs"
        class="px-1 py-0 h-4 text-[10px]"
      >
        2FA
      </UBadge>
      <UBadge
        v-if="membership"
        :color="membership.color"
        variant="subtle"
        size="xs"
        icon="i-lucide-crown"
        class="px-1 py-0 h-4 text-[10px]"
        :title="`会员到期日：${membership.expiresAtLabel}`"
      >
        {{ membership.label }}
      </UBadge>
    </template>

    <!-- 复制账号快捷键 -->
    <template #title-trailing>
      <UButton
        icon="i-lucide-copy"
        color="neutral"
        variant="ghost"
        size="xs"
        class="lg:opacity-0 lg:group-hover:opacity-100 transition-opacity h-6 w-6"
        @click.stop="copyUsername"
      />
    </template>

    <!-- 底部密码行区 -->
    <template #bottom>
      <span class="text-sm font-mono text-[var(--ui-text-muted)] truncate select-all">
        {{ showPassword ? entry.password : '••••••••••••' }}
      </span>
      <div class="flex items-center gap-0.5 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
        <UButton
          :icon="showPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'"
          color="neutral"
          variant="ghost"
          size="xs"
          class="h-6 w-6"
          @click.stop="showPassword = !showPassword"
        />
      </div>
    </template>
  </VaultEntryCard>
</template>

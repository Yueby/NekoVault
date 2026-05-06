<script setup lang="ts">
/**
 * PasswordCard — 账号条目卡片（Grid Item）
 *
 * 显示服务名称、账号、密钥、复制按钮
 * 支持单密钥和多密钥。多密钥点击触发 select-secrets。
 */
import type { PasswordEntry } from '~/types/vault'
import type { ContextMenuItem } from '~/components/VaultEntryCard.vue'
import { getMembershipInfo } from '~/utils/membership'
import { getPasswordSecrets, DEFAULT_SECRET_ID } from '~/utils/password-secrets'

const props = defineProps<{
  entry: PasswordEntry
  /** 关联的 TOTP 条目 issuer（可选） */
  linkedTotpLabel?: string
  manualSortActive?: boolean
}>()

const emit = defineEmits<{
  edit: [entry: PasswordEntry]
  delete: [id: string]
  selectSecrets: [entry: PasswordEntry]
}>()

const toast = useToast()
const vaultStore = useVaultStore()
const showPassword = ref(false)

// 计算密钥列表
const secrets = computed(() => getPasswordSecrets(props.entry))
const isSingleSecret = computed(() => secrets.value.length <= 1)
const defaultSecret = computed(() => secrets.value.find(s => s.id === DEFAULT_SECRET_ID))

// 会员剩余时间，每分钟刷新一次
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

// 复制密钥值
async function copySecretValue(value: string, name: string = '密钥') {
  try {
    await navigator.clipboard.writeText(value)
    toast.add({ title: `${name}已复制`, icon: 'i-lucide-check', color: 'success' })
    await vaultStore.markPasswordUsed(props.entry.id)
  } catch {
    toast.add({ title: '复制失败', icon: 'i-lucide-x', color: 'error' })
  }
}

// 复制默认密钥
async function copyPassword() {
  const val = defaultSecret.value?.value ?? ''
  await copySecretValue(val, '密钥')
}

// 卡片点击：复制默认密钥，或请求展示多密钥
function handleCardClick() {
  if (isSingleSecret.value) {
    copyPassword()
  } else {
    emit('selectSecrets', props.entry)
  }
}

// 右键菜单
const contextItems = computed<ContextMenuItem[][]>(() => {
  const items: ContextMenuItem[][] = []

  // 第一组：复制账号
  const group1: ContextMenuItem[] = [
    {
      label: '复制账号',
      icon: 'i-lucide-user',
      onSelect: () => copyUsername()
    }
  ]

  // 单密钥：右键菜单可直接复制密钥；多密钥通过卡片点击打开选择弹层
  if (isSingleSecret.value) {
    group1.push({
      label: '复制密钥',
      icon: 'i-lucide-key',
      onSelect: () => copyPassword()
    })
  }

  items.push(group1)
  items.push([{
    label: '编辑',
    icon: 'i-lucide-pencil',
    onSelect: () => emit('edit', props.entry)
  }])
  items.push([{
    label: '删除',
    icon: 'i-lucide-trash-2',
    color: 'error',
    onSelect: () => emit('delete', props.entry.id)
  }])

  return items
})
</script>

<template>
  <div>
    <VaultEntryCard
      :title="entry.username"
      :subtitle="entry.serviceName"
      :context-items="contextItems"
      :manual-sort-active="manualSortActive"
      @click="handleCardClick"
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

      <!-- 底部密钥展示 -->
      <template #bottom>
        <!-- 单密钥：展示默认密钥 -->
        <template v-if="isSingleSecret">
          <span class="text-sm font-mono text-[var(--ui-text-muted)] truncate select-all">
            {{ showPassword ? (defaultSecret?.value ?? '') : '••••••••••••' }}
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

        <!-- 多密钥：只显示密钥数量 -->
        <template v-else>
          <span class="text-sm text-[var(--ui-text-muted)]">
            {{ `${secrets.length} 个密钥` }}
          </span>
        </template>
      </template>
    </VaultEntryCard>
  </div>
</template>

<script setup lang="ts">
/**
 * PasswordEditor — 账号密码编辑器（USlideover 内使用）
 *
 * 支持：服务名称 + 账号 + 密码 + 可选关联 TOTP + 备注
 */
import type { PasswordEntry } from '~/types/vault'
import {
  toLocalDateInputValue,
  parseLocalDateEndOfDay,
  getMembershipInfo
} from '~/utils/membership'

const props = defineProps<{
  /** 编辑模式时传入现有条目 */
  entry?: PasswordEntry
}>()

const emit = defineEmits<{
  save: [data: Omit<PasswordEntry, 'id' | 'createdAt' | 'updatedAt'>]
  cancel: []
}>()

const vaultStore = useVaultStore()

// 动态合成的分类选项（包含正在输入的新分类，解决回车不消失的问题）
const passwordPlatformOptions = computed(() => {
  const options = [...vaultStore.passwordPlatforms]
  if (form.serviceName && !options.includes(form.serviceName)) {
    options.unshift(form.serviceName)
  }
  return options
})

// 表单数据
const form = reactive({
  serviceName: props.entry?.serviceName ?? '',
  username: props.entry?.username ?? '',
  password: props.entry?.password ?? '',
  notes: props.entry?.notes ?? '',
  linkedTotpId: props.entry?.linkedTotpId ?? 'none',
  membershipEnabled: !!props.entry?.membershipExpiresAt,
  membershipExpires: toLocalDateInputValue(props.entry?.membershipExpiresAt)
})

// 编辑的条目变化时同步表单
watch(() => props.entry, (newEntry) => {
  form.serviceName = newEntry?.serviceName ?? ''
  form.username = newEntry?.username ?? ''
  form.password = newEntry?.password ?? ''
  form.notes = newEntry?.notes ?? ''
  form.linkedTotpId = newEntry?.linkedTotpId ?? 'none'
  form.membershipEnabled = !!newEntry?.membershipExpiresAt
  form.membershipExpires = toLocalDateInputValue(newEntry?.membershipExpiresAt)
})

// 启用会员提醒时若无日期，默认填 30 天后
watch(() => form.membershipEnabled, (enabled) => {
  if (enabled && !form.membershipExpires) {
    const defaultTs = Date.now() + 30 * 24 * 60 * 60 * 1000
    form.membershipExpires = toLocalDateInputValue(defaultTs)
  }
})

// 预览的剩余时间信息
const membershipPreview = computed(() => {
  if (!form.membershipEnabled) return null
  const ts = parseLocalDateEndOfDay(form.membershipExpires)
  return getMembershipInfo(ts)
})

const showPassword = ref(false)

// 可选关联的 TOTP 条目列表
const totpLinkOptions = computed(() => {
  const options: Array<{ label: string, value: string }> = [
    { label: '不关联', value: 'none' }
  ]
  for (const entry of vaultStore.entries) {
    options.push({
      label: entry.accountName || entry.issuer || entry.label,
      value: entry.id
    })
  }
  return options
})

// 校验
const isValid = computed(() => {
  if (form.username.length === 0 || form.password.length === 0) return false
  // 开启会员提醒则要求日期必须合法
  if (form.membershipEnabled && !parseLocalDateEndOfDay(form.membershipExpires)) return false
  return true
})

function handleSave() {
  if (!isValid.value) return
  const membershipExpiresAt = form.membershipEnabled
    ? parseLocalDateEndOfDay(form.membershipExpires)
    : undefined
  emit('save', {
    serviceName: form.serviceName,
    username: form.username,
    password: form.password,
    notes: form.notes || undefined,
    linkedTotpId: form.linkedTotpId === 'none' ? undefined : form.linkedTotpId,
    membershipExpiresAt
  })
}
</script>

<template>
  <div class="space-y-5">
    <!-- 核心字段 -->
    <UFormField
      label="分类/平台"
      hint="可选"
    >
      <div
        @keydown.home.capture.stop
        @keydown.end.capture.stop
      >
        <UInputMenu
          v-model="form.serviceName"
          :items="passwordPlatformOptions"
          placeholder="下拉选择或输入新分类名"
          size="lg"
          autofocus
          class="w-full"
          create-item
          @create="(val: string) => { form.serviceName = val }"
        >
          <template #create-item-label="{ item }">
            <span class="truncate">新建分类: "{{ item }}"</span>
          </template>
        </UInputMenu>
      </div>
    </UFormField>

    <UFormField
      label="账号"
      required
    >
      <UInput
        v-model="form.username"
        placeholder="用户名或邮箱"
        size="lg"
        icon="i-lucide-user"
      />
    </UFormField>

    <UFormField
      label="密码"
      required
    >
      <UInput
        v-model="form.password"
        :type="showPassword ? 'text' : 'password'"
        placeholder="输入密码"
        size="lg"
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

    <!-- 可选关联 -->
    <UFormField
      label="关联验证码"
      hint="可选"
    >
      <USelectMenu
        v-model="form.linkedTotpId"
        :items="totpLinkOptions"
        size="lg"
        class="w-full"
        value-key="value"
        :search-input="{ placeholder: '搜索关联账号...' }"
      />
    </UFormField>

    <!-- 会员到期提醒（可选） -->
    <UFormField label="会员到期提醒">
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <span class="text-sm text-[var(--ui-text-muted)]">
            显示会员/订阅剩余时间
          </span>
          <USwitch v-model="form.membershipEnabled" />
        </div>
        <div
          v-if="form.membershipEnabled"
          class="space-y-2"
        >
          <UInput
            v-model="form.membershipExpires"
            type="date"
            size="lg"
            icon="i-lucide-calendar"
            class="w-full"
          />
          <div
            v-if="membershipPreview"
            class="flex items-center gap-2 text-xs"
          >
            <UBadge
              :color="membershipPreview.color"
              variant="subtle"
              size="sm"
            >
              {{ membershipPreview.label }}
            </UBadge>
            <span class="text-[var(--ui-text-muted)]">
              到期日：{{ membershipPreview.expiresAtLabel }}
            </span>
          </div>
        </div>
      </div>
    </UFormField>

    <UFormField
      label="备注"
      hint="可选"
    >
      <UTextarea
        v-model="form.notes"
        placeholder="额外备注信息"
        :rows="2"
      />
    </UFormField>

    <!-- 操作按钮 -->
    <div class="flex gap-3 pt-2">
      <UButton
        block
        color="neutral"
        variant="outline"
        size="lg"
        @click="emit('cancel')"
      >
        取消
      </UButton>
      <UButton
        block
        size="lg"
        :disabled="!isValid"
        @click="handleSave"
      >
        {{ entry ? '保存修改' : '添加' }}
      </UButton>
    </div>
  </div>
</template>

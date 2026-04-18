<script setup lang="ts">
/**
 * PasswordEditor — 账号密码编辑器（USlideover 内使用）
 *
 * 支持：服务名称 + 账号 + 密码 + 可选关联 TOTP + 备注
 */
import type { PasswordEntry } from '~/types/vault'

const props = defineProps<{
  /** 编辑模式时传入现有条目 */
  entry?: PasswordEntry
}>()

const emit = defineEmits<{
  save: [data: Omit<PasswordEntry, 'id' | 'createdAt' | 'updatedAt'>]
  cancel: []
}>()

const vaultStore = useVaultStore()

// 表单数据
const form = reactive({
  serviceName: props.entry?.serviceName ?? '',
  username: props.entry?.username ?? '',
  password: props.entry?.password ?? '',
  notes: props.entry?.notes ?? '',
  linkedTotpId: props.entry?.linkedTotpId ?? 'none'
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
  return form.username.length > 0 && form.password.length > 0
})

function handleSave() {
  if (!isValid.value) return
  emit('save', {
    serviceName: form.serviceName,
    username: form.username,
    password: form.password,
    notes: form.notes || undefined,
    linkedTotpId: form.linkedTotpId === 'none' ? undefined : form.linkedTotpId
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
      <UInputMenu
        v-model="form.serviceName"
        :items="vaultStore.passwordPlatforms"
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
        value-key="value"
        searchable
        searchable-placeholder="搜索关联账号…"
      />
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

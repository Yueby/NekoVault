<script setup lang="ts">
/**
 * EntryEditor — 验证码条目编辑器（弹层内使用）
 *
 * 支持：粘贴 otpauth:// URI 自动填充 / 手动输入（名称 + 密钥 + 类型）
 */
import type { TotpEntry, TotpAlgorithm } from '~/types/vault'
import { parseOtpauthUri } from '~/composables/useTotp'

const props = defineProps<{
  /** 编辑模式时传入现有条目 */
  entry?: TotpEntry
}>()

const emit = defineEmits<{
  save: [data: Omit<TotpEntry, 'id' | 'createdAt' | 'updatedAt'>, linkedPasswordId?: string]
  cancel: []
}>()

const toast = useToast()
const vaultStore = useVaultStore()

// 动态合成的分类选项（包含正在输入的新分类，解决回车不消失的问题）
const totpPlatformOptions = computed(() => {
  const options = [...vaultStore.totpPlatforms]
  if (form.issuer && !options.includes(form.issuer)) {
    options.unshift(form.issuer)
  }
  return options
})

function formatAccountLabel(serviceName: string, username: string): string {
  return serviceName ? `${serviceName} · ${username}` : username
}

function normalizeAccountValue(value: string): string {
  return value.trim().toLowerCase()
}

// 可选账户建议：选择后自动关联到对应密码条目；也允许直接输入新账户
const accountOptions = computed(() => {
  return vaultStore.passwords.map(entry => ({
    label: formatAccountLabel(entry.serviceName, entry.username),
    value: entry.id,
    serviceName: entry.serviceName,
    username: entry.username
  }))
})

const accountInputOptions = computed(() => accountOptions.value.map(option => option.label))

const accountOptionByLabel = computed(() => {
  return new Map(accountOptions.value.map(option => [option.label, option]))
})

// 表单数据
const form = reactive({
  label: props.entry?.label ?? '',
  issuer: props.entry?.issuer ?? '',
  accountName: props.entry?.accountName ?? '',
  secret: props.entry?.secret ?? '',
  digits: props.entry?.digits ?? 6,
  period: props.entry?.period ?? 30,
  algorithm: (props.entry?.algorithm ?? 'SHA1') as TotpAlgorithm,
  linkedPasswordId: 'none'
})

const linkedAccount = computed(() => {
  return form.linkedPasswordId === 'none'
    ? undefined
    : accountOptions.value.find(option => option.value === form.linkedPasswordId)
})

const accountFieldHint = computed(() => {
  return linkedAccount.value
    ? `已关联：${linkedAccount.value.label}`
    : '可选择已有账号自动关联，或直接输入账户名'
})

let isApplyingAccountSelection = false

function findMatchingAccountId(): string | undefined {
  const accountName = normalizeAccountValue(form.accountName)
  const issuer = normalizeAccountValue(form.issuer)
  if (!accountName || !issuer) return undefined

  return accountOptions.value.find(option =>
    normalizeAccountValue(option.username) === accountName
    && normalizeAccountValue(option.serviceName) === issuer
  )?.value
}

function syncLinkedAccountFromFields() {
  form.linkedPasswordId = findMatchingAccountId() ?? 'none'
}

function applyAccountSelection(label: string) {
  const option = accountOptionByLabel.value.get(label)
  if (!option) return false

  isApplyingAccountSelection = true
  form.issuer = option.serviceName
  form.accountName = option.username
  form.linkedPasswordId = option.value
  void nextTick(() => {
    isApplyingAccountSelection = false
  })
  return true
}

function handleAccountCreate(value: string) {
  form.accountName = value
  syncLinkedAccountFromFields()
}

// 所编辑的 entry 变化时同步更新 form
watch(() => props.entry, (newEntry) => {
  form.label = newEntry?.label ?? ''
  form.issuer = newEntry?.issuer ?? ''
  form.accountName = newEntry?.accountName ?? ''
  form.secret = newEntry?.secret ?? ''
  form.digits = newEntry?.digits ?? 6
  form.period = newEntry?.period ?? 30
  form.algorithm = (newEntry?.algorithm ?? 'SHA1') as TotpAlgorithm

  if (newEntry) {
    const linkedPw = vaultStore.passwords.find(p => p.linkedTotpId === newEntry.id)
    form.linkedPasswordId = linkedPw ? linkedPw.id : 'none'
  } else {
    form.linkedPasswordId = 'none'
  }
}, { immediate: true })

const showAdvanced = ref(false)
const pasteInput = ref('')

// 检测粘贴的 otpauth URI
watch(pasteInput, (val) => {
  if (val.startsWith('otpauth://totp/')) {
    const parsed = parseOtpauthUri(val)
    if (parsed) {
      form.label = parsed.label ?? ''
      form.issuer = parsed.issuer ?? ''
      form.accountName = parsed.accountName ?? ''
      form.secret = parsed.secret ?? ''
      form.digits = parsed.digits ?? 6
      form.period = parsed.period ?? 30
      form.algorithm = parsed.algorithm ?? 'SHA1'
      syncLinkedAccountFromFields()
      pasteInput.value = ''
      toast.add({ title: 'URI 解析成功', icon: 'i-lucide-check', color: 'success' })
    }
  }
})

// 智能拆分：如果用户在名称里输入了“服务名:账号”的格式，自动帮他分发到对应的字段
watch(() => form.issuer, (val) => {
  if (val.includes(':') && !form.accountName) {
    const parts = val.split(':')
    form.issuer = parts[0]?.trim() ?? ''
    form.accountName = parts.slice(1).join(':').trim()
    toast.add({ title: '已自动为你拆分识别出服务商与账号', icon: 'i-lucide-sparkles', color: 'primary' })
  }

  if (!isApplyingAccountSelection) {
    syncLinkedAccountFromFields()
  }
})

watch(() => form.accountName, (val) => {
  if (applyAccountSelection(val)) return
  if (!isApplyingAccountSelection) {
    syncLinkedAccountFromFields()
  }
})

// Secret 自动格式化
watch(() => form.secret, (val) => {
  form.secret = val.replace(/\s/g, '').toUpperCase()
})

// 校验
const isSecretValid = computed(() => {
  return form.secret.length > 0 && /^[A-Z2-7]+=*$/.test(form.secret)
})

const isValid = computed(() => {
  return form.accountName.trim().length > 0 && isSecretValid.value
})

function handleSave() {
  if (!isValid.value) return
  form.issuer = form.issuer.trim()
  form.accountName = form.accountName.trim()
  form.label = form.issuer ? `${form.issuer}:${form.accountName}` : form.accountName

  const { linkedPasswordId, ...data } = form
  emit('save', data, linkedPasswordId === 'none' ? undefined : linkedPasswordId)
}

const algorithmOptions = [
  { label: 'SHA-1', value: 'SHA1' },
  { label: 'SHA-256', value: 'SHA256' },
  { label: 'SHA-512', value: 'SHA512' }
]

const digitOptions = [
  { label: '6 位', value: 6 },
  { label: '8 位', value: 8 }
]
</script>

<template>
  <div class="space-y-5">
    <!-- URI 快速导入 -->
    <UFormField
      label="快速导入"
      hint="粘贴 otpauth:// URI 自动填充"
    >
      <UInput
        v-model="pasteInput"
        placeholder="otpauth://totp/..."
        icon="i-lucide-link"
        size="lg"
      />
    </UFormField>

    <USeparator label="或手动输入" />

    <!-- 核心字段（简洁） -->
    <UFormField
      label="分类/平台"
      hint="可选"
    >
      <div
        @keydown.home.capture.stop
        @keydown.end.capture.stop
      >
        <UInputMenu
          v-model="form.issuer"
          :items="totpPlatformOptions"
          placeholder="如 GitHub、Google（可用于分类过滤）"
          size="lg"
          class="w-full"
          create-item
          @create="(val: string) => { form.issuer = val }"
        >
          <template #create-item-label="{ item }">
            <span class="truncate">新建分类: "{{ item }}"</span>
          </template>
        </UInputMenu>
      </div>
    </UFormField>

    <UFormField
      label="账户"
      required
      :hint="accountFieldHint"
      :error="form.accountName.length > 0 && !form.accountName.trim() ? '请输入有效账户名' : undefined"
    >
      <UInputMenu
        v-model="form.accountName"
        :items="accountInputOptions"
        placeholder="选择已有账号或输入账户名"
        size="lg"
        class="w-full"
        create-item
        @create="handleAccountCreate"
      >
        <template #create-item-label="{ item }">
          <span class="truncate">使用账户: "{{ item }}"</span>
        </template>
      </UInputMenu>
    </UFormField>

    <UFormField
      label="密钥 (Secret)"
      required
      :error="form.secret.length > 0 && !isSecretValid ? '无效的 Base32 密钥' : undefined"
    >
      <UInput
        v-model="form.secret"
        placeholder="Base32 格式密钥"
        size="lg"
        font="mono"
      />
    </UFormField>

    <!-- 高级选项（折叠） -->
    <UButton
      :icon="showAdvanced ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
      color="neutral"
      variant="ghost"
      size="sm"
      @click="showAdvanced = !showAdvanced"
    >
      高级选项
    </UButton>

    <div
      v-if="showAdvanced"
      class="space-y-4 pl-3 border-l-2 border-[var(--ui-border)]"
    >
      <div class="grid grid-cols-2 gap-4">
        <UFormField label="位数">
          <USelect
            v-model="form.digits"
            :items="digitOptions"
            size="lg"
            value-key="value"
          />
        </UFormField>

        <UFormField label="周期 (秒)">
          <UInput
            v-model.number="form.period"
            type="number"
            :min="10"
            :max="120"
            size="lg"
          />
        </UFormField>
      </div>

      <UFormField label="算法">
        <USelect
          v-model="form.algorithm"
          :items="algorithmOptions"
          size="lg"
          value-key="value"
        />
      </UFormField>
    </div>

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

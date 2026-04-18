<script setup lang="ts">
/**
 * EntryEditor — 验证码条目编辑器（USlideover 内使用）
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
  save: [data: Omit<TotpEntry, 'id' | 'createdAt' | 'updatedAt'>]
  cancel: []
}>()

const toast = useToast()
const vaultStore = useVaultStore()

// 表单数据
const form = reactive({
  label: props.entry?.label ?? '',
  issuer: props.entry?.issuer ?? '',
  accountName: props.entry?.accountName ?? '',
  secret: props.entry?.secret ?? '',
  digits: props.entry?.digits ?? 6,
  period: props.entry?.period ?? 30,
  algorithm: (props.entry?.algorithm ?? 'SHA1') as TotpAlgorithm
})

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
    toast.add({ title: '✨ 已自动为你拆分识别出服务商与账号', color: 'primary' })
  }
})

// Secret 自动格式化
watch(() => form.secret, (val) => {
  form.secret = val.replace(/\s/g, '').toUpperCase()
})

// 校验
const isValid = computed(() => {
  return form.secret.length > 0 && /^[A-Z2-7]+=*$/.test(form.secret)
})

function handleSave() {
  if (!isValid.value) return
  if (!form.label) {
    if (form.issuer) {
      form.label = form.accountName ? `${form.issuer}:${form.accountName}` : form.issuer
    } else {
      form.label = form.accountName ? form.accountName : '未命名验证码'
    }
  }
  emit('save', { ...form })
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
      <UInputMenu
        v-model="form.issuer"
        :items="vaultStore.totpPlatforms"
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
    </UFormField>

    <UFormField
      label="密钥 (Secret)"
      required
      :error="form.secret.length > 0 && !isValid ? '无效的 Base32 密钥' : undefined"
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
      <UFormField label="账户名">
        <UInput
          v-model="form.accountName"
          placeholder="如 user@example.com"
          size="lg"
        />
      </UFormField>

      <UFormField label="标签 (Label)">
        <UInput
          v-model="form.label"
          placeholder="自动生成"
          size="lg"
        />
      </UFormField>

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

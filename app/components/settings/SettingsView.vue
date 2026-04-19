<script setup lang="ts">
import { toOtpauthUri } from '~/composables/useTotp'
import { clearAllLocalData, getLocalSnapshot } from '~/utils/local-db'

const vaultStore = useVaultStore()
const { lockVault } = useSession()
const toast = useToast()
const config = useRuntimeConfig()
const appVersion = config.public.version

const autoLockOptions = [
  { label: '1 分钟', value: 1 },
  { label: '5 分钟', value: 5 },
  { label: '15 分钟', value: 15 },
  { label: '30 分钟', value: 30 },
  { label: '从不', value: 0 }
]
const selectedAutoLock = ref(vaultStore.preferences.autoLockMinutes)
watch(selectedAutoLock, async (val) => {
  await vaultStore.updatePreferences({ autoLockMinutes: val })
  toast.add({ title: '自动锁定设置已更新', icon: 'i-lucide-check', color: 'success' })
})

const sortOptions = [
  { label: '字母顺序', value: 'alpha' },
  { label: '最近使用', value: 'recent' },
  { label: '手动排序', value: 'manual' }
]
const selectedSort = ref(vaultStore.preferences.sortMode)
watch(selectedSort, async (val) => {
  await vaultStore.updatePreferences({ sortMode: val as 'alpha' | 'recent' | 'manual' })
})

async function exportEncrypted() {
  try {
    const vault = vaultStore.decryptedVault
    if (!vault) return
    const snapshot = await getLocalSnapshot()
    if (!snapshot) {
      toast.add({ title: '无可导出的数据', icon: 'i-lucide-x', color: 'error' })
      return
    }
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `nekovault-backup-${new Date().toISOString().slice(0, 10)}.nekovault`
    a.click()
    URL.revokeObjectURL(url)
    toast.add({ title: '加密备份已导出', icon: 'i-lucide-download', color: 'success' })
  } catch (err) {
    toast.add({ title: `导出失败: ${err instanceof Error ? err.message : '未知错误'}`, icon: 'i-lucide-x', color: 'error' })
  }
}

// 明文导出 — 需二次密码验证
const plaintextExportConfirm = ref(false)
const exportPassword = ref('')
const exportVerifying = ref(false)
const exportError = ref('')

async function verifyAndExportPlaintext() {
  if (!exportPassword.value) return
  exportVerifying.value = true
  exportError.value = ''

  try {
    // 用输入的访问密钥作为 admin-token 远程验证
    try {
      await $fetch('/api/vault/verify', {
        method: 'POST',
        headers: {
          'x-admin-token': exportPassword.value
        }
      })
    } catch {
      exportError.value = '访问密钥错误'
      return
    }

    // 验证通过，执行导出
    const vault = vaultStore.decryptedVault
    if (!vault) return

    // 收集所有导出行：TOTP URI + 密码条目
    const lines: string[] = []

    // TOTP 条目 → otpauth URI
    lines.push('# === TOTP 验证码 ===')
    for (const entry of vault.entries) {
      lines.push(toOtpauthUri(entry))
    }

    // 密码条目 → 结构化文本
    if (vault.passwords && vault.passwords.length > 0) {
      lines.push('')
      lines.push('# === 账号密码 ===')
      for (const pw of vault.passwords) {
        lines.push(`# ${pw.serviceName || '未分类'} | ${pw.username} | ${pw.password}${pw.notes ? ` | ${pw.notes}` : ''}`)
      }
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `nekovault-export-${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)

    plaintextExportConfirm.value = false
    exportPassword.value = ''
    toast.add({ title: '明文导出完成', description: '请安全保管并尽快删除该文件', icon: 'i-lucide-alert-triangle', color: 'warning' })
  } catch {
    exportError.value = '验证失败'
  } finally {
    exportVerifying.value = false
  }
}

function closePlaintextModal() {
  plaintextExportConfirm.value = false
  exportPassword.value = ''
  exportError.value = ''
}

const resetConfirm = ref(false)
async function resetLocalData() {
  await clearAllLocalData()
  resetConfirm.value = false
  toast.add({ title: '本地数据已清除', icon: 'i-lucide-check', color: 'success' })
  lockVault()
}

const entryCount = computed(() => vaultStore.entries.length)
const passwordCount = computed(() => vaultStore.passwords.length)

// 版本检查
const isCheckingVersion = ref(false)
const hasNewVersion = ref(false)
const latestVersion = ref('')

async function checkForUpdates() {
  if (isCheckingVersion.value) return
  isCheckingVersion.value = true
  try {
    const res = await fetch('https://raw.githubusercontent.com/Yueby/NekoVault/main/package.json', { cache: 'no-store' })
    if (!res.ok) throw new Error('Fetch failed')
    const data = (await res.json()) as { version: string }
    latestVersion.value = data.version

    if (data.version !== appVersion) {
      hasNewVersion.value = true
      toast.add({
        title: `发现新版本 v${data.version}`,
        description: 'GitHub 仓库已有新版本发布。',
        color: 'primary',
        icon: 'i-lucide-arrow-up-circle'
      })
    } else {
      hasNewVersion.value = false
      toast.add({ title: '当前已是最新版本', color: 'success', icon: 'i-lucide-check-circle' })
    }
  } catch {
    toast.add({ title: '检查更新失败', description: '无法连接到 GitHub', color: 'error', icon: 'i-lucide-x-circle' })
  } finally {
    isCheckingVersion.value = false
  }
}

function openReleases() {
  window.open('https://github.com/Yueby/NekoVault/releases', '_blank')
}
</script>

<template>
  <div class="space-y-4 max-w-lg mx-auto w-full">
    <!-- 存储状态 -->
    <UCard>
      <template #header>
        <h2 class="text-sm font-semibold text-[var(--ui-text-highlighted)]">
          存储状态
        </h2>
      </template>
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <span class="text-sm text-[var(--ui-text-muted)]">保存验证码</span>
          <UIcon
            name="i-lucide-shield-check"
            class="w-5 h-5 text-[var(--ui-color-primary)]"
          />
        </div>
        <div class="text-3xl font-bold text-[var(--ui-text-highlighted)]">
          {{ entryCount }}
        </div>
        <USeparator />
        <div class="flex items-center justify-between">
          <span class="text-sm text-[var(--ui-text-muted)]">保存账号密码</span>
          <UIcon
            name="i-lucide-key-round"
            class="w-5 h-5 text-[var(--ui-color-primary)]"
          />
        </div>
        <div class="text-3xl font-bold text-[var(--ui-text-highlighted)]">
          {{ passwordCount }}
        </div>
      </div>
    </UCard>

    <!-- 偏好设置 -->
    <UCard>
      <template #header>
        <h2 class="text-sm font-semibold text-[var(--ui-text-highlighted)]">
          偏好设置
        </h2>
      </template>
      <div class="space-y-5">
        <UFormField label="空闲自动锁定">
          <USelect
            v-model="selectedAutoLock"
            :items="autoLockOptions"
            size="lg"
            value-key="value"
          />
        </UFormField>
        <UFormField label="排序方式">
          <USelect
            v-model="selectedSort"
            :items="sortOptions"
            size="lg"
            value-key="value"
          />
        </UFormField>
        <UButton
          icon="i-lucide-lock"
          color="neutral"
          variant="outline"
          block
          @click="lockVault"
        >
          立即锁定
        </UButton>
      </div>
    </UCard>

    <!-- 数据管理 -->
    <UCard>
      <template #header>
        <h2 class="text-sm font-semibold text-[var(--ui-text-highlighted)]">
          数据管理
        </h2>
      </template>
      <div class="space-y-3">
        <UButton
          icon="i-lucide-download"
          color="neutral"
          variant="outline"
          block
          @click="exportEncrypted"
        >
          导出加密备份
        </UButton>
        <UButton
          icon="i-lucide-file-text"
          color="warning"
          variant="outline"
          block
          @click="plaintextExportConfirm = true"
        >
          导出明文
        </UButton>
        <USeparator />
        <UButton
          icon="i-lucide-trash-2"
          color="error"
          variant="outline"
          block
          @click="resetConfirm = true"
        >
          重置本地数据
        </UButton>
      </div>
    </UCard>

    <!-- 底部版本信息 -->
    <div class="flex flex-col items-center justify-center space-y-2 mt-10">
      <div class="flex items-center gap-2">
        <img src="/logo.svg" alt="NekoVault Logo" class="w-4 h-4 shrink-0 opacity-80" />
        <span class="text-sm font-semibold text-[var(--ui-text-highlighted)]">NekoVault</span>
        <UTooltip :text="hasNewVersion ? `发现新版本 v${latestVersion}，点击前往 GitHub` : '点击检查更新'">
          <UBadge
            color="neutral"
            variant="soft"
            size="sm"
            class="cursor-pointer transition-all select-none"
            :class="hasNewVersion ? 'bg-[var(--ui-color-primary)]/15 text-[var(--ui-color-primary)] ring-1 ring-[var(--ui-color-primary)]/30' : ''"
            @click="hasNewVersion ? openReleases() : checkForUpdates()"
          >
            v{{ appVersion || '1.0.0' }}
            <UIcon
              v-if="isCheckingVersion"
              name="i-lucide-loader-2"
              class="w-3.5 h-3.5 ml-1 animate-spin"
            />
            <UIcon
              v-else-if="hasNewVersion"
              name="i-lucide-arrow-up-circle"
              class="w-3.5 h-3.5 ml-1 animate-bounce"
            />
          </UBadge>
        </UTooltip>
      </div>
    </div>

    <!-- 设置相关 Modal -->
    <UModal
      v-model:open="plaintextExportConfirm"
      title="危险操作"
      description="明文导出将暴露所有的 TOTP 密钥和密码文本！"
      @close="closePlaintextModal"
    >
      <template #body>
        <div class="space-y-4">
          <UAlert
            color="error"
            variant="subtle"
            icon="i-lucide-alert-triangle"
            title="导出的文件包含未加密的密钥信息，任何人获得该文件均可访问你的账户。"
          />
          <UFormField
            label="请输入访问密钥确认身份"
            :error="exportError || undefined"
          >
            <UInput
              v-model="exportPassword"
              type="password"
              placeholder="访问密钥"
              size="lg"
              :disabled="exportVerifying"
              @keyup.enter="verifyAndExportPlaintext"
            />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex gap-3 w-full">
          <UButton
            block
            color="neutral"
            variant="outline"
            :disabled="exportVerifying"
            @click="closePlaintextModal"
          >
            取消
          </UButton>
          <UButton
            block
            color="error"
            :loading="exportVerifying"
            :disabled="!exportPassword"
            @click="verifyAndExportPlaintext"
          >
            {{ exportVerifying ? '验证中…' : '确认导出' }}
          </UButton>
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="resetConfirm"
      title="确认重置"
      description="这将清除当前设备上的所有本地数据。远程数据不受影响。"
    >
      <template #footer>
        <div class="flex gap-3 w-full">
          <UButton
            block
            color="neutral"
            variant="outline"
            @click="resetConfirm = false"
          >
            取消
          </UButton>
          <UButton
            block
            color="error"
            @click="resetLocalData"
          >
            确认重置
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

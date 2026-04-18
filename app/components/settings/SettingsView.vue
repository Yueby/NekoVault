<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { toOtpauthUri } from '~/composables/useTotp'
import { clearAllLocalData } from '~/utils/local-db'

const vaultStore = useVaultStore()
const { lockVault } = useSession()
const toast = useToast()

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
    const { getLocalSnapshot } = await import('~/utils/local-db')
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

const plaintextExportConfirm = ref(false)
async function exportPlaintext() {
  const vault = vaultStore.decryptedVault
  if (!vault) return
  const lines = vault.entries.map(entry => toOtpauthUri(entry))
  const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `nekovault-export-${new Date().toISOString().slice(0, 10)}.txt`
  a.click()
  URL.revokeObjectURL(url)
  plaintextExportConfirm.value = false
  toast.add({ title: '明文导出完成', description: '请安全保管并尽快删除该文件', icon: 'i-lucide-alert-triangle', color: 'warning' })
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

    <!-- 关于 -->
    <UCard>
      <div class="space-y-2 text-center text-sm text-[var(--ui-text-muted)]">
        <p class="font-semibold text-[var(--ui-text-highlighted)]">
          NekoVault v1.0
        </p>
        <p>安全的个人验证码与密码管理器</p>
        <p>数据端到端加密，服务端仅存密文</p>
      </div>
    </UCard>

    <!-- 设置相关 Modal -->
    <UModal
      v-model:open="plaintextExportConfirm"
      title="危险操作"
      description="明文导出将暴露所有的 TOTP 密钥和密码文本！"
    >
      <template #body>
        <UAlert
          color="error"
          variant="subtle"
          icon="i-lucide-alert-triangle"
          title="导出的文件包含未加密的密钥信息，任何人获得该文件均可访问你的账户。"
        />
      </template>
      <template #footer>
        <div class="flex gap-3 w-full">
          <UButton
            block
            color="neutral"
            variant="outline"
            @click="plaintextExportConfirm = false"
          >
            取消
          </UButton>
          <UButton
            block
            color="error"
            @click="exportPlaintext"
          >
            确认导出
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

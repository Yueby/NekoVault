<script setup lang="ts">
import { computed, ref } from 'vue'
import type { PasswordEntry } from '~/types/vault'
import { useDebounceRef } from '~/composables/useDebounce'

const vaultStore = useVaultStore()
const toast = useToast()

const searchQuery = useDebounceRef('', 200)
const selectedPlatform = ref('所有分类')

const filterOptions = computed(() => [
  '所有分类',
  '未分类',
  ...vaultStore.passwordPlatforms
])

const filteredPasswords = computed(() => {
  let entries = vaultStore.sortedPasswords

  if (selectedPlatform.value === '未分类') {
    entries = entries.filter(e => !e.serviceName)
  } else if (selectedPlatform.value !== '所有分类') {
    entries = entries.filter(e => e.serviceName === selectedPlatform.value)
  }

  const query = searchQuery.value.toLowerCase().trim()
  if (!query) return entries
  return entries.filter(entry =>
    (entry.serviceName || '').toLowerCase().includes(query)
    || (entry.username || '').toLowerCase().includes(query)
  )
})

const showControls = computed(() => vaultStore.passwords.length > 0)

// ============================================================
// 密码编辑器
// ============================================================
const passwordEditorOpen = ref(false)
const editingPassword = ref<PasswordEntry | undefined>()

function openAddPassword() {
  editingPassword.value = undefined
  passwordEditorOpen.value = true
}

function openEditPassword(entry: PasswordEntry) {
  editingPassword.value = entry
  passwordEditorOpen.value = true
}

async function handleSavePassword(data: Omit<PasswordEntry, 'id' | 'createdAt' | 'updatedAt'>) {
  try {
    if (editingPassword.value) {
      await vaultStore.updatePassword(editingPassword.value.id, data)
      toast.add({ title: '账号已更新', icon: 'i-lucide-check', color: 'success' })
    } else {
      await vaultStore.addPassword(data)
      toast.add({ title: '账号已添加', icon: 'i-lucide-check', color: 'success' })
    }
    passwordEditorOpen.value = false
  } catch (err) {
    toast.add({ title: `操作失败: ${err instanceof Error ? err.message : '未知错误'}`, icon: 'i-lucide-x', color: 'error' })
  }
}

const deletePasswordOpen = ref(false)
const deletingPasswordId = ref('')

function confirmDeletePassword(id: string) {
  deletingPasswordId.value = id
  deletePasswordOpen.value = true
}

async function handleDeletePassword() {
  try {
    await vaultStore.deletePassword(deletingPasswordId.value)
    toast.add({ title: '账号已删除', icon: 'i-lucide-check', color: 'success' })
  } catch (err) {
    toast.add({ title: `删除失败: ${err instanceof Error ? err.message : '未知错误'}`, icon: 'i-lucide-x', color: 'error' })
  }
  deletePasswordOpen.value = false
}

function getLinkedTotpLabel(linkedId?: string): string | undefined {
  if (!linkedId) return undefined
  const totp = vaultStore.entries.find(e => e.id === linkedId)
  return totp?.issuer || totp?.label
}

// 供外部环境调用
defineExpose({
  openAddPassword
})
</script>

<template>
  <div class="flex flex-col flex-1">
    <!-- 工具栏（搜索与过滤） -->
    <div
      v-if="showControls"
      class="sticky top-[3.5rem] z-40 bg-[var(--ui-bg)]/80 backdrop-blur-xl mb-3 flex items-center gap-2"
    >
      <UInput
        v-model="searchQuery"
        icon="i-lucide-search"
        placeholder="搜索账号…"
        size="sm"
        class="flex-1"
      />
      <USelectMenu
        v-model="selectedPlatform"
        :items="filterOptions"
        size="sm"
        class="w-32 shrink-0 sm:w-40"
      />
    </div>

    <!-- 列表或空状态 -->
    <div
      v-if="vaultStore.passwords.length === 0"
      class="flex-1 flex flex-col items-center justify-center space-y-4 min-h-[60vh] lg:min-h-[40vh]"
    >
      <div class="w-16 h-16 rounded-2xl bg-[var(--ui-color-primary)]/10 flex items-center justify-center">
        <UIcon
          name="i-lucide-key-round"
          class="w-8 h-8 text-[var(--ui-color-primary)]/50"
        />
      </div>
      <p class="text-[var(--ui-text-muted)]">
        还没有账号密码
      </p>
    </div>

    <div
      v-else-if="filteredPasswords.length === 0 && searchQuery"
      class="flex-1 flex flex-col items-center justify-center space-y-4 min-h-[60vh] lg:min-h-[40vh]"
    >
      <UIcon
        name="i-lucide-search-x"
        class="w-12 h-12 text-[var(--ui-text-muted)]/50"
      />
      <p class="text-[var(--ui-text-muted)]">
        未找到匹配的账号
      </p>
    </div>

    <div
      v-else
      class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
    >
      <PasswordCard
        v-for="entry in filteredPasswords"
        :key="entry.id"
        :entry="entry"
        :linked-totp-label="getLinkedTotpLabel(entry.linkedTotpId)"
        @edit="openEditPassword"
        @delete="confirmDeletePassword"
      />
    </div>

    <!-- 弹窗 -->
    <USlideover
      v-model:open="passwordEditorOpen"
      :title="editingPassword ? '编辑账号密码' : '添加账号密码'"
    >
      <template #body>
        <PasswordEditor
          :entry="editingPassword"
          @save="handleSavePassword"
          @cancel="passwordEditorOpen = false"
        />
      </template>
    </USlideover>

    <UModal
      v-model:open="deletePasswordOpen"
      title="确认删除"
      description="删除后将无法恢复此账号密码。确定要继续吗？"
    >
      <template #footer>
        <div class="flex gap-3 w-full">
          <UButton
            block
            color="neutral"
            variant="outline"
            @click="deletePasswordOpen = false"
          >
            取消
          </UButton>
          <UButton
            block
            color="error"
            @click="handleDeletePassword"
          >
            确认删除
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { PasswordEntry, VaultViewMode } from '~/types/vault'
import { useDebounceRef } from '~/composables/useDebounceRef'
import { useSortableManualOrder } from '~/composables/useSortableManualOrder'
import { getPasswordSecrets } from '~/utils/password-secrets'

const vaultStore = useVaultStore()
const toast = useToast()

const searchQuery = useDebounceRef('', 200)
const selectedPlatform = ref('所有分类')
const gridContainer = ref<HTMLElement | null>(null)
const groupedContainers = ref<HTMLElement[]>([])

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
    || (entry.notes || '').toLowerCase().includes(query)
    || getPasswordSecrets(entry).some(s => s.name.toLowerCase().includes(query))
  )
})

const viewMode = computed(() => vaultStore.preferences.passwordViewMode)
const collapsedGroups = ref<Record<string, boolean>>({})

async function setViewMode(mode: VaultViewMode) {
  if (viewMode.value === mode) return

  try {
    await vaultStore.updatePreferences({ passwordViewMode: mode })
  } catch (err) {
    toast.add({ title: `布局保存失败: ${err instanceof Error ? err.message : '未知错误'}`, icon: 'i-lucide-x', color: 'error' })
  }
}

function toggleGroup(name: string) {
  collapsedGroups.value[name] = !collapsedGroups.value[name]
}

const groupedPasswords = computed(() => {
  const groups: Record<string, PasswordEntry[]> = {}
  for (const entry of filteredPasswords.value) {
    const groupName = entry.serviceName || '未分类'
    if (!groups[groupName]) {
      groups[groupName] = []
    }
    groups[groupName].push(entry)
  }
  return Object.keys(groups)
    .sort((a, b) => {
      if (a === '未分类') return 1
      if (b === '未分类') return -1
      return a.localeCompare(b)
    })
    .map(key => ({
      name: key,
      entries: groups[key] ?? []
    }))
})

const showControls = computed(() => vaultStore.visiblePasswords.length > 0)
const canManualSort = computed(() => vaultStore.preferences.sortMode === 'manual')
const isGridManualSort = computed(() => canManualSort.value && viewMode.value === 'grid')
const isGroupedManualSort = computed(() => canManualSort.value && viewMode.value === 'grouped')

const { refreshSortable: refreshGridSortable } = useSortableManualOrder({
  container: gridContainer,
  enabled: isGridManualSort,
  onReorder: orderedIds => vaultStore.updatePasswordSortOrder(orderedIds),
  onError: (err) => {
    toast.add({ title: `排序失败: ${err instanceof Error ? err.message : '未知错误'}`, icon: 'i-lucide-x', color: 'error' })
  }
})

watch([isGridManualSort, filteredPasswords], refreshGridSortable, { flush: 'post' })

const { refreshSortable: refreshGroupedSortable } = useSortableManualOrder({
  container: groupedContainers,
  enabled: isGroupedManualSort,
  onReorder: orderedIds => vaultStore.updatePasswordSortOrder(orderedIds),
  onError: (err) => {
    toast.add({ title: `排序失败: ${err instanceof Error ? err.message : '未知错误'}`, icon: 'i-lucide-x', color: 'error' })
  }
})

watch([isGroupedManualSort, groupedPasswords], refreshGroupedSortable, { flush: 'post' })

// ============================================================
// 密钥编辑器
// ============================================================
const passwordEditorOpen = ref(false)
const editingPassword = ref<PasswordEntry | undefined>()

const secretsOverlayOpen = ref(false)
const secretsEntry = ref<PasswordEntry | undefined>()

function openSelectSecrets(entry: PasswordEntry) {
  secretsEntry.value = entry
  secretsOverlayOpen.value = true
}

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
    await vaultStore.movePasswordToTrash(deletingPasswordId.value)
    toast.add({ title: '账号已移入回收站', icon: 'i-lucide-check', color: 'success' })
  } catch (err) {
    toast.add({ title: `移入回收站失败: ${err instanceof Error ? err.message : '未知错误'}`, icon: 'i-lucide-x', color: 'error' })
  }
  deletePasswordOpen.value = false
}

function getLinkedTotpLabel(linkedId?: string): string | undefined {
  if (!linkedId) return undefined
  const totp = vaultStore.visibleEntries.find(e => e.id === linkedId)
  return totp?.issuer || totp?.label
}

async function copyOverlaySecret(value: string, name: string) {
  try {
    await navigator.clipboard.writeText(value)
    toast.add({ title: `${name}已复制`, icon: 'i-lucide-check', color: 'success' })
    if (secretsEntry.value) {
      await vaultStore.markPasswordUsed(secretsEntry.value.id)
    }
  } catch {
    toast.add({ title: '复制失败', icon: 'i-lucide-x', color: 'error' })
  }
}

// 暴露外部可用方法
defineExpose({
  openAddPassword
})
</script>

<template>
  <div class="flex flex-col flex-1">
    <!-- 工具栏（搜索与过滤） -->
    <div
      v-if="showControls"
      class="mb-3 flex items-center gap-2"
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
        :search-input="{ placeholder: '搜索分类...' }"
      />
      <div class="flex items-center bg-[var(--ui-bg-muted)] rounded-lg p-0.5 shrink-0">
        <UButton
          icon="i-lucide-layout-grid"
          size="xs"
          :color="viewMode === 'grid' ? 'primary' : 'neutral'"
          :variant="viewMode === 'grid' ? 'soft' : 'ghost'"
          class="rounded-md transition-colors"
          aria-label="切换为网格布局"
          @click="setViewMode('grid')"
        />
        <UButton
          icon="i-lucide-list-tree"
          size="xs"
          :color="viewMode === 'grouped' ? 'primary' : 'neutral'"
          :variant="viewMode === 'grouped' ? 'soft' : 'ghost'"
          class="rounded-md transition-colors"
          aria-label="切换为分组布局"
          @click="setViewMode('grouped')"
        />
      </div>
    </div>

    <p
      v-if="canManualSort"
      class="mb-3 flex items-center gap-1.5 text-xs text-[var(--ui-text-muted)]"
    >
      <UIcon
        name="i-lucide-move"
        class="h-3.5 w-3.5"
      />
      拖动卡片即可排序，松手后自动保存。
    </p>

    <!-- 列表或空状态 -->
    <div
      v-if="vaultStore.visiblePasswords.length === 0"
      class="flex-1 flex flex-col items-center justify-center space-y-4 min-h-[60vh] lg:min-h-[40vh]"
    >
      <div class="w-16 h-16 rounded-2xl bg-[var(--ui-color-primary)]/10 flex items-center justify-center">
        <UIcon
          name="i-lucide-key-round"
          class="w-8 h-8 text-[var(--ui-color-primary)]/50"
        />
      </div>
      <p class="text-[var(--ui-text-muted)]">
        还没有账号
      </p>
    </div>

    <div
      v-else-if="filteredPasswords.length === 0"
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
      v-else-if="viewMode === 'grid'"
      ref="gridContainer"
      :class="canManualSort ? 'flex flex-wrap gap-3' : 'grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4'"
    >
      <div
        v-for="entry in filteredPasswords"
        :key="entry.id"
        :data-sortable-id="entry.id"
        :class="canManualSort ? 'w-full cursor-grab touch-pan-y active:cursor-grabbing sm:w-[calc((100%-0.75rem)/2)] xl:w-[calc((100%-2.25rem)/4)]' : ''"
      >
        <PasswordCard
          :entry="entry"
          :linked-totp-label="getLinkedTotpLabel(entry.linkedTotpId)"
          :manual-sort-active="canManualSort"
          @edit="openEditPassword"
          @delete="confirmDeletePassword"
          @select-secrets="openSelectSecrets"
        />
      </div>
    </div>

    <div
      v-else-if="viewMode === 'grouped'"
      class="space-y-6 pb-6"
    >
      <div
        v-for="group in groupedPasswords"
        :key="group.name"
        class="flex flex-col gap-3"
      >
        <button
          type="button"
          class="flex items-center justify-between w-full py-2 px-1 hover:bg-[var(--ui-bg-muted)]/50 rounded-lg transition-colors group cursor-pointer"
          @click="toggleGroup(group.name)"
        >
          <div class="flex items-center gap-2">
            <h3 class="text-sm font-semibold text-[var(--ui-text-highlight)]">
              {{ group.name }}
            </h3>
            <span class="text-xs font-medium text-[var(--ui-text-muted)] bg-[var(--ui-bg-muted)] px-2 py-0.5 rounded-full">
              {{ group.entries.length }}
            </span>
          </div>
          <UIcon
            :name="collapsedGroups[group.name] ? 'i-lucide-chevron-down' : 'i-lucide-chevron-up'"
            class="w-4 h-4 text-[var(--ui-text-muted)] group-hover:text-[var(--ui-text-highlight)] transition-colors"
          />
        </button>

        <div
          v-show="!collapsedGroups[group.name]"
          ref="groupedContainers"
          :class="canManualSort ? 'flex flex-wrap gap-3' : 'grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4'"
        >
          <div
            v-for="entry in group.entries"
            :key="entry.id"
            :data-sortable-id="entry.id"
            :class="canManualSort ? 'w-full cursor-grab touch-pan-y active:cursor-grabbing sm:w-[calc((100%-0.75rem)/2)] xl:w-[calc((100%-2.25rem)/4)]' : ''"
          >
            <PasswordCard
              :entry="entry"
              :linked-totp-label="getLinkedTotpLabel(entry.linkedTotpId)"
              :manual-sort-active="canManualSort"
              @edit="openEditPassword"
              @delete="confirmDeletePassword"
              @select-secrets="openSelectSecrets"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- 编辑器弹层 -->
    <ResponsiveOverlay
      v-model:open="passwordEditorOpen"
      :title="editingPassword ? '编辑账号' : '添加账号'"
    >
      <template #body>
        <PasswordEditor
          :entry="editingPassword"
          @save="handleSavePassword"
          @cancel="passwordEditorOpen = false"
        />
      </template>
    </ResponsiveOverlay>

    <UModal
      v-model:open="deletePasswordOpen"
      title="移入回收站"
      description="此账号将从主页隐藏，可在回收站中恢复。确定要继续吗？"
      :ui="{
        content: 'sm:max-w-sm'
      }"
      icon="i-lucide-alert-triangle"
    >
      <template #footer>
        <div class="flex gap-3 w-full">
          <UButton
            block
            color="neutral"
            variant="outline"
            class="flex-1"
            @click="deletePasswordOpen = false"
          >
            取消
          </UButton>
          <UButton
            block
            color="error"
            class="flex-1"
            @click="handleDeletePassword"
          >
            移入回收站
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- 多密钥选择覆盖层 -->
    <ResponsiveOverlay
      v-model:open="secretsOverlayOpen"
      :title="secretsEntry?.username ?? '选择密钥'"
      :description="secretsEntry?.serviceName ?? ''"
    >
      <template #body>
        <div class="flex flex-col">
          <template
            v-for="(secret, index) in (secretsEntry ? getPasswordSecrets(secretsEntry) : [])"
            :key="secret.id"
          >
            <USeparator
              v-if="index > 0"
              class="my-1"
            />
            <button
              type="button"
              class="flex items-center justify-between w-full gap-3 px-3 py-2.5 rounded-lg hover:bg-[var(--ui-bg-muted)]/50 active:bg-[var(--ui-bg-muted)] transition-colors cursor-pointer group text-left"
              @click="copyOverlaySecret(secret.value, secret.name)"
            >
              <span class="text-sm font-medium text-[var(--ui-text)] truncate">
                {{ secret.name }}
              </span>
              <UIcon
                name="i-lucide-copy"
                class="w-4 h-4 shrink-0 text-[var(--ui-text-muted)] group-hover:text-[var(--ui-text)] lg:opacity-0 lg:group-hover:opacity-100 transition-all"
              />
            </button>
          </template>
        </div>
      </template>
    </ResponsiveOverlay>
  </div>
</template>

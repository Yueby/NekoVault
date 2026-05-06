<script setup lang="ts">
import type { TotpEntry, VaultViewMode } from '~/types/vault'
import { useDebounceRef } from '~/composables/useDebounceRef'
import { useSortableManualOrder } from '~/composables/useSortableManualOrder'

const vaultStore = useVaultStore()
const toast = useToast()

const searchQuery = useDebounceRef('', 200)
const selectedPlatform = ref('所有分类')
const gridContainer = ref<HTMLElement | null>(null)
const groupedContainers = ref<HTMLElement[]>([])

const filterOptions = computed(() => [
  '所有分类',
  '未分类',
  ...vaultStore.totpPlatforms
])

const filteredEntries = computed(() => {
  let entries = vaultStore.sortedEntries

  if (selectedPlatform.value === '未分类') {
    entries = entries.filter(e => !e.issuer)
  } else if (selectedPlatform.value !== '所有分类') {
    entries = entries.filter(e => e.issuer === selectedPlatform.value)
  }

  const query = searchQuery.value.toLowerCase().trim()
  if (!query) return entries

  return entries.filter(entry =>
    (entry.issuer || '').toLowerCase().includes(query)
    || (entry.label || '').toLowerCase().includes(query)
    || (entry.accountName || '').toLowerCase().includes(query)
  )
})

const viewMode = computed(() => vaultStore.preferences.totpViewMode)
const collapsedGroups = ref<Record<string, boolean>>({})

async function setViewMode(mode: VaultViewMode) {
  if (viewMode.value === mode) return

  try {
    await vaultStore.updatePreferences({ totpViewMode: mode })
  } catch (err) {
    toast.add({ title: `布局保存失败: ${err instanceof Error ? err.message : '未知错误'}`, icon: 'i-lucide-x', color: 'error' })
  }
}

function toggleGroup(name: string) {
  collapsedGroups.value[name] = !collapsedGroups.value[name]
}

const groupedEntries = computed(() => {
  const groups: Record<string, TotpEntry[]> = {}
  for (const entry of filteredEntries.value) {
    const groupName = entry.issuer || '未分类'
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

const showControls = computed(() => vaultStore.entries.length > 0)
const canManualSort = computed(() => vaultStore.preferences.sortMode === 'manual')
const isGridManualSort = computed(() => canManualSort.value && viewMode.value === 'grid')
const isGroupedManualSort = computed(() => canManualSort.value && viewMode.value === 'grouped')

const { refreshSortable: refreshGridSortable } = useSortableManualOrder({
  container: gridContainer,
  enabled: isGridManualSort,
  onReorder: orderedIds => vaultStore.updateSortOrder(orderedIds),
  onError: (err) => {
    toast.add({ title: `排序失败: ${err instanceof Error ? err.message : '未知错误'}`, icon: 'i-lucide-x', color: 'error' })
  }
})

watch([isGridManualSort, filteredEntries], refreshGridSortable, { flush: 'post' })

const { refreshSortable: refreshGroupedSortable } = useSortableManualOrder({
  container: groupedContainers,
  enabled: isGroupedManualSort,
  onReorder: orderedIds => vaultStore.updateSortOrder(orderedIds),
  onError: (err) => {
    toast.add({ title: `排序失败: ${err instanceof Error ? err.message : '未知错误'}`, icon: 'i-lucide-x', color: 'error' })
  }
})

watch([isGroupedManualSort, groupedEntries], refreshGroupedSortable, { flush: 'post' })

// ============================================================
// TOTP 编辑器操作
// ============================================================
const totpEditorOpen = ref(false)
const editingTotp = ref<TotpEntry | undefined>()

function openAddTotp() {
  editingTotp.value = undefined
  totpEditorOpen.value = true
}

function openEditTotp(entry: TotpEntry) {
  editingTotp.value = entry
  totpEditorOpen.value = true
}

async function handleSaveTotp(data: Omit<TotpEntry, 'id' | 'createdAt' | 'updatedAt'>, linkedPasswordId?: string) {
  try {
    let savedId = ''
    if (editingTotp.value) {
      savedId = editingTotp.value.id
      await vaultStore.updateEntry(savedId, data)
      toast.add({ title: '验证码已更新', icon: 'i-lucide-check', color: 'success' })
    } else {
      const newEntry = await vaultStore.addEntry(data)
      savedId = newEntry.id
      toast.add({ title: '验证码已添加', icon: 'i-lucide-check', color: 'success' })
    }

    // 处理账号反向关联
    await vaultStore.setTotpPasswordLink(savedId, linkedPasswordId)

    totpEditorOpen.value = false
  } catch (err) {
    toast.add({ title: `操作失败: ${err instanceof Error ? err.message : '未知错误'}`, icon: 'i-lucide-x', color: 'error' })
  }
}

const deleteTotpOpen = ref(false)
const deletingTotpId = ref('')

function confirmDeleteTotp(id: string) {
  deletingTotpId.value = id
  deleteTotpOpen.value = true
}

async function handleDeleteTotp() {
  try {
    await vaultStore.deleteEntry(deletingTotpId.value)
    toast.add({ title: '验证码已删除', icon: 'i-lucide-check', color: 'success' })
  } catch (err) {
    toast.add({ title: `删除失败: ${err instanceof Error ? err.message : '未知错误'}`, icon: 'i-lucide-x', color: 'error' })
  }
  deleteTotpOpen.value = false
}

// 供外部环境（如 FAB）调用
defineExpose({
  openAddTotp
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
        placeholder="搜索验证码…"
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
      v-if="vaultStore.entries.length === 0"
      class="flex-1 flex flex-col items-center justify-center space-y-4 min-h-[60vh] lg:min-h-[40vh]"
    >
      <div class="w-16 h-16 rounded-2xl bg-[var(--ui-color-primary)]/10 flex items-center justify-center">
        <UIcon
          name="i-lucide-shield-check"
          class="w-8 h-8 text-[var(--ui-color-primary)]/50"
        />
      </div>
      <p class="text-[var(--ui-text-muted)]">
        还没有验证码
      </p>
    </div>

    <div
      v-else-if="filteredEntries.length === 0"
      class="flex-1 flex flex-col items-center justify-center space-y-4 min-h-[60vh] lg:min-h-[40vh]"
    >
      <UIcon
        name="i-lucide-search-x"
        class="w-12 h-12 text-[var(--ui-text-muted)]/50"
      />
      <p class="text-[var(--ui-text-muted)]">
        未找到匹配的验证码
      </p>
    </div>

    <div
      v-else-if="viewMode === 'grid'"
      ref="gridContainer"
      :class="canManualSort ? 'flex flex-wrap gap-3' : 'grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4'"
    >
      <div
        v-for="entry in filteredEntries"
        :key="entry.id"
        :data-sortable-id="entry.id"
        :class="canManualSort ? 'w-full cursor-grab touch-pan-y active:cursor-grabbing sm:w-[calc((100%-0.75rem)/2)] xl:w-[calc((100%-2.25rem)/4)]' : ''"
      >
        <TotpCard
          :entry="entry"
          :manual-sort-active="canManualSort"
          @edit="openEditTotp"
          @delete="confirmDeleteTotp"
        />
      </div>
    </div>

    <div
      v-else-if="viewMode === 'grouped'"
      class="space-y-6 pb-6"
    >
      <div
        v-for="group in groupedEntries"
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
            <TotpCard
              :entry="entry"
              :manual-sort-active="canManualSort"
              @edit="openEditTotp"
              @delete="confirmDeleteTotp"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- 编辑器弹层 -->
    <ResponsiveOverlay
      v-model:open="totpEditorOpen"
      :title="editingTotp ? '编辑验证码' : '添加验证码'"
    >
      <template #body>
        <EntryEditor
          :entry="editingTotp"
          @save="handleSaveTotp"
          @cancel="totpEditorOpen = false"
        />
      </template>
    </ResponsiveOverlay>

    <UModal
      v-model:open="deleteTotpOpen"
      title="确认删除"
      description="删除后将无法恢复此验证码。确定要继续吗？"
    >
      <template #footer>
        <div class="flex gap-3 w-full">
          <UButton
            block
            color="neutral"
            variant="outline"
            @click="deleteTotpOpen = false"
          >
            取消
          </UButton>
          <UButton
            block
            color="error"
            @click="handleDeleteTotp"
          >
            确认删除
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

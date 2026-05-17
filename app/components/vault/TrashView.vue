<script setup lang="ts">
import type { PasswordEntry, TotpEntry, VaultViewMode } from '~/types/vault'
import type { ContextMenuItem } from '~/components/VaultEntryCard.vue'
import { useDebounceRef } from '~/composables/useDebounceRef'

const vaultStore = useVaultStore()
const toast = useToast()

const permanentlyDeleteOpen = ref(false)
const deletingItem = ref<{ type: 'totp' | 'password', id: string, name: string } | null>(null)
const clearTrashOpen = ref(false)

const hasTrashItems = computed(() => vaultStore.trashedEntries.length > 0 || vaultStore.trashedPasswords.length > 0)

// ----------------------------------------------------------------------------
// 搜索和过滤逻辑
// ----------------------------------------------------------------------------
const searchQuery = useDebounceRef('', 200)
const selectedPlatform = ref('所有分类')
const viewMode = ref<VaultViewMode>('grid')

const filterOptions = computed(() => {
  const platforms = new Set<string>()
  for (const entry of vaultStore.trashedEntries) {
    if (entry.issuer) platforms.add(entry.issuer)
  }
  for (const entry of vaultStore.trashedPasswords) {
    if (entry.serviceName) platforms.add(entry.serviceName)
  }
  return [
    '所有分类',
    '未分类',
    ...Array.from(platforms).sort((a, b) => a.localeCompare(b))
  ]
})

const filteredEntries = computed(() => {
  let entries = [...vaultStore.trashedEntries]
  if (selectedPlatform.value === '未分类') {
    entries = entries.filter(e => !e.issuer)
  } else if (selectedPlatform.value !== '所有分类') {
    entries = entries.filter(e => e.issuer === selectedPlatform.value)
  }

  const query = searchQuery.value.toLowerCase().trim()
  if (query) {
    entries = entries.filter(entry =>
      (entry.issuer || '').toLowerCase().includes(query)
      || (entry.label || '').toLowerCase().includes(query)
      || (entry.accountName || '').toLowerCase().includes(query)
    )
  }
  return entries.sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0))
})

const filteredPasswords = computed(() => {
  let entries = [...vaultStore.trashedPasswords]
  if (selectedPlatform.value === '未分类') {
    entries = entries.filter(e => !e.serviceName)
  } else if (selectedPlatform.value !== '所有分类') {
    entries = entries.filter(e => e.serviceName === selectedPlatform.value)
  }

  const query = searchQuery.value.toLowerCase().trim()
  if (query) {
    entries = entries.filter(entry =>
      (entry.serviceName || '').toLowerCase().includes(query)
      || (entry.username || '').toLowerCase().includes(query)
      || (entry.notes || '').toLowerCase().includes(query)
    )
  }
  return entries.sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0))
})

const hasFilteredItems = computed(() => filteredEntries.value.length > 0 || filteredPasswords.value.length > 0)

// ----------------------------------------------------------------------------
// Grouped 逻辑
// ----------------------------------------------------------------------------
const collapsedTotpGroups = ref<Record<string, boolean>>({})
const collapsedPasswordGroups = ref<Record<string, boolean>>({})

function toggleTotpGroup(name: string) {
  collapsedTotpGroups.value[name] = !collapsedTotpGroups.value[name]
}

function togglePasswordGroup(name: string) {
  collapsedPasswordGroups.value[name] = !collapsedPasswordGroups.value[name]
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

function formatDeletedAt(timestamp?: number): string {
  if (!timestamp) return '未知时间'

  const now = Date.now()
  const diff = now - timestamp

  if (diff < 60000) return '刚刚'

  const rtf = new Intl.RelativeTimeFormat('zh-CN', { numeric: 'auto' })

  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days > 0) return rtf.format(-days, 'day')

  const hours = Math.floor(diff / (1000 * 60 * 60))
  if (hours > 0) return rtf.format(-hours, 'hour')

  const minutes = Math.floor(diff / (1000 * 60))
  return rtf.format(-minutes, 'minute')
}

function getTotpName(entry: TotpEntry): string {
  return entry.issuer || entry.label || '未命名验证码'
}

function getPasswordName(entry: PasswordEntry): string {
  return entry.serviceName || '未命名账号'
}

const restoringIds = ref<Set<string>>(new Set())

async function restoreTotp(id: string) {
  try {
    restoringIds.value.add(id)
    await new Promise(resolve => setTimeout(resolve, 300))
    await vaultStore.restoreEntry(id)
    toast.add({ title: '验证码已恢复', icon: 'i-lucide-check', color: 'success' })
  } catch (err) {
    toast.add({ title: `恢复失败: ${err instanceof Error ? err.message : '未知错误'}`, icon: 'i-lucide-x', color: 'error' })
  } finally {
    restoringIds.value.delete(id)
  }
}

async function restorePassword(id: string) {
  try {
    restoringIds.value.add(id)
    await new Promise(resolve => setTimeout(resolve, 300))
    await vaultStore.restorePassword(id)
    toast.add({ title: '账号已恢复', icon: 'i-lucide-check', color: 'success' })
  } catch (err) {
    toast.add({ title: `恢复失败: ${err instanceof Error ? err.message : '未知错误'}`, icon: 'i-lucide-x', color: 'error' })
  } finally {
    restoringIds.value.delete(id)
  }
}

function confirmPermanentlyDelete(type: 'totp' | 'password', id: string, name: string) {
  deletingItem.value = { type, id, name }
  permanentlyDeleteOpen.value = true
}

async function handlePermanentlyDelete() {
  if (!deletingItem.value) return

  try {
    if (deletingItem.value.type === 'totp') {
      await vaultStore.permanentlyDeleteEntry(deletingItem.value.id)
      toast.add({ title: '验证码已永久删除', icon: 'i-lucide-check', color: 'success' })
    } else {
      await vaultStore.permanentlyDeletePassword(deletingItem.value.id)
      toast.add({ title: '账号已永久删除', icon: 'i-lucide-check', color: 'success' })
    }
  } catch (err) {
    toast.add({ title: `永久删除失败: ${err instanceof Error ? err.message : '未知错误'}`, icon: 'i-lucide-x', color: 'error' })
  }

  permanentlyDeleteOpen.value = false
  deletingItem.value = null
}

async function handleClearTrash() {
  try {
    await vaultStore.clearTrash()
    toast.add({ title: '回收站已清空', icon: 'i-lucide-check', color: 'success' })
  } catch (err) {
    toast.add({ title: `清空失败: ${err instanceof Error ? err.message : '未知错误'}`, icon: 'i-lucide-x', color: 'error' })
  }
  clearTrashOpen.value = false
}

function getContextItems(type: 'totp' | 'password', id: string, name: string): ContextMenuItem[][] {
  return [
    [{
      label: '恢复',
      icon: 'i-lucide-rotate-ccw',
      onSelect: () => type === 'totp' ? restoreTotp(id) : restorePassword(id)
    }],
    [{
      label: '永久删除',
      icon: 'i-lucide-trash-2',
      color: 'error',
      onSelect: () => confirmPermanentlyDelete(type, id, name)
    }]
  ]
}
</script>

<template>
  <div class="flex flex-col flex-1">
    <!-- 工具栏（搜索与过滤） -->
    <div
      v-if="hasTrashItems"
      class="mb-3 flex items-center gap-2"
    >
      <UInput
        v-model="searchQuery"
        icon="i-lucide-search"
        placeholder="搜索回收站…"
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
          @click="viewMode = 'grid'"
        />
        <UButton
          icon="i-lucide-list-tree"
          size="xs"
          :color="viewMode === 'grouped' ? 'primary' : 'neutral'"
          :variant="viewMode === 'grouped' ? 'soft' : 'ghost'"
          class="rounded-md transition-colors"
          aria-label="切换为分组布局"
          @click="viewMode = 'grouped'"
        />
      </div>
    </div>

    <!-- 列表或空状态 -->
    <div
      v-if="!hasTrashItems"
      class="flex-1 flex flex-col items-center justify-center space-y-4 min-h-[60vh] lg:min-h-[40vh]"
    >
      <div class="w-16 h-16 rounded-2xl bg-[var(--ui-color-primary)]/10 flex items-center justify-center">
        <UIcon
          name="i-lucide-trash-2"
          class="w-8 h-8 text-[var(--ui-color-primary)]/50"
        />
      </div>
      <p class="text-[var(--ui-text-muted)]">
        回收站为空
      </p>
    </div>

    <div
      v-else-if="!hasFilteredItems"
      class="flex-1 flex flex-col items-center justify-center space-y-4 min-h-[60vh] lg:min-h-[40vh]"
    >
      <UIcon
        name="i-lucide-search-x"
        class="w-12 h-12 text-[var(--ui-text-muted)]/50"
      />
      <p class="text-[var(--ui-text-muted)]">
        未找到匹配的回收条目
      </p>
    </div>

    <div
      v-else
      class="flex flex-col flex-1"
    >
      <div class="mb-3 flex items-center justify-between">
        <p class="flex items-center gap-1.5 text-xs text-[var(--ui-text-muted)]">
          <UIcon
            name="i-lucide-info"
            class="h-3.5 w-3.5"
          />
          回收站中的条目不会自动清除
        </p>
        <UButton
          icon="i-lucide-trash-2"
          label="清空"
          color="error"
          variant="ghost"
          size="xs"
          @click="clearTrashOpen = true"
        />
      </div>

      <div class="space-y-6 pb-6">
        <!-- 验证码区块 -->
        <section
          v-if="filteredEntries.length > 0"
          class="flex flex-col gap-3"
        >
          <div class="flex items-center gap-2 px-1">
            <UIcon
              name="i-lucide-shield-check"
              class="w-4 h-4 text-[var(--ui-text-muted)]"
            />
            <h2 class="text-sm font-semibold text-[var(--ui-text-highlighted)]">
              验证码
            </h2>
            <span class="text-xs font-medium text-[var(--ui-text-muted)] bg-[var(--ui-bg-muted)] px-2 py-0.5 rounded-full">
              {{ filteredEntries.length }}
            </span>
          </div>

          <!-- 验证码 - Grid 模式 -->
          <div
            v-if="viewMode === 'grid'"
            class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
          >
            <div
              v-for="entry in filteredEntries"
              :key="entry.id"
              class="transition-all duration-300"
              :class="{ 'opacity-0 scale-95 pointer-events-none': restoringIds.has(entry.id) }"
            >
              <VaultEntryCard
                :title="entry.accountName || entry.label || '无账号信息'"
                :subtitle="getTotpName(entry)"
                :context-items="getContextItems('totp', entry.id, getTotpName(entry))"
              >
                <template #bottom>
                  <span class="text-sm text-[var(--ui-text-muted)] truncate">
                    删除于 {{ formatDeletedAt(entry.deletedAt) }}
                  </span>
                </template>
              </VaultEntryCard>
            </div>
          </div>

          <!-- 验证码 - Grouped 模式 -->
          <div
            v-else-if="viewMode === 'grouped'"
            class="flex flex-col gap-3"
          >
            <div
              v-for="group in groupedEntries"
              :key="group.name"
              class="flex flex-col gap-3"
            >
              <button
                type="button"
                class="flex items-center justify-between w-full py-2 px-1 hover:bg-[var(--ui-bg-muted)]/50 rounded-lg transition-colors group cursor-pointer"
                @click="toggleTotpGroup(group.name)"
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
                  :name="collapsedTotpGroups[group.name] ? 'i-lucide-chevron-down' : 'i-lucide-chevron-up'"
                  class="w-4 h-4 text-[var(--ui-text-muted)] group-hover:text-[var(--ui-text-highlight)] transition-colors"
                />
              </button>

              <div
                v-show="!collapsedTotpGroups[group.name]"
                class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
              >
                <div
                  v-for="entry in group.entries"
                  :key="entry.id"
                  class="transition-all duration-300"
                  :class="{ 'opacity-0 scale-95 pointer-events-none': restoringIds.has(entry.id) }"
                >
                  <VaultEntryCard
                    :title="entry.accountName || entry.label || '无账号信息'"
                    :subtitle="getTotpName(entry)"
                    :context-items="getContextItems('totp', entry.id, getTotpName(entry))"
                  >
                    <template #bottom>
                      <span class="text-sm text-[var(--ui-text-muted)] truncate">
                        删除于 {{ formatDeletedAt(entry.deletedAt) }}
                      </span>
                    </template>
                  </VaultEntryCard>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- 账号密码区块 -->
        <section
          v-if="filteredPasswords.length > 0"
          class="flex flex-col gap-3"
        >
          <div class="flex items-center gap-2 px-1">
            <UIcon
              name="i-lucide-key-round"
              class="w-4 h-4 text-[var(--ui-text-muted)]"
            />
            <h2 class="text-sm font-semibold text-[var(--ui-text-highlighted)]">
              账号密码
            </h2>
            <span class="text-xs font-medium text-[var(--ui-text-muted)] bg-[var(--ui-bg-muted)] px-2 py-0.5 rounded-full">
              {{ filteredPasswords.length }}
            </span>
          </div>

          <!-- 账号密码 - Grid 模式 -->
          <div
            v-if="viewMode === 'grid'"
            class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
          >
            <div
              v-for="entry in filteredPasswords"
              :key="entry.id"
              class="transition-all duration-300"
              :class="{ 'opacity-0 scale-95 pointer-events-none': restoringIds.has(entry.id) }"
            >
              <VaultEntryCard
                :title="entry.username || '无用户名'"
                :subtitle="getPasswordName(entry)"
                :context-items="getContextItems('password', entry.id, getPasswordName(entry))"
              >
                <template #bottom>
                  <span class="text-sm text-[var(--ui-text-muted)] truncate">
                    删除于 {{ formatDeletedAt(entry.deletedAt) }}
                  </span>
                </template>
              </VaultEntryCard>
            </div>
          </div>

          <!-- 账号密码 - Grouped 模式 -->
          <div
            v-else-if="viewMode === 'grouped'"
            class="flex flex-col gap-3"
          >
            <div
              v-for="group in groupedPasswords"
              :key="group.name"
              class="flex flex-col gap-3"
            >
              <button
                type="button"
                class="flex items-center justify-between w-full py-2 px-1 hover:bg-[var(--ui-bg-muted)]/50 rounded-lg transition-colors group cursor-pointer"
                @click="togglePasswordGroup(group.name)"
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
                  :name="collapsedPasswordGroups[group.name] ? 'i-lucide-chevron-down' : 'i-lucide-chevron-up'"
                  class="w-4 h-4 text-[var(--ui-text-muted)] group-hover:text-[var(--ui-text-highlight)] transition-colors"
                />
              </button>

              <div
                v-show="!collapsedPasswordGroups[group.name]"
                class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
              >
                <div
                  v-for="entry in group.entries"
                  :key="entry.id"
                  class="transition-all duration-300"
                  :class="{ 'opacity-0 scale-95 pointer-events-none': restoringIds.has(entry.id) }"
                >
                  <VaultEntryCard
                    :title="entry.username || '无用户名'"
                    :subtitle="getPasswordName(entry)"
                    :context-items="getContextItems('password', entry.id, getPasswordName(entry))"
                  >
                    <template #bottom>
                      <span class="text-sm text-[var(--ui-text-muted)] truncate">
                        删除于 {{ formatDeletedAt(entry.deletedAt) }}
                      </span>
                    </template>
                  </VaultEntryCard>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>

    <UModal
      v-model:open="clearTrashOpen"
      title="清空回收站"
      description="所有已回收的条目将永久删除，无法恢复。确定要继续吗？"
    >
      <template #footer>
        <div class="flex gap-3 w-full">
          <UButton
            block
            color="neutral"
            variant="outline"
            @click="clearTrashOpen = false"
          >
            取消
          </UButton>
          <UButton
            block
            color="error"
            @click="handleClearTrash"
          >
            确认清空
          </UButton>
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="permanentlyDeleteOpen"
      title="永久删除"
      :description="`此条目将永久删除，无法恢复。确定要继续吗？`"
    >
      <template #footer>
        <div class="flex gap-3 w-full">
          <UButton
            block
            color="neutral"
            variant="outline"
            @click="permanentlyDeleteOpen = false"
          >
            取消
          </UButton>
          <UButton
            block
            color="error"
            @click="handlePermanentlyDelete"
          >
            确认删除
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

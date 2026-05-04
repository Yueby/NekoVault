/**
 * Vault Store (Pinia)
 *
 * 在线优先：服务端存明文 JSON，由 ADMIN_TOKEN 保护
 * 内存中持有解锁后的 vault，所有修改直接同步到远端
 */
import { defineStore } from 'pinia'
import type {
  VaultDocument,
  VaultPreferences,
  TotpEntry,
  PasswordEntry,
  SyncStatus
} from '~/types/vault'
import { generateId } from '~/utils/crypto'

/** 创建空的 vault 文档 */
function createEmptyVault(): VaultDocument {
  return {
    schemaVersion: 3,
    entries: [],
    passwords: [],
    sortOrder: [],
    passwordSortOrder: [],
    preferences: {
      sortMode: 'alpha',
      autoLockMinutes: 5,
      showCodesOnUnlock: true,
      totpViewMode: 'grid',
      passwordViewMode: 'grid'
    },
    updatedAt: Date.now()
  }
}

function buildManualOrder(savedOrder: string[] | undefined, ids: string[]): string[] {
  const validIds = new Set(ids)
  const seenIds = new Set<string>()
  const order: string[] = []

  for (const id of savedOrder ?? []) {
    if (validIds.has(id) && !seenIds.has(id)) {
      order.push(id)
      seenIds.add(id)
    }
  }

  for (const id of ids) {
    if (!seenIds.has(id)) {
      order.push(id)
      seenIds.add(id)
    }
  }

  return order
}

function mergeVisibleManualOrder(currentOrder: string[], visibleOrder: string[]): string[] {
  const visibleIds = new Set(visibleOrder)
  const nextOrder = [...currentOrder]
  let visibleIndex = 0

  for (let index = 0; index < nextOrder.length; index += 1) {
    if (visibleIds.has(nextOrder[index]!)) {
      nextOrder[index] = visibleOrder[visibleIndex]!
      visibleIndex += 1
    }
  }

  return nextOrder
}

function sortItemsByManualOrder<T extends { id: string }>(items: T[], savedOrder: string[] | undefined): T[] {
  const order = buildManualOrder(savedOrder, items.map(item => item.id))
  const orderMap = new Map(order.map((id, idx) => [id, idx]))
  return [...items].sort((a, b) => (orderMap.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (orderMap.get(b.id) ?? Number.MAX_SAFE_INTEGER))
}

export const useVaultStore = defineStore('vault', () => {
  // ============================================================
  // 状态
  // ============================================================

  /** 解密后的 vault 文档（仅存内存） */
  const decryptedVault = ref<VaultDocument | null>(null)

  /** vault 是否已解锁 */
  const isUnlocked = computed(() => decryptedVault.value !== null)

  /** 同步状态 */
  const syncStatus = ref<SyncStatus>('idle')

  /** 当前会话的 admin token（密码明文，用于 API 鉴权，仅内存持有） */
  const adminToken = ref('')

  /** 当前远程 revision */
  const currentRevision = ref(0)

  // ============================================================
  // Getters
  // ============================================================

  /** 所有 TOTP 条目 */
  const entries = computed(() => decryptedVault.value?.entries ?? [])

  /** 所有密码条目 */
  const passwords = computed(() => decryptedVault.value?.passwords ?? [])

  /** 排序后的密码条目 */
  const sortedPasswords = computed(() => {
    const vault = decryptedVault.value
    if (!vault) return []

    const prefs = vault.preferences
    const sorted = [...(vault.passwords || [])]

    switch (prefs.sortMode) {
      case 'recent':
        return sorted.sort((a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0))
      case 'manual':
        return sortItemsByManualOrder(sorted, vault.passwordSortOrder)
      case 'alpha':
      default:
        return sorted.sort((a, b) => a.serviceName.localeCompare(b.serviceName))
    }
  })

  /** 用户偏好 */
  const preferences = computed(() => decryptedVault.value?.preferences ?? {
    sortMode: 'alpha' as const,
    autoLockMinutes: 5,
    showCodesOnUnlock: true,
    totpViewMode: 'grid' as const,
    passwordViewMode: 'grid' as const
  })

  /** 独立的 TOTP 平台（分类）集合 */
  const totpPlatforms = computed(() => {
    const set = new Set<string>()
    entries.value.forEach((e) => {
      if (e.issuer) set.add(e.issuer)
    })
    return Array.from(set).sort()
  })

  /** 独立的账号密码平台（分类）集合 */
  const passwordPlatforms = computed(() => {
    const set = new Set<string>()
    passwords.value.forEach((p) => {
      if (p.serviceName) set.add(p.serviceName)
    })
    return Array.from(set).sort()
  })

  /** 排序后的条目 */
  const sortedEntries = computed(() => {
    const vault = decryptedVault.value
    if (!vault) return []

    const prefs = vault.preferences
    const entriesCopy = [...vault.entries]

    switch (prefs.sortMode) {
      case 'recent':
        return entriesCopy.sort((a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0))
      case 'manual': {
        return sortItemsByManualOrder(entriesCopy, vault.sortOrder)
      }
      case 'alpha':
      default:
        return entriesCopy.sort((a, b) => a.issuer.localeCompare(b.issuer))
    }
  })

  // ============================================================
  // 操作
  // ============================================================

  /**
   * 加载 vault 数据（解锁时调用）
   */
  function hydrate(vault: VaultDocument, revision: number) {
    decryptedVault.value = vault
    currentRevision.value = revision
  }

  /**
   * 初始化新 vault（setup 时调用）
   */
  function initializeEmpty() {
    const emptyVault = createEmptyVault()
    decryptedVault.value = emptyVault
    currentRevision.value = 1
  }

  /**
   * 锁定 vault：清除所有内存数据
   */
  function lock() {
    decryptedVault.value = null
    adminToken.value = ''
    syncStatus.value = 'idle'
  }

  /**
   * 持久化当前 vault 状态：直接同步到远端
   */
  async function persistVault(): Promise<void> {
    const vault = decryptedVault.value
    if (!vault) return

    vault.updatedAt = Date.now()

    const dataJson = JSON.stringify(vault)
    await syncToRemote(dataJson, currentRevision.value)
  }

  /**
   * 将数据同步到远端
   */
  async function syncToRemote(
    dataJson: string,
    expectedRevision: number = currentRevision.value
  ): Promise<void> {
    syncStatus.value = 'syncing'
    try {
      const response = await $fetch<{ success: boolean, revision: number }>('/api/vault', {
        method: 'PUT',
        headers: {
          'x-admin-token': adminToken.value
        },
        body: {
          data: dataJson,
          revision: expectedRevision
        }
      })

      currentRevision.value = response.revision
      syncStatus.value = 'synced'
    } catch (err: unknown) {
      const statusCode = (err && typeof err === 'object' && 'statusCode' in err)
        ? (err as { statusCode: number }).statusCode
        : undefined
      if (statusCode === 409) {
        syncStatus.value = 'conflict'
      } else {
        syncStatus.value = 'error'
      }
      throw err
    }
  }

  // ============================================================
  // TOTP 条目 CRUD
  // ============================================================

  async function addEntry(input: Omit<TotpEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<TotpEntry> {
    if (!decryptedVault.value) throw new Error('Vault 未解锁')

    const now = Date.now()
    const entry: TotpEntry = {
      ...input,
      id: generateId(),
      createdAt: now,
      updatedAt: now
    }

    decryptedVault.value.entries.push(entry)
    decryptedVault.value.sortOrder.push(entry.id)
    await persistVault()
    return entry
  }

  async function updateEntry(id: string, updates: Partial<Omit<TotpEntry, 'id' | 'createdAt'>>): Promise<void> {
    if (!decryptedVault.value) throw new Error('Vault 未解锁')

    const idx = decryptedVault.value.entries.findIndex(e => e.id === id)
    if (idx === -1) throw new Error('条目不存在')

    const existing = decryptedVault.value.entries[idx]!
    decryptedVault.value.entries[idx] = {
      ...existing,
      ...updates,
      updatedAt: Date.now()
    }
    await persistVault()
  }

  async function setTotpPasswordLink(totpId: string, targetPasswordId?: string | Record<string, unknown>): Promise<void> {
    if (!decryptedVault.value || !decryptedVault.value.passwords) return

    // 提取真实的 ID，防范 USelectMenu 给出的 targetPasswordId 是个对象
    const actualTargetId = (targetPasswordId && typeof targetPasswordId === 'object')
      ? typeof targetPasswordId.value === 'string' ? targetPasswordId.value : undefined
      : targetPasswordId

    let changed = false
    // 移除旧关联
    for (const p of decryptedVault.value.passwords) {
      if (p.linkedTotpId === totpId && p.id !== actualTargetId) {
        p.linkedTotpId = undefined
        p.updatedAt = Date.now()
        changed = true
      }
    }

    // 建立新关联
    if (actualTargetId && actualTargetId !== 'none') {
      const p = decryptedVault.value.passwords.find(p => p.id === actualTargetId)
      if (p && p.linkedTotpId !== totpId) {
        p.linkedTotpId = totpId
        p.updatedAt = Date.now()
        changed = true
      }
    }

    if (changed) {
      await persistVault()
    }
  }

  async function deleteEntry(id: string): Promise<void> {
    if (!decryptedVault.value) throw new Error('Vault 未解锁')

    decryptedVault.value.entries = decryptedVault.value.entries.filter(e => e.id !== id)
    decryptedVault.value.sortOrder = decryptedVault.value.sortOrder.filter(eid => eid !== id)
    await persistVault()
  }

  async function markEntryUsed(id: string): Promise<void> {
    if (!decryptedVault.value) throw new Error('Vault 未解锁')

    const entry = decryptedVault.value.entries.find(e => e.id === id)
    if (entry) {
      entry.lastUsedAt = Date.now()
      await persistVault()
    }
  }

  async function updatePreferences(updates: Partial<VaultPreferences>): Promise<void> {
    if (!decryptedVault.value) throw new Error('Vault 未解锁')

    decryptedVault.value.preferences = {
      ...decryptedVault.value.preferences,
      ...updates
    }
    await persistVault()
  }

  async function updateSortOrder(newOrder: string[]): Promise<void> {
    if (!decryptedVault.value) throw new Error('Vault 未解锁')

    const currentOrder = buildManualOrder(decryptedVault.value.sortOrder, decryptedVault.value.entries.map(entry => entry.id))
    decryptedVault.value.sortOrder = mergeVisibleManualOrder(
      currentOrder,
      buildManualOrder(newOrder, newOrder)
    )
    await persistVault()
  }

  // ============================================================
  // 密码条目 CRUD
  // ============================================================

  async function addPassword(input: Omit<PasswordEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<PasswordEntry> {
    if (!decryptedVault.value) throw new Error('Vault 未解锁')

    // 兼容旧数据：确保 passwords 数组存在
    if (!decryptedVault.value.passwords) {
      decryptedVault.value.passwords = []
    }

    const now = Date.now()
    const entry: PasswordEntry = {
      ...input,
      id: generateId(),
      createdAt: now,
      updatedAt: now
    }

    decryptedVault.value.passwords.push(entry)
    decryptedVault.value.passwordSortOrder ??= []
    decryptedVault.value.passwordSortOrder.push(entry.id)
    await persistVault()
    return entry
  }

  async function updatePassword(id: string, updates: Partial<Omit<PasswordEntry, 'id' | 'createdAt'>>): Promise<void> {
    if (!decryptedVault.value) throw new Error('Vault 未解锁')
    if (!decryptedVault.value.passwords) return

    const idx = decryptedVault.value.passwords.findIndex(e => e.id === id)
    if (idx === -1) throw new Error('密码条目不存在')

    const existing = decryptedVault.value.passwords[idx]!
    decryptedVault.value.passwords[idx] = {
      ...existing,
      ...updates,
      updatedAt: Date.now()
    }
    await persistVault()
  }

  async function deletePassword(id: string): Promise<void> {
    if (!decryptedVault.value) throw new Error('Vault 未解锁')
    if (!decryptedVault.value.passwords) return

    decryptedVault.value.passwords = decryptedVault.value.passwords.filter(e => e.id !== id)
    decryptedVault.value.passwordSortOrder = (decryptedVault.value.passwordSortOrder ?? []).filter(eid => eid !== id)
    await persistVault()
  }

  async function markPasswordUsed(id: string): Promise<void> {
    if (!decryptedVault.value) throw new Error('Vault 未解锁')
    if (!decryptedVault.value.passwords) return

    const entry = decryptedVault.value.passwords.find(e => e.id === id)
    if (entry) {
      entry.lastUsedAt = Date.now()
      await persistVault()
    }
  }

  async function updatePasswordSortOrder(newOrder: string[]): Promise<void> {
    if (!decryptedVault.value) throw new Error('Vault 未解锁')
    if (!decryptedVault.value.passwords) return

    const currentOrder = buildManualOrder(
      decryptedVault.value.passwordSortOrder,
      decryptedVault.value.passwords.map(entry => entry.id)
    )
    decryptedVault.value.passwordSortOrder = mergeVisibleManualOrder(
      currentOrder,
      buildManualOrder(newOrder, newOrder)
    )
    await persistVault()
  }

  return {
    // 状态
    decryptedVault,
    isUnlocked,
    syncStatus,
    currentRevision,
    // Getters
    entries,
    passwords,
    preferences,
    sortedEntries,
    sortedPasswords,
    totpPlatforms,
    passwordPlatforms,
    // 操作
    hydrate,
    initializeEmpty,
    lock,
    persistVault,
    syncToRemote,
    // TOTP CRUD
    addEntry,
    updateEntry,
    setTotpPasswordLink,
    deleteEntry,
    markEntryUsed,
    // 密码 CRUD
    addPassword,
    updatePassword,
    deletePassword,
    markPasswordUsed,
    // 其他
    updatePreferences,
    updateSortOrder,
    updatePasswordSortOrder,
    setSyncStatus: (status: SyncStatus) => { syncStatus.value = status },
    setRevision: (rev: number) => { currentRevision.value = rev },
    setAdminToken: (token: string) => { adminToken.value = token }
  }
})

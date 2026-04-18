/**
 * Vault Store (Pinia)
 *
 * 管理解密后的 vault 明文数据和同步状态
 * 提供 TOTP 条目的 CRUD 操作
 */
import { defineStore } from 'pinia'
import type {
  VaultDocument,
  VaultPreferences,
  TotpEntry,
  PasswordEntry,
  SyncStatus,
  CryptoContext,
  EncryptedVaultSnapshot,
  KdfParams
} from '~/types/vault'
import {
  encrypt,
  hashSyncAuthSecret,
  generateId
} from '~/utils/crypto'
import {
  saveLocalSnapshot,
  enqueueSyncIntent
} from '~/utils/local-db'

/** 创建空的 vault 文档 */
function createEmptyVault(): VaultDocument {
  return {
    schemaVersion: 1,
    entries: [],
    passwords: [],
    sortOrder: [],
    preferences: {
      sortMode: 'alpha',
      autoLockMinutes: 5,
      showCodesOnUnlock: true
    },
    updatedAt: Date.now()
  }
}

export const useVaultStore = defineStore('vault', () => {
  // ============================================================
  // 状态
  // ============================================================

  /** 解密后的 vault 文档（仅存内存） */
  const decryptedVault = ref<VaultDocument | null>(null)

  /** 当前加密上下文（仅存内存） */
  const cryptoContext = ref<CryptoContext | null>(null)

  /** vault 是否已解锁 */
  const isUnlocked = computed(() => decryptedVault.value !== null && cryptoContext.value !== null)

  /** 同步状态 */
  const syncStatus = ref<SyncStatus>('idle')

  /** 当前远程 revision */
  const currentRevision = ref(0)

  /** 当前 salt（Base64） */
  const currentSalt = ref('')

  /** 当前 KDF 参数 */
  const currentKdfParams = ref<KdfParams | null>(null)

  // ============================================================
  // Getters
  // ============================================================

  /** 所有 TOTP 条目 */
  const entries = computed(() => decryptedVault.value?.entries ?? [])

  /** 所有密码条目 */
  const passwords = computed(() => decryptedVault.value?.passwords ?? [])

  /** 排序后的密码条目 */
  const sortedPasswords = computed(() => {
    return [...passwords.value].sort((a, b) => a.serviceName.localeCompare(b.serviceName))
  })

  /** 用户偏好 */
  const preferences = computed(() => decryptedVault.value?.preferences ?? {
    sortMode: 'alpha' as const,
    autoLockMinutes: 5,
    showCodesOnUnlock: true
  })

  /** 独立的 TOTP 平台（分类）集合 */
  const totpPlatforms = computed(() => {
    const set = new Set<string>()
    entries.value.forEach(e => {
      if (e.issuer) set.add(e.issuer)
    })
    return Array.from(set).sort()
  })

  /** 独立的账号密码平台（分类）集合 */
  const passwordPlatforms = computed(() => {
    const set = new Set<string>()
    passwords.value.forEach(p => {
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
        const orderMap = new Map(vault.sortOrder.map((id, idx) => [id, idx]))
        return entriesCopy.sort((a, b) => (orderMap.get(a.id) ?? 999) - (orderMap.get(b.id) ?? 999))
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
   * 设置加密上下文和解密后的 vault（解锁时调用）
   */
  function hydrate(
    vault: VaultDocument,
    ctx: CryptoContext,
    revision: number,
    salt: string,
    kdfParams: KdfParams
  ) {
    decryptedVault.value = vault
    cryptoContext.value = ctx
    currentRevision.value = revision
    currentSalt.value = salt
    currentKdfParams.value = kdfParams
  }

  /**
   * 初始化新 vault（setup 时调用）
   */
  function initializeEmpty(
    ctx: CryptoContext,
    salt: string,
    kdfParams: KdfParams
  ) {
    const emptyVault = createEmptyVault()
    decryptedVault.value = emptyVault
    cryptoContext.value = ctx
    currentRevision.value = 1
    currentSalt.value = salt
    currentKdfParams.value = kdfParams
  }

  /**
   * 锁定 vault：清除所有内存数据
   */
  function lock() {
    decryptedVault.value = null
    cryptoContext.value = null
    syncStatus.value = 'idle'
    // 不清除 revision/salt/kdfParams，解锁时需要
  }

  /**
   * 持久化当前 vault 状态（加密后存本地 + 尝试远程同步）
   */
  async function persistVault(): Promise<void> {
    const vault = decryptedVault.value
    const ctx = cryptoContext.value
    if (!vault || !ctx) return

    vault.updatedAt = Date.now()

    // 加密
    const payload = await encrypt(vault, ctx.encryptionKey)
    const authHash = await hashSyncAuthSecret(ctx.syncAuthSecret)

    const snapshot: EncryptedVaultSnapshot = {
      vaultId: 'default',
      ciphertext: payload.ciphertext,
      iv: payload.iv,
      salt: currentSalt.value,
      kdfParams: JSON.stringify(currentKdfParams.value),
      authTokenHash: authHash,
      revision: currentRevision.value,
      updatedAt: new Date().toISOString()
    }

    // 保存本地
    await saveLocalSnapshot(snapshot)

    // 尝试远程同步
    await syncToRemote(snapshot)
  }

  /**
   * 尝试将快照同步到远程
   */
  async function syncToRemote(snapshot: EncryptedVaultSnapshot): Promise<void> {
    syncStatus.value = 'syncing'
    try {
      const authHash = snapshot.authTokenHash
      const response = await $fetch('/api/vault', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${authHash}`
        },
        body: {
          ciphertext: snapshot.ciphertext,
          iv: snapshot.iv,
          salt: snapshot.salt,
          kdfParams: snapshot.kdfParams,
          authTokenHash: authHash,
          revision: snapshot.revision
        }
      })

      const result = response as { success: boolean, revision: number }
      currentRevision.value = result.revision
      syncStatus.value = 'synced'
      // 清除同步队列
      await import('~/utils/local-db').then(m => m.clearSyncQueue())
    } catch (err: unknown) {
      const error = err as { statusCode?: number }
      if (error.statusCode === 409) {
        syncStatus.value = 'conflict'
      } else {
        syncStatus.value = 'error'
        // 存入同步队列，等待后续重试
        await enqueueSyncIntent(snapshot)
      }
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

    decryptedVault.value.sortOrder = newOrder
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
    await persistVault()
  }

  return {
    // 状态
    decryptedVault,
    isUnlocked,
    syncStatus,
    currentRevision,
    currentSalt,
    currentKdfParams,
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
    deleteEntry,
    markEntryUsed,
    // 密码 CRUD
    addPassword,
    updatePassword,
    deletePassword,
    // 其他
    updatePreferences,
    updateSortOrder,
    setSyncStatus: (status: SyncStatus) => { syncStatus.value = status },
    setRevision: (rev: number) => { currentRevision.value = rev }
  }
})

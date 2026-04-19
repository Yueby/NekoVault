/**
 * 本地持久化层（IndexedDB）
 *
 * 使用 Dexie 封装 IndexedDB，存储：
 * - localSnapshots: 加密后的本地 Vault 缓存（用密码加密，支持离线访问）
 * - syncQueue: 待同步的写入意图
 * - lockoutState: 密码错误限速状态
 */
import Dexie from 'dexie'
import type {
  LocalSnapshot,
  LockoutState,
  PendingSyncIntent
} from '~/types/vault'

class NekoVaultDB extends Dexie {
  localSnapshots!: Dexie.Table<LocalSnapshot, string>
  syncQueue!: Dexie.Table<PendingSyncIntent & { id?: number }, number>
  lockoutState!: Dexie.Table<LockoutState, string>

  constructor() {
    super('NekoVaultDB')

    // 升级到 v2：适配新架构
    this.version(2).stores({
      localSnapshots: 'id',
      syncQueue: '++id, createdAt',
      lockoutState: 'id',
      // 删除旧表
      encryptedSnapshots: null
    })

    // 保留旧版本声明以支持迁移
    this.version(1).stores({
      encryptedSnapshots: 'id',
      syncQueue: '++id, createdAt',
      lockoutState: 'id'
    })
  }
}

// 单例实例
let dbInstance: NekoVaultDB | null = null

/**
 * 获取数据库实例（惰性初始化）
 */
export function getLocalDB(): NekoVaultDB {
  if (!dbInstance) {
    dbInstance = new NekoVaultDB()
  }
  return dbInstance
}

// ============================================================
// 本地快照操作
// ============================================================

/**
 * 保存本地快照
 */
export async function saveLocalSnapshot(snapshot: LocalSnapshot): Promise<void> {
  const db = getLocalDB()
  await db.localSnapshots.put(snapshot)
}

/**
 * 获取本地快照
 */
export async function getLocalSnapshot(): Promise<LocalSnapshot | null> {
  const db = getLocalDB()
  const record = await db.localSnapshots.get('default')
  return record ?? null
}

/**
 * 检查本地是否已有 vault
 */
export async function hasLocalVault(): Promise<boolean> {
  const db = getLocalDB()
  const count = await db.localSnapshots.count()
  return count > 0
}

// ============================================================
// 同步队列操作
// ============================================================

/**
 * 添加待同步写入意图
 */
export async function enqueueSyncIntent(intent: PendingSyncIntent): Promise<void> {
  const db = getLocalDB()
  // 清除旧的意图，只保留最新的
  await db.syncQueue.clear()
  await db.syncQueue.add(intent)
}

/**
 * 获取待同步的写入意图
 */
export async function getPendingSyncIntent(): Promise<PendingSyncIntent | null> {
  const db = getLocalDB()
  const items = await db.syncQueue.orderBy('createdAt').last()
  return items ?? null
}

/**
 * 清除同步队列
 */
export async function clearSyncQueue(): Promise<void> {
  const db = getLocalDB()
  await db.syncQueue.clear()
}

// ============================================================
// 错误密码限速状态
// ============================================================

/** 限速配置 */
const LOCKOUT_CONFIG = {
  /** 第一次触发限速的失败次数 */
  firstThreshold: 5,
  /** 第一次限速等待时间（毫秒）：30 秒 */
  firstLockoutMs: 30_000,
  /** 第二次触发限速的失败次数 */
  secondThreshold: 10,
  /** 第二次限速等待时间（毫秒）：5 分钟 */
  secondLockoutMs: 5 * 60_000
} as const

/**
 * 获取当前限速状态
 */
export async function getLockoutState(): Promise<LockoutState> {
  const db = getLocalDB()
  const state = await db.lockoutState.get('default')
  return state ?? { id: 'default', failedAttempts: 0, lockoutUntil: 0 }
}

/**
 * 记录一次密码验证失败
 * @returns 剩余等待秒数（0 表示未被锁定）
 */
export async function recordFailedAttempt(): Promise<number> {
  const db = getLocalDB()
  const state = await getLockoutState()
  state.failedAttempts += 1

  let lockoutMs = 0
  if (state.failedAttempts >= LOCKOUT_CONFIG.secondThreshold) {
    lockoutMs = LOCKOUT_CONFIG.secondLockoutMs
  } else if (state.failedAttempts >= LOCKOUT_CONFIG.firstThreshold) {
    lockoutMs = LOCKOUT_CONFIG.firstLockoutMs
  }

  if (lockoutMs > 0) {
    state.lockoutUntil = Date.now() + lockoutMs
  }

  await db.lockoutState.put(state)
  return lockoutMs > 0 ? Math.ceil(lockoutMs / 1000) : 0
}

/**
 * 检查是否处于锁定状态
 * @returns 剩余等待秒数（0 表示未锁定）
 */
export async function checkLockout(): Promise<number> {
  const state = await getLockoutState()
  if (state.lockoutUntil <= 0) return 0

  const remaining = state.lockoutUntil - Date.now()
  if (remaining <= 0) {
    return 0
  }
  return Math.ceil(remaining / 1000)
}

/**
 * 密码验证成功后重置限速状态
 */
export async function resetLockout(): Promise<void> {
  const db = getLocalDB()
  await db.lockoutState.put({ id: 'default', failedAttempts: 0, lockoutUntil: 0 })
}

// ============================================================
// 数据清除
// ============================================================

/**
 * 清除所有本地数据（不影响远程）
 */
export async function clearAllLocalData(): Promise<void> {
  const db = getLocalDB()
  await db.localSnapshots.clear()
  await db.syncQueue.clear()
  await db.lockoutState.clear()
}

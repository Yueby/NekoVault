/**
 * Session 管理 Composable
 *
 * 管理：
 * - 自动锁定（空闲检测 + 页面可见性）
 * - 解锁/锁定操作
 * - 初始化检测
 */
// useIdle 和 useDocumentVisibility 由 @vueuse/nuxt 自动导入
import type {
  KdfParams,
  EncryptedVaultSnapshot,
  VaultDocument,
} from "~/types/vault";
import {
  deriveKeys,
  decrypt,
  encrypt,
  hashSyncAuthSecret,
  generateSalt,
  uint8ArrayToBase64,
  base64ToUint8Array,
  benchmarkArgon2,
} from "~/utils/crypto";
import {
  hasLocalVault,
  getLocalSnapshot,
  saveLocalSnapshot,
  checkLockout,
  recordFailedAttempt,
  resetLockout,
} from "~/utils/local-db";
import { useVaultStore } from "~/stores/vault";

/** Session 状态 */
type SessionState = "loading" | "needs-setup" | "locked" | "unlocked";

export function useSession() {
  const vaultStore = useVaultStore();

  const sessionState = useState<SessionState>("session-state", () => "loading");
  const isInitializing = ref(false);
  const unlockError = ref("");
  const lockoutRemaining = ref(0);

  // 自动锁定配置
  const autoLockMinutes = computed(
    () => vaultStore.preferences.autoLockMinutes,
  );

  // 防止多实例重复注册自动锁定 watcher
  const autoLockRegistered = useState<boolean>(
    "auto-lock-registered",
    () => false,
  );

  if (!autoLockRegistered.value) {
    autoLockRegistered.value = true;

    // 使用自定义空闲检测（响应式超时）
    let lastActivity = Date.now();
    let _idleCheckTimer: ReturnType<typeof setInterval> | null = null;

    function resetActivity() {
      lastActivity = Date.now();
    }

    // 监听用户活动事件（ssr: false，代码仅在客户端运行）
    const activityEvents = [
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
    ] as const;
    for (const event of activityEvents) {
      document.addEventListener(event, resetActivity, { passive: true });
    }

    // 定期检查空闲状态（每 10 秒）
    _idleCheckTimer = setInterval(() => {
      const minutes = autoLockMinutes.value;
      if (minutes <= 0 || !vaultStore.isUnlocked) return;
      const elapsed = Date.now() - lastActivity;
      if (elapsed >= minutes * 60 * 1000) {
        lockVault();
      }
    }, 10_000);

    // 页面可见性检测
    const visibility = useDocumentVisibility();
    const hiddenSince = ref(0);

    watch(visibility, (v) => {
      if (v === "hidden" && vaultStore.isUnlocked) {
        hiddenSince.value = Date.now();
      } else if (
        v === "visible" &&
        hiddenSince.value > 0 &&
        vaultStore.isUnlocked
      ) {
        const elapsed = Date.now() - hiddenSince.value;
        const threshold = autoLockMinutes.value * 60 * 1000;
        if (autoLockMinutes.value > 0 && elapsed >= threshold) {
          lockVault();
        }
        hiddenSince.value = 0;
        resetActivity(); // 回到前台重置活动时间
      }
    });

    // 组件卸载时不清除（单例，应用级生命周期）
  }

  /**
   * 检查初始化状态
   */
  async function checkInitState(): Promise<SessionState> {
    const hasVault = await hasLocalVault();
    if (!hasVault) {
      sessionState.value = "needs-setup";
    } else if (!vaultStore.isUnlocked) {
      sessionState.value = "locked";
    } else {
      sessionState.value = "unlocked";
    }
    return sessionState.value;
  }

  /**
   * 初始化 Vault（Setup 流程）
   */
  async function setupVault(password: string): Promise<void> {
    isInitializing.value = true;
    try {
      // 性能基准测试
      const kdfParams = await benchmarkArgon2();
      const salt = generateSalt();

      // 派生密钥
      const ctx = await deriveKeys(password, salt, kdfParams);

      // 初始化空 vault
      vaultStore.initializeEmpty(ctx, uint8ArrayToBase64(salt), kdfParams);

      // 加密 — 深拷贝以兼容 readonly Ref
      const vaultData = JSON.parse(
        JSON.stringify(vaultStore.decryptedVault),
      ) as VaultDocument;
      const payload = await encrypt(vaultData, ctx.encryptionKey);
      const authHash = await hashSyncAuthSecret(ctx.syncAuthSecret);

      const saltBase64 = uint8ArrayToBase64(salt);
      const kdfParamsJson = JSON.stringify(kdfParams);

      // 同步到远程
      try {
        await $fetch("/api/bootstrap", {
          method: "POST",
          body: {
            ciphertext: payload.ciphertext,
            iv: payload.iv,
            salt: saltBase64,
            kdfParams: kdfParamsJson,
            authTokenHash: authHash,
          },
        });
      } catch {
        // 离线也可以继续，数据保存在本地
        console.warn("远程同步失败，vault 已保存在本地");
        vaultStore.setSyncStatus("offline");
      }

      // 保存本地快照
      const snapshot: EncryptedVaultSnapshot = {
        vaultId: "default",
        ciphertext: payload.ciphertext,
        iv: payload.iv,
        salt: saltBase64,
        kdfParams: kdfParamsJson,
        authTokenHash: authHash,
        revision: 1,
        updatedAt: new Date().toISOString(),
      };
      await saveLocalSnapshot(snapshot);

      sessionState.value = "unlocked";
    } finally {
      isInitializing.value = false;
    }
  }

  /**
   * 解锁 Vault
   */
  async function unlockVault(password: string): Promise<boolean> {
    unlockError.value = "";

    // 检查限速
    const remaining = await checkLockout();
    if (remaining > 0) {
      lockoutRemaining.value = remaining;
      unlockError.value = `密码尝试过多，请等待 ${remaining} 秒后重试`;
      return false;
    }

    try {
      // 获取加密快照（优先远程，离线用本地）
      let snapshot: EncryptedVaultSnapshot | null = null;

      const localSnapshot = await getLocalSnapshot();
      if (!localSnapshot) {
        unlockError.value = "未找到本地 vault 数据";
        return false;
      }

      // 使用本地快照的 salt 和 kdfParams 派生密钥
      const salt = base64ToUint8Array(localSnapshot.salt);
      const kdfParams: KdfParams = JSON.parse(localSnapshot.kdfParams);
      const ctx = await deriveKeys(password, salt, kdfParams);

      // 尝试在线获取最新快照
      try {
        const authHash = await hashSyncAuthSecret(ctx.syncAuthSecret);
        const remoteData = (await $fetch("/api/vault", {
          headers: {
            Authorization: `Bearer ${authHash}`,
          },
        })) as {
          ciphertext: string;
          iv: string;
          salt: string;
          kdfParams: string;
          revision: number;
          updatedAt: string;
        };

        snapshot = {
          vaultId: "default",
          ciphertext: remoteData.ciphertext,
          iv: remoteData.iv,
          salt: remoteData.salt,
          kdfParams: remoteData.kdfParams,
          authTokenHash: authHash,
          revision: remoteData.revision,
          updatedAt: remoteData.updatedAt,
        };

        // 更新本地快照
        await saveLocalSnapshot(snapshot);
      } catch {
        // 离线或验证失败，使用本地快照
        snapshot = localSnapshot;
        vaultStore.setSyncStatus("offline");
      }

      // 尝试解密
      const vault = await decrypt(
        { ciphertext: snapshot.ciphertext, iv: snapshot.iv },
        ctx.encryptionKey,
      );

      // 解密成功
      vaultStore.hydrate(
        vault,
        ctx,
        snapshot.revision,
        snapshot.salt,
        kdfParams,
      );
      await resetLockout();
      sessionState.value = "unlocked";
      return true;
    } catch {
      // 解密失败 = 密码错误
      const waitSeconds = await recordFailedAttempt();
      if (waitSeconds > 0) {
        lockoutRemaining.value = waitSeconds;
        unlockError.value = `密码错误。请等待 ${waitSeconds} 秒后重试`;
      } else {
        unlockError.value = "密码错误，请重试";
      }
      return false;
    }
  }

  /**
   * 锁定 Vault
   */
  function lockVault() {
    vaultStore.lock();
    sessionState.value = "locked";
    navigateTo("/unlock");
  }

  return {
    sessionState: readonly(sessionState),
    isInitializing: readonly(isInitializing),
    unlockError: readonly(unlockError),
    lockoutRemaining: readonly(lockoutRemaining),
    checkInitState,
    setupVault,
    unlockVault,
    lockVault,
  };
}

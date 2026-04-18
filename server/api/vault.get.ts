/**
 * GET /api/vault
 *
 * 获取最新的加密 vault 快照
 * 需要 Authorization: Bearer SHA256(syncAuthSecret) 验证
 */
export default defineEventHandler(async (event) => {
  // 验证授权
  await verifyAuth(event)

  const db = getDB(event)
  await ensureTable(db)

  const vault = await getVault(db)
  if (!vault) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      data: { error: 'not_found', message: 'Vault 不存在' }
    })
  }

  return {
    ciphertext: vault.ciphertext,
    iv: vault.iv,
    salt: vault.salt,
    kdfParams: vault.kdf_params,
    revision: vault.revision,
    updatedAt: vault.updated_at
  }
})

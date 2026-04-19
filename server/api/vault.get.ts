/**
 * GET /api/vault
 *
 * 获取当前 vault 数据
 * 需要 x-admin-token 头通过鉴权
 */
export default defineEventHandler(async (event) => {
  // 鉴权
  await verifyAdminToken(event)

  const db = getDB(event)

  const vault = await getVault(db)
  if (!vault) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      data: { error: 'not_found', message: 'Vault 不存在' }
    })
  }

  return {
    data: vault.data,
    revision: vault.revision,
    updatedAt: vault.updated_at
  }
})

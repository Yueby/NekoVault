/**
 * PUT /api/vault
 *
 * 更新加密 vault 快照
 * 使用乐观并发控制：revision 不匹配时返回 409
 */
import { vaultUpdateRequestSchema } from '~~/shared/schemas/vault'

export default defineEventHandler(async (event) => {
  // 验证授权
  await verifyAuth(event)

  // 校验请求体
  const body = await readBody(event)
  const parseResult = vaultUpdateRequestSchema.safeParse(body)
  if (!parseResult.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      data: { error: 'validation', message: '请求数据校验失败', details: parseResult.error.issues }
    })
  }

  const data = parseResult.data

  const db = getDB(event)
  await ensureTable(db)

  // 尝试更新（带乐观并发控制）
  const updated = await updateVault(db, {
    ciphertext: data.ciphertext,
    iv: data.iv,
    salt: data.salt,
    kdfParams: data.kdfParams,
    authTokenHash: data.authTokenHash,
    expectedRevision: data.revision
  })

  if (!updated) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Conflict',
      data: { error: 'conflict', message: '版本冲突：远程 vault 已被更新，请解决冲突后重试' }
    })
  }

  return {
    success: true,
    revision: updated.revision,
    updatedAt: updated.updated_at
  }
})

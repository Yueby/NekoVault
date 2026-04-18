/**
 * POST /api/bootstrap
 *
 * 创建首个 Vault 快照
 * 仅在 vault 不存在时允许调用，否则返回 409
 */
import { bootstrapRequestSchema } from '~~/shared/schemas/vault'

export default defineEventHandler(async (event) => {
  const db = getDB(event)
  await ensureTable(db)

  // 检查 vault 是否已存在
  if (await vaultExists(db)) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Conflict',
      data: { error: 'conflict', message: 'Vault 已存在，无法重复创建' }
    })
  }

  // 校验请求体
  const body = await readBody(event)
  const parseResult = bootstrapRequestSchema.safeParse(body)
  if (!parseResult.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      data: { error: 'validation', message: '请求数据校验失败', details: parseResult.error.issues }
    })
  }

  const data = parseResult.data

  // 创建 vault
  const vault = await createVault(db, {
    ciphertext: data.ciphertext,
    iv: data.iv,
    salt: data.salt,
    kdfParams: data.kdfParams,
    authTokenHash: data.authTokenHash
  })

  setResponseStatus(event, 201)
  return {
    success: true,
    revision: vault.revision,
    updatedAt: vault.updated_at
  }
})

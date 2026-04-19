/**
 * POST /api/bootstrap
 *
 * 创建首个 Vault
 * 仅在 vault 不存在时允许调用，否则返回 409
 */
export default defineEventHandler(async (event) => {
  // 鉴权
  await verifyAdminToken(event)

  const db = getDB(event)

  // 检查 vault 是否已存在
  if (await vaultExists(db)) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Conflict',
      data: { error: 'conflict', message: 'Vault 已存在，无法重复创建' }
    })
  }

  // 读取请求体（明文 JSON）
  const body = await readBody(event)
  if (!body || typeof body.data !== 'string') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      data: { error: 'validation', message: '请求数据格式错误，需要 data 字段' }
    })
  }

  // 校验 JSON 合法性
  try {
    JSON.parse(body.data as string)
  } catch {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      data: { error: 'validation', message: 'data 字段不是合法的 JSON' }
    })
  }

  // 创建 vault
  const vault = await createVault(db, body.data as string)

  setResponseStatus(event, 201)
  return {
    success: true,
    revision: vault.revision,
    updatedAt: vault.updated_at
  }
})

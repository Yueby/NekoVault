/**
 * PUT /api/vault
 *
 * 更新 vault 数据
 * 使用乐观并发控制：revision 不匹配时返回 409
 */
export default defineEventHandler(async (event) => {
  // 鉴权
  await verifyAdminToken(event)

  // 读取请求体
  const body = await readBody(event)
  if (!body || typeof body.data !== 'string' || typeof body.revision !== 'number') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      data: { error: 'validation', message: '请求数据格式错误，需要 data 和 revision 字段' }
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

  const db = getDB(event)

  // 尝试更新（带乐观并发控制）
  const updated = await updateVault(db, body.data as string, body.revision as number)

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

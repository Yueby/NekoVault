/**
 * POST /api/vault/verify
 *
 * 轻量级凭证验证端点
 * 仅验证 ADMIN_TOKEN 是否有效
 */
export default defineEventHandler(async (event) => {
  await verifyAdminToken(event)

  return {
    valid: true
  }
})

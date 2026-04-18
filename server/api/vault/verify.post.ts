/**
 * POST /api/vault/verify
 *
 * 轻量级凭证验证端点
 * 仅验证 sync-auth 凭证是否有效，不返回 vault 数据
 * 用于：setup 后的连通性验证、修改密码后的远程验证
 */
export default defineEventHandler(async (event) => {
  await verifyAuth(event)

  return {
    valid: true
  }
})

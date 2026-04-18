/**
 * 安全头 Server Middleware
 *
 * 为所有响应添加安全 HTTP 头
 */
export default defineEventHandler((event) => {
  const headers = event.node.res

  // 严格传输安全
  headers.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')

  // 禁止 MIME 类型嗅探
  headers.setHeader('X-Content-Type-Options', 'nosniff')

  // 禁止在 iframe 中加载
  headers.setHeader('X-Frame-Options', 'DENY')

  // 不发送 Referrer
  headers.setHeader('Referrer-Policy', 'no-referrer')

  // 禁用不需要的浏览器 API
  headers.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()'
  )

  // CSP — Nuxt SPA 模式不需要 unsafe-inline script，style 因 Tailwind/Nuxt UI 仍需保留
  headers.setHeader(
    'Content-Security-Policy',
    [
      'default-src \'self\'',
      'script-src \'self\'',
      'style-src \'self\' \'unsafe-inline\'', // Tailwind/Nuxt UI 需要 inline styles
      'img-src \'self\' data: blob:',
      'font-src \'self\' data:',
      'connect-src \'self\' https://raw.githubusercontent.com', // 版本检查需要访问 GitHub
      'worker-src \'self\' blob:',
      'frame-src \'none\'',
      'object-src \'none\'',
      'base-uri \'self\'',
      'form-action \'self\''
    ].join('; ')
  )
})

/**
 * 品牌图标映射工具
 *
 * 根据服务名称（issuer / serviceName）返回对应的 simple-icons 图标类名
 * 方便维护和扩展
 */

/** 品牌名 → Iconify 图标 class 映射 */
export const brandIconMap: Record<string, string> = {
  github: 'i-simple-icons-github',
  google: 'i-simple-icons-google',
  aws: 'i-simple-icons-amazonaws',
  amazon: 'i-simple-icons-amazon',
  microsoft: 'i-simple-icons-microsoft',
  apple: 'i-simple-icons-apple',
  discord: 'i-simple-icons-discord',
  twitter: 'i-simple-icons-x',
  x: 'i-simple-icons-x',
  facebook: 'i-simple-icons-facebook',
  cloudflare: 'i-simple-icons-cloudflare',
  steam: 'i-simple-icons-steam',
  aliyun: 'i-simple-icons-alibabacloud',
  tencent: 'i-simple-icons-tencentqq',
  npm: 'i-simple-icons-npm',
  digitalocean: 'i-simple-icons-digitalocean',
  vercel: 'i-simple-icons-vercel',
  netlify: 'i-simple-icons-netlify',
  gitlab: 'i-simple-icons-gitlab',
  bitbucket: 'i-simple-icons-bitbucket',
  slack: 'i-simple-icons-slack',
  dropbox: 'i-simple-icons-dropbox',
  paypal: 'i-simple-icons-paypal',
  stripe: 'i-simple-icons-stripe'
}

/** 默认图标（无匹配时兜底） */
export const DEFAULT_ICON = 'i-lucide-key'

/**
 * 根据文本匹配品牌图标
 * 按优先级检查 subtitle → title，首次匹配即返回
 */
export function resolveBrandIcon(
  iconName?: string,
  subtitle?: string,
  title?: string
): string {
  // 优先使用明确指定的图标
  if (iconName) return iconName

  // 智能匹配 subtitle / title
  const texts = [subtitle || '', title || ''].map(s => s.toLowerCase())
  for (const text of texts) {
    if (!text) continue
    for (const [brand, icon] of Object.entries(brandIconMap)) {
      if (text.includes(brand)) return icon
    }
  }

  return DEFAULT_ICON
}

/**
 * 品牌图标映射工具
 *
 * 根据服务名称（issuer / serviceName）返回对应的 simple-icons 图标类名
 * 方便维护和扩展
 */

/** 品牌名 → Iconify 图标 class 映射 */
export const brandIconMap: Record<string, string> = {
  // 代码 / 云服务 / 网络基础设施
  'github': 'i-simple-icons-github',
  'gitlab': 'i-simple-icons-gitlab',
  'bitbucket': 'i-simple-icons-bitbucket',
  'npm': 'i-simple-icons-npm',
  'docker': 'i-simple-icons-docker',
  'vercel': 'i-simple-icons-vercel',
  'netlify': 'i-simple-icons-netlify',
  'cloudflare': 'i-simple-icons-cloudflare',
  'digitalocean': 'i-simple-icons-digitalocean',
  'linode': 'i-simple-icons-linode',
  'vultr': 'i-simple-icons-vultr',
  'heroku': 'i-simple-icons-heroku',
  'render': 'i-simple-icons-render',
  'railway': 'i-simple-icons-railway',
  'fly.io': 'i-simple-icons-flydotio',
  'flyio': 'i-simple-icons-flydotio',
  'tailscale': 'i-simple-icons-tailscale',
  'aws': 'i-simple-icons-amazonaws',
  'azure': 'i-simple-icons-microsoftazure',
  'google cloud': 'i-simple-icons-googlecloud',
  'gcp': 'i-simple-icons-googlecloud',
  'aliyun': 'i-simple-icons-alibabacloud',
  'alibaba cloud': 'i-simple-icons-alibabacloud',
  'tencent': 'i-simple-icons-tencentqq',

  // 大厂账号 / 邮箱
  'google': 'i-simple-icons-google',
  'gmail': 'i-simple-icons-gmail',
  'googlemail': 'i-simple-icons-gmail',
  'outlook': 'i-simple-icons-microsoftoutlook',
  'hotmail': 'i-simple-icons-microsoftoutlook',
  'proton mail': 'i-simple-icons-protonmail',
  'protonmail': 'i-simple-icons-protonmail',
  'proton': 'i-simple-icons-protonmail',
  'yahoo': 'i-simple-icons-yahoo',
  'icloud': 'i-simple-icons-icloud',
  'zoho': 'i-simple-icons-zoho',
  'fastmail': 'i-simple-icons-fastmail',
  'amazon': 'i-simple-icons-amazon',
  'microsoft': 'i-simple-icons-microsoft',
  'apple': 'i-simple-icons-apple',

  // 游戏平台
  'steam': 'i-simple-icons-steam',
  'epic games': 'i-simple-icons-epicgames',
  'epicgames': 'i-simple-icons-epicgames',
  'epic': 'i-simple-icons-epicgames',
  'rockstar games': 'i-simple-icons-rockstargames',
  'rockstar': 'i-simple-icons-rockstargames',
  'r星': 'i-simple-icons-rockstargames',
  'social club': 'i-simple-icons-rockstargames',
  'playstation': 'i-simple-icons-playstation',
  'psn': 'i-simple-icons-playstation',
  'xbox': 'i-simple-icons-xbox',
  'nintendo': 'i-simple-icons-nintendo',
  'switch': 'i-simple-icons-nintendo',
  'riot games': 'i-simple-icons-riotgames',
  'riot': 'i-simple-icons-riotgames',
  'valorant': 'i-simple-icons-valorant',
  'league of legends': 'i-simple-icons-leagueoflegends',
  'lol': 'i-simple-icons-leagueoflegends',
  'ea': 'i-simple-icons-ea',
  'electronic arts': 'i-simple-icons-ea',
  'origin': 'i-simple-icons-ea',
  'ubisoft': 'i-simple-icons-ubisoft',
  'battle.net': 'i-simple-icons-battledotnet',
  'battlenet': 'i-simple-icons-battledotnet',
  'blizzard': 'i-simple-icons-blizzardentertainment',
  'gog.com': 'i-simple-icons-gogdotcom',
  'gog': 'i-simple-icons-gogdotcom',
  'itch.io': 'i-simple-icons-itchdotio',
  'itch': 'i-simple-icons-itchdotio',
  'humble bundle': 'i-simple-icons-humblebundle',
  'humble': 'i-simple-icons-humblebundle',
  'roblox': 'i-simple-icons-roblox',
  'minecraft': 'i-simple-icons-minecraft',
  'hoyoverse': 'i-simple-icons-hoyoverse',
  'mihoyo': 'i-simple-icons-hoyoverse',
  'osu': 'i-simple-icons-osu',

  // 社交 / 聊天 / 社区
  'discord': 'i-simple-icons-discord',
  'slack': 'i-simple-icons-slack',
  'telegram': 'i-simple-icons-telegram',
  'whatsapp': 'i-simple-icons-whatsapp',
  'signal': 'i-simple-icons-signal',
  'line': 'i-simple-icons-line',
  'skype': 'i-simple-icons-skype',
  'zoom': 'i-simple-icons-zoom',
  'teams': 'i-simple-icons-microsoftteams',
  'microsoft teams': 'i-simple-icons-microsoftteams',
  'messenger': 'i-simple-icons-messenger',
  'wechat': 'i-simple-icons-wechat',
  'weixin': 'i-simple-icons-wechat',
  '微信': 'i-simple-icons-wechat',
  'qq': 'i-simple-icons-tencentqq',
  'instagram': 'i-simple-icons-instagram',
  'tiktok': 'i-simple-icons-tiktok',
  'douyin': 'i-simple-icons-douyin',
  '抖音': 'i-simple-icons-douyin',
  'youtube': 'i-simple-icons-youtube',
  'twitter': 'i-simple-icons-x',
  'x': 'i-simple-icons-x',
  'facebook': 'i-simple-icons-facebook',
  'reddit': 'i-simple-icons-reddit',
  'linkedin': 'i-simple-icons-linkedin',
  'pinterest': 'i-simple-icons-pinterest',
  'snapchat': 'i-simple-icons-snapchat',
  'threads': 'i-simple-icons-threads',
  'bluesky': 'i-simple-icons-bluesky',
  'mastodon': 'i-simple-icons-mastodon',
  'tumblr': 'i-simple-icons-tumblr',
  'medium': 'i-simple-icons-medium',
  'weibo': 'i-simple-icons-sinaweibo',
  '微博': 'i-simple-icons-sinaweibo',

  // 流媒体 / 内容平台
  'twitch': 'i-simple-icons-twitch',
  'netflix': 'i-simple-icons-netflix',
  'spotify': 'i-simple-icons-spotify',
  'youtube music': 'i-simple-icons-youtubemusic',
  'youtubemusic': 'i-simple-icons-youtubemusic',
  'apple music': 'i-simple-icons-applemusic',
  'applemusic': 'i-simple-icons-applemusic',
  'apple tv': 'i-simple-icons-appletv',
  'appletv': 'i-simple-icons-appletv',
  'disney+': 'i-simple-icons-disneyplus',
  'disney plus': 'i-simple-icons-disneyplus',
  'disneyplus': 'i-simple-icons-disneyplus',
  'hulu': 'i-simple-icons-hulu',
  'hbo': 'i-simple-icons-hbo',
  'prime video': 'i-simple-icons-primevideo',
  'primevideo': 'i-simple-icons-primevideo',
  'crunchyroll': 'i-simple-icons-crunchyroll',
  'bilibili': 'i-simple-icons-bilibili',
  '哔哩哔哩': 'i-simple-icons-bilibili',
  'b站': 'i-simple-icons-bilibili',

  // 支付 / 金融
  'paypal': 'i-simple-icons-paypal',
  'stripe': 'i-simple-icons-stripe',
  'visa': 'i-simple-icons-visa',
  'mastercard': 'i-simple-icons-mastercard',
  'alipay': 'i-simple-icons-alipay',
  '支付宝': 'i-simple-icons-alipay',
  'wechat pay': 'i-simple-icons-wechatpay',
  'wechatpay': 'i-simple-icons-wechatpay',
  '微信支付': 'i-simple-icons-wechatpay',
  'unionpay': 'i-simple-icons-unionpay',
  '银联': 'i-simple-icons-unionpay',
  'wise': 'i-simple-icons-wise',
  'revolut': 'i-simple-icons-revolut',
  'binance': 'i-simple-icons-binance',
  'coinbase': 'i-simple-icons-coinbase',
  'patreon': 'i-simple-icons-patreon',
  'kofi': 'i-simple-icons-kofi',

  // 存储 / 办公
  'dropbox': 'i-simple-icons-dropbox',
  'notion': 'i-simple-icons-notion',
  'obsidian': 'i-simple-icons-obsidian',
  'figma': 'i-simple-icons-figma',
  'canva': 'i-simple-icons-canva'
}

/** 默认图标（无匹配时兜底） */
export const DEFAULT_ICON = 'i-lucide-key'

function normalizeBrandText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function compactBrandText(value: string): string {
  return normalizeBrandText(value).replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '')
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function matchesBrand(text: string, brand: string): boolean {
  const normalizedText = normalizeBrandText(text)
  const normalizedBrand = normalizeBrandText(brand)
  if (!normalizedText || !normalizedBrand) return false

  const compactText = compactBrandText(normalizedText)
  const compactBrand = compactBrandText(normalizedBrand)

  if (compactBrand.length <= 2) {
    const boundaryPattern = new RegExp(
      `(^|[^a-z0-9])${escapeRegExp(normalizedBrand)}([^a-z0-9]|$)`
    )
    return boundaryPattern.test(normalizedText) || compactText === compactBrand
  }

  return normalizedText.includes(normalizedBrand) || compactText.includes(compactBrand)
}

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
  const texts = [subtitle || '', title || '']
  const icons = Object.entries(brandIconMap).sort(
    ([a], [b]) => compactBrandText(b).length - compactBrandText(a).length
  )

  for (const text of texts) {
    if (!text) continue
    for (const [brand, icon] of icons) {
      if (matchesBrand(text, brand)) return icon
    }
  }

  return DEFAULT_ICON
}

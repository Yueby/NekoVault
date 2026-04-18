<script setup lang="ts">
/**
 * VaultEntryCard — 通用卡片容器
 * 统一验证码与密码卡片的界面结构与交互（左侧图标、右键菜单、悬停组、通用边距）
 */
const props = defineProps<{
  iconName?: string
  title: string
  subtitle?: string
  contextItems: any[][]
}>()

const emit = defineEmits<{
  click: []
}>()

// 品牌图标映射库
const brandIcons: Record<string, string> = {
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

// 智能解算最终图标（优先明确指定 -> 其次智能匹配标题/副标题 -> 最后兜底）
const resolvedIconName = computed(() => {
  if (props.iconName) return props.iconName
  
  const texts = [props.subtitle || '', props.title || ''].map(s => s.toLowerCase())
  for (const text of texts) {
    if (!text) continue
    for (const [brand, icon] of Object.entries(brandIcons)) {
      if (text.includes(brand)) return icon
    }
  }
  
  return 'i-lucide-key'
})
</script>

<template>
  <UContextMenu :items="contextItems">
    <UCard
      class="cursor-pointer transition-shadow hover:shadow-md active:scale-[0.98] transition-transform group"
      @click="emit('click')"
    >
      <div class="space-y-3">
        <!-- 顶部信息区 -->
        <div class="flex items-center gap-3">
          <!-- Icon -->
          <div class="flex-shrink-0 w-10 h-10 rounded-xl bg-[var(--ui-color-primary)]/10 flex items-center justify-center">
            <UIcon
              :name="resolvedIconName"
              class="w-5 h-5 text-[var(--ui-color-primary)]"
            />
          </div>
          
          <!-- 文本区 -->
          <div class="flex-1 min-w-0">
            <!-- 弱化的副标题 (如 serviceName / issuer) -->
            <div class="flex items-center gap-1.5 mb-0.5">
              <span class="text-xs text-[var(--ui-text-muted)] truncate">
                {{ subtitle || '未知服务' }}
              </span>
              <slot name="badge" />
            </div>
            
            <!-- 强化的主标题 (如 username / issuer) -->
            <div class="flex items-center justify-between">
              <p class="text-sm font-semibold text-[var(--ui-text-highlighted)] truncate">
                {{ title }}
              </p>
              <slot name="title-trailing" />
            </div>
          </div>
          
          <!-- 右上角挂载点 (如倒计时圆环) -->
          <slot name="top-right" />
        </div>

        <USeparator class="my-1" />

        <!-- 底部主内容区 (验证码数字 / 明文密码) -->
        <div class="flex items-center justify-between gap-2">
          <slot name="bottom" />
        </div>
      </div>
    </UCard>
  </UContextMenu>
</template>

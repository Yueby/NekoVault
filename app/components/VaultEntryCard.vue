<script setup lang="ts">
/**
 * VaultEntryCard — 通用卡片容器
 * 统一验证码与密码卡片的界面结构与交互（左侧图标、右键菜单、悬停组、通用边距）
 */
import { resolveBrandIcon } from '~/utils/brand-icons'

/** 右键菜单项类型 */
export interface ContextMenuItem {
  label: string
  icon?: string
  color?: 'primary' | 'error' | 'warning' | 'success' | 'neutral'
  onSelect?: () => void
}

const props = defineProps<{
  iconName?: string
  title: string
  subtitle?: string
  contextItems: ContextMenuItem[][]
}>()

const emit = defineEmits<{
  click: []
}>()

// 智能解算最终图标（优先明确指定 -> 其次智能匹配标题/副标题 -> 最后兜底）
const resolvedIconName = computed(() =>
  resolveBrandIcon(props.iconName, props.subtitle, props.title)
)
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

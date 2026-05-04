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
  manualSortActive?: boolean
}>()

const emit = defineEmits<{
  click: []
}>()

// 智能解算最终图标（优先明确指定 -> 其次智能匹配标题/副标题 -> 最后兜底）
const resolvedIconName = computed(() =>
  resolveBrandIcon(props.iconName, props.subtitle, props.title)
)

const isContextMenuOpen = ref(false)
const contextMenuPosition = reactive({ x: 0, y: 0 })

const cardClass = computed(() => props.manualSortActive
  ? 'cursor-grab transition-shadow hover:shadow-md active:cursor-grabbing group'
  : 'cursor-pointer transition-shadow hover:shadow-md active:scale-[0.98] transition-transform group'
)

const contextMenuStyle = computed(() => ({
  left: `${contextMenuPosition.x}px`,
  top: `${contextMenuPosition.y}px`
}))

function closeContextMenu() {
  isContextMenuOpen.value = false
}

function openContextMenu(event: MouseEvent) {
  event.preventDefault()
  event.stopPropagation()

  const menuWidth = 192
  const estimatedItemHeight = 36
  const estimatedMenuHeight = props.contextItems.reduce(
    (height, group) => height + group.length * estimatedItemHeight,
    Math.max(8, props.contextItems.length - 1) * 4
  )

  contextMenuPosition.x = Math.max(8, Math.min(event.clientX, window.innerWidth - menuWidth - 8))
  contextMenuPosition.y = Math.max(8, Math.min(event.clientY, window.innerHeight - estimatedMenuHeight - 8))
  isContextMenuOpen.value = true
}

function handleCardClick() {
  closeContextMenu()
  emit('click')
}

function selectContextItem(item: ContextMenuItem) {
  closeContextMenu()
  item.onSelect?.()
}

function getContextItemClass(item: ContextMenuItem): string {
  switch (item.color) {
    case 'error':
      return 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40'
    case 'warning':
      return 'text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/40'
    case 'success':
      return 'text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40'
    case 'primary':
      return 'text-[var(--ui-primary)] hover:bg-[var(--ui-primary)]/10'
    default:
      return 'text-[var(--ui-text)] hover:bg-[var(--ui-bg-muted)]'
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') closeContextMenu()
}

onMounted(() => window.addEventListener('keydown', handleKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', handleKeydown))
</script>

<template>
  <div>
    <UCard
      :class="cardClass"
      @click="handleCardClick"
      @contextmenu="openContextMenu"
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

    <Teleport to="body">
      <div
        v-if="isContextMenuOpen"
        class="fixed inset-0 z-[100]"
        @pointerdown="closeContextMenu"
        @contextmenu.prevent="closeContextMenu"
      >
        <div
          role="menu"
          class="fixed min-w-48 overflow-hidden rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg)] p-1 shadow-xl ring-1 ring-black/5 dark:ring-white/10"
          :style="contextMenuStyle"
          @click.stop
          @pointerdown.stop
          @contextmenu.prevent.stop
        >
          <template
            v-for="(group, groupIndex) in contextItems"
            :key="groupIndex"
          >
            <div
              v-if="groupIndex > 0"
              class="my-1 h-px bg-[var(--ui-border)]"
            />
            <button
              v-for="item in group"
              :key="`${item.label}-${item.icon ?? ''}`"
              type="button"
              role="menuitem"
              class="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors"
              :class="getContextItemClass(item)"
              @click="selectContextItem(item)"
            >
              <UIcon
                v-if="item.icon"
                :name="item.icon"
                class="h-4 w-4 shrink-0"
              />
              <span class="truncate">{{ item.label }}</span>
            </button>
          </template>
        </div>
      </div>
    </Teleport>
  </div>
</template>

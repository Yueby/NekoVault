<script setup lang="ts">
/**
 * VaultEntryCard — 通用卡片容器
 * 统一验证码与账号卡片的界面结构与交互（左侧图标、右键菜单、悬停组、通用边距）
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
  title: string
  subtitle?: string
  contextItems: ContextMenuItem[][]
  manualSortActive?: boolean
}>()

const emit = defineEmits<{
  click: []
}>()

// 解算最终图标：只匹配平台/分类名 subtitle，不从账号名/标题/密钥猜平台
const resolvedIconName = computed(() =>
  resolveBrandIcon(props.subtitle)
)

const isContextMenuOpen = ref(false)
const contextMenuPosition = reactive({ x: 0, y: 0 })
const menuOpenedAt = ref(0)

// 手动排序模式下的触摸长按计时器
const longPressTimer = ref<ReturnType<typeof setTimeout> | null>(null)
const touchStartPos = reactive({ x: 0, y: 0 })
const wasLongPress = ref(false)

const LONG_PRESS_MS = 300 // 与 Sortable 触摸 delay 同步

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

function showContextMenuAt(x: number, y: number) {
  const menuWidth = 192
  const estimatedItemHeight = 36
  const estimatedMenuHeight = props.contextItems.reduce(
    (height, group) => height + group.length * estimatedItemHeight,
    Math.max(8, props.contextItems.length - 1) * 4
  )
  contextMenuPosition.x = Math.max(8, Math.min(x, window.innerWidth - menuWidth - 8))
  contextMenuPosition.y = Math.max(8, Math.min(y, window.innerHeight - estimatedMenuHeight - 8))
  menuOpenedAt.value = Date.now()
  isContextMenuOpen.value = true
}

function handleOverlayPointerDown() {
  if (Date.now() - menuOpenedAt.value < 450) return
  closeContextMenu()
}

function handleOverlayContextMenu(event: MouseEvent) {
  event.preventDefault()
  if (Date.now() - menuOpenedAt.value < 450) return
  closeContextMenu()
}

function openContextMenu(event: MouseEvent) {
  event.preventDefault()
  event.stopPropagation()
  showContextMenuAt(event.clientX, event.clientY)
}

/** 手动排序模式：触摸长按弹菜单，手指移动则隐藏菜单 */
function handleTouchStartForSort(event: TouchEvent) {
  if (!props.manualSortActive) return
  const touch = event.touches[0]
  if (!touch) return
  wasLongPress.value = false
  touchStartPos.x = touch.clientX
  touchStartPos.y = touch.clientY
  longPressTimer.value = setTimeout(() => {
    wasLongPress.value = true
    showContextMenuAt(touchStartPos.x, touchStartPos.y)
  }, LONG_PRESS_MS)
}

function handleTouchMoveForSort(event: TouchEvent) {
  const touch = event.touches[0]
  if (!touch) return
  const dx = touch.clientX - touchStartPos.x
  const dy = touch.clientY - touchStartPos.y
  if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
    // 手指移动超过阈值：取消长按计时，关闭已弹出的菜单
    if (longPressTimer.value) {
      clearTimeout(longPressTimer.value)
      longPressTimer.value = null
    }
    wasLongPress.value = false
    closeContextMenu()
  }
}

function handleTouchEndForSort() {
  if (longPressTimer.value) {
    clearTimeout(longPressTimer.value)
    longPressTimer.value = null
  }
}

function handleCardClick() {
  // 长按弹菜单后的 touchend→click 序列应被吞掉，不触发 click 也不关菜单
  if (wasLongPress.value) {
    wasLongPress.value = false
    return
  }
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

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
  if (longPressTimer.value) {
    clearTimeout(longPressTimer.value)
    longPressTimer.value = null
  }
})
</script>

<template>
  <div>
    <UCard
      :class="cardClass"
      @click="handleCardClick"
      @contextmenu="openContextMenu"
      @touchstart.passive="handleTouchStartForSort"
      @touchmove.passive="handleTouchMoveForSort"
      @touchend="handleTouchEndForSort"
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

        <!-- 底部主内容区 (验证码数字 / 密钥) -->
        <div class="flex items-center justify-between gap-2">
          <slot name="bottom" />
        </div>
      </div>
    </UCard>

    <Teleport to="body">
      <div
        v-if="isContextMenuOpen"
        class="fixed inset-0 z-[100]"
        @pointerdown="handleOverlayPointerDown"
        @contextmenu="handleOverlayContextMenu"
      >
        <Transition
          appear
          enter-active-class="transition duration-100 ease-out"
          enter-from-class="opacity-0 scale-95"
          enter-to-class="opacity-100 scale-100"
          leave-active-class="transition duration-75 ease-in"
          leave-from-class="opacity-100 scale-100"
          leave-to-class="opacity-0 scale-95"
        >
          <div
            role="menu"
            class="fixed min-w-48 origin-top-left overflow-hidden rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg)] p-1 shadow-xl ring-1 ring-black/5 dark:ring-white/10"
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
        </Transition>
      </div>
    </Teleport>
  </div>
</template>

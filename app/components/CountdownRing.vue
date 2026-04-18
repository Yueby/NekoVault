<script setup lang="ts">
/**
 * CountdownRing — SVG 圆环倒计时组件
 *
 * 可视化 TOTP 刷新周期的剩余时间
 */

const props = withDefaults(defineProps<{
  /** TOTP 周期（秒） */
  period?: number
  /** 圆环尺寸（px） */
  size?: number
  /** 线条宽度（px） */
  strokeWidth?: number
}>(), {
  period: 30,
  size: 40,
  strokeWidth: 3
})

const { remaining, progress } = useCountdown(toRef(() => props.period))

const radius = computed(() => (props.size - props.strokeWidth) / 2)
const circumference = computed(() => 2 * Math.PI * radius.value)
const dashOffset = computed(() => circumference.value * (1 - progress.value))

// 根据剩余时间变色：>10s 绿色, 5-10s 橙色, <5s 红色
const strokeColor = computed(() => {
  if (remaining.value <= 5) return 'var(--ui-color-error-500, #ef4444)'
  if (remaining.value <= 10) return 'var(--ui-color-warning-500, #f59e0b)'
  return 'var(--ui-color-primary-500, #10b981)'
})
</script>

<template>
  <div
    class="relative inline-flex items-center justify-center"
    :style="{ width: `${size}px`, height: `${size}px` }"
  >
    <svg
      :width="size"
      :height="size"
      class="transform -rotate-90"
    >
      <!-- 背景环 -->
      <circle
        :cx="size / 2"
        :cy="size / 2"
        :r="radius"
        fill="none"
        stroke="currentColor"
        class="text-[var(--ui-bg-elevated)] opacity-30"
        :stroke-width="strokeWidth"
      />
      <!-- 进度环 -->
      <circle
        :cx="size / 2"
        :cy="size / 2"
        :r="radius"
        fill="none"
        :stroke="strokeColor"
        :stroke-width="strokeWidth"
        stroke-linecap="round"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="dashOffset"
        class="transition-[stroke-dashoffset] duration-300 ease-linear"
      />
    </svg>
    <!-- 中间数字 -->
    <span
      class="absolute text-xs font-mono font-bold"
      :style="{ color: strokeColor }"
    >
      {{ remaining }}
    </span>
  </div>
</template>

<script setup lang="ts">
/**
 * 首页 — 重定向到 /codes 或 /setup
 * 路由守卫会处理实际跳转逻辑
 */
definePageMeta({
  layout: false
})
</script>

<template>
  <div class="min-h-dvh flex items-center justify-center bg-[var(--ui-bg)]">
    <UIcon
      name="i-lucide-loader-2"
      class="w-8 h-8 text-primary-500 animate-spin"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * 设置页面 — 重定向到主页面的设置 Tab
 *
 * 设置功能已内联到 codes 页面的底部导航栏
 */
definePageMeta({
  layout: false
})

// 直接跳转到 codes 页（设置 tab 通过底部导航切换）
navigateTo('/codes')
</script>

<template>
  <div />
</template>

<script setup lang="ts">
useHead({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no' },
    { name: 'mobile-web-app-capable', content: 'yes' },
    { name: 'apple-mobile-web-app-capable', content: 'yes' },
    { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' }
  ],
  link: [
    { rel: 'icon', href: '/logo.svg', type: 'image/svg+xml' }
  ],
  htmlAttrs: {
    lang: 'zh-CN'
  }
})

const title = 'NekoVault'
const description = '安全的个人 TOTP 验证码管理器，支持跨设备同步和离线使用'

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description
})
</script>

<template>
  <UApp :toaster="{ position: 'top-center' }">
    <NuxtPage />
  </UApp>
</template>

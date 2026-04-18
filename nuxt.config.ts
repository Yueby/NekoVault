// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@pinia/nuxt',
    '@vueuse/nuxt',
    '@vite-pwa/nuxt'
  ],

  devtools: {
    enabled: true
  },

  // Vault PWA 强依赖 IndexedDB，无需服务端渲染，避免 Hydration Mismatch
  ssr: false,

  css: ['~/assets/css/main.css'],

  // 运行时配置 — 环境变量
  runtimeConfig: {
    // 仅服务端可用
    vaultAccessKey: '' // NUXT_VAULT_ACCESS_KEY 环境变量
  },

  compatibilityDate: '2025-01-15',

  // Cloudflare Workers 部署目标
  nitro: {
    preset: 'cloudflare_module',
    cloudflare: {
      // 不自动生成 wrangler.json，使用手动维护的 wrangler.toml
      deployConfig: false
    }
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  },

  // PWA 配置
  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'NekoVault',
      short_name: 'NekoVault',
      description: '安全的个人 TOTP 验证码管理器',
      theme_color: '#a7f3d0',
      background_color: '#0f172a',
      display: 'standalone',
      orientation: 'portrait',
      icons: [
        {
          src: '/icon-192.png',
          sizes: '192x192',
          type: 'image/png'
        },
        {
          src: '/icon-512.png',
          sizes: '512x512',
          type: 'image/png'
        }
      ]
    },
    workbox: {
      navigateFallback: '/',
      globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2}']
    }
  }
})

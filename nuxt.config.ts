import pkg from './package.json'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@pinia/nuxt',
    '@vueuse/nuxt',
    '@vite-pwa/nuxt'
  ],

  // Vault 仅在客户端运行，无需服务端渲染，避免 Hydration Mismatch
  ssr: false,

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  // 运行时配置 — 环境变量
  runtimeConfig: {
    public: {
      version: pkg.version
    }
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

  vite: {
    server: {
      allowedHosts: ['dev3000.yueby.mom']
    },

    // 避免首屏由于运行时发现依赖项触发的 Vite Optimize 504 重载
    optimizeDeps: {
      include: ['otpauth', 'zod']
    },

    // 降低前端打包构建的 ES 语法目标，兼容大多数手机的老版本 Safari/Chrome
    build: {
      target: ['es2015', 'edge88', 'firefox78', 'chrome87', 'safari14']
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
    client: {
      registerPlugin: true
    },

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
          src: '/logo.svg',
          sizes: 'any',
          type: 'image/svg+xml',
          purpose: 'any maskable'
        }
      ]
    },
    workbox: {
      navigateFallback: '/',
      globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2}'],
      cleanupOutdatedCaches: true,
      clientsClaim: true,
      skipWaiting: true
    }
  }
})

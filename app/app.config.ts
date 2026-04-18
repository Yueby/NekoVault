export default defineAppConfig({
  ui: {
    colors: {
      primary: 'emerald',
      neutral: 'slate'
    },
    // 全局让表单组件默认 full-width
    input: { slots: { root: 'w-full' } },
    select: { slots: { base: 'w-full' } },
    textarea: { slots: { root: 'w-full' } }
  }
})

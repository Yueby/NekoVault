<script setup lang="ts">
const props = defineProps<{
  title?: string
  description?: string
  ui?: Record<string, unknown>
}>()

const open = defineModel<boolean>('open', { default: false })
const slots = useSlots()

// 768px is tailwind 'md' breakpoint by default.
const isMobile = useMediaQuery('(max-width: 768px)')
const bodyClass = computed(() => {
  const customBody = typeof props.ui?.body === 'string' ? props.ui.body : ''
  return ['max-h-[85vh] overflow-y-auto px-4 py-5 sm:p-6', customBody]
    .filter(Boolean)
    .join(' ')
})

// Close overlay method exposed to parent if needed
function close() {
  open.value = false
}

defineExpose({
  close
})
</script>

<template>
  <template v-if="isMobile">
    <UDrawer
      v-model:open="open"
      direction="bottom"
      handle
      :title="title"
      :description="description"
      :ui="{
        ...ui,
        handle: 'w-12 h-1.5',
        body: bodyClass
      }"
    >
      <template
        v-if="slots.header"
        #header
      >
        <slot name="header" />
      </template>

      <template
        v-if="slots.body || slots.default"
        #body
      >
        <slot name="body">
          <slot />
        </slot>
      </template>

      <template
        v-if="slots.footer"
        #footer
      >
        <slot name="footer" />
      </template>
    </UDrawer>
  </template>

  <template v-else>
    <UModal
      v-model:open="open"
      :title="title"
      :description="description"
      :ui="{
        ...ui,
        body: bodyClass
      }"
    >
      <template
        v-if="slots.header"
        #header
      >
        <slot name="header" />
      </template>

      <template
        v-if="slots.body || slots.default"
        #body
      >
        <slot name="body">
          <slot />
        </slot>
      </template>

      <template
        v-if="slots.footer"
        #footer
      >
        <slot name="footer" />
      </template>
    </UModal>
  </template>
</template>

<script setup lang="ts">
/**
 * 身份信息视图组件
 *
 * 展示虚拟测试身份，地址来自真实公共/商业地点。
 * 支持 P5 国家切换。证件号为随机测试数据，不接入真实校验源。
 */
import type { CountryCode } from '~/types/identity'
import { COUNTRY_CONFIG } from '~/types/identity'

const {
  identity,
  pending,
  error,
  addressPending,
  addressError,
  selectedCountry,
  switchCountry,
  generateIdentity,
  regeneratePerson,
  regenerateAddress,
  regenerateCivil,
  regenerateWork,
  copyIdentity: copyFullIdentity
} = useRandomIdentity()

const toast = useToast()

const cardUi = {
  header: 'px-4 py-3 sm:px-6 sm:py-4',
  body: 'px-4 py-3 sm:px-6 sm:py-4',
  footer: 'px-4 py-3 sm:px-6 sm:py-3'
}

/** 当前已复制成功的字段 key，用于按钮图标/颜色切换反馈 */
const copiedKey = ref<string | null>(null)
let copiedTimer: ReturnType<typeof setTimeout> | null = null

const countryOptions = Object.entries(COUNTRY_CONFIG).map(([code, cfg]) => ({
  label: `${code} ${cfg.label}`,
  value: code as CountryCode
}))

function onCountryChange(code: CountryCode) {
  switchCountry(code)
}

function setCopiedKey(key: string) {
  if (copiedTimer) clearTimeout(copiedTimer)
  copiedKey.value = key
  copiedTimer = setTimeout(() => {
    copiedKey.value = null
  }, 1350)
}

async function copyField(text: string | undefined, key: string) {
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    setCopiedKey(key)
  } catch {
    toast.add({ title: '复制失败', icon: 'i-lucide-x', color: 'error' })
  }
}

async function copyAll() {
  if (!identity.value) return
  try {
    await copyFullIdentity()
    setCopiedKey('all')
    toast.add({ title: '完整身份已复制', icon: 'i-lucide-check', color: 'success' })
  } catch {
    toast.add({ title: '复制失败', icon: 'i-lucide-x', color: 'error' })
  }
}

/** 复制行公共 class：hover + active 反馈 */
const copyRowClass = 'group flex flex-col justify-center px-3 py-1.5 rounded-lg hover:bg-[var(--ui-bg-muted)]/50 transition-colors cursor-pointer relative overflow-hidden active:scale-[0.98]'

const fullAddress = computed(() => {
  if (!identity.value?.address) return ''
  const addr = identity.value.address
  const parts = [
    addr.placeName,
    addr.street,
    addr.city,
    addr.stateCode || addr.state,
    addr.zipCode,
    addr.country
  ]
  return parts.filter(p => p && p.trim() !== '').join(', ')
})

const sectionActionButtonClass = 'rounded-md transition-colors text-[var(--ui-text-muted)] hover:text-[var(--ui-text)]'

onMounted(() => {
  if (!identity.value) {
    generateIdentity()
  }
})
</script>

<template>
  <div>
    <!-- Header Actions -->
    <div class="flex items-center justify-end mb-3">
      <div class="flex gap-2 items-center">
        <!-- 国家选择 -->
        <USelectMenu
          :model-value="selectedCountry"
          :items="countryOptions"
          value-key="value"
          size="sm"
          class="w-32 shrink-0 sm:w-40"
          @update:model-value="onCountryChange"
        />
        <div class="flex items-center bg-[var(--ui-bg-muted)] rounded-lg p-0.5 shrink-0">
          <UTooltip text="复制全部">
            <UButton
              :icon="copiedKey === 'all' ? 'i-lucide-check' : 'i-lucide-copy'"
              :color="copiedKey === 'all' ? 'success' : 'neutral'"
              size="xs"
              variant="ghost"
              class="rounded-md transition-colors"
              :disabled="!identity || pending"
              @click="copyAll"
            />
          </UTooltip>
          <UTooltip text="重新生成">
            <UButton
              icon="i-lucide-refresh-cw"
              color="primary"
              size="xs"
              variant="ghost"
              class="rounded-md transition-colors"
              :loading="pending"
              :disabled="pending"
              @click="generateIdentity"
            />
          </UTooltip>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div
      v-if="pending"
      class="flex flex-col items-center justify-center py-12 gap-3"
    >
      <UIcon
        name="i-lucide-loader-2"
        class="w-8 h-8 text-primary-500 animate-spin"
      />
      <p class="text-[var(--ui-text-muted)]">
        正在生成虚拟身份...
      </p>
    </div>

    <!-- Error State -->
    <UAlert
      v-else-if="error"
      title="生成失败"
      :description="error"
      color="error"
      variant="soft"
      icon="i-lucide-alert-circle"
      class="mb-4"
    />

    <!-- Identity Content -->
    <div
      v-else-if="identity"
      class="space-y-4"
    >
      <!-- 基础信息 -->
      <UCard :ui="cardUi">
        <template #header>
          <div class="flex items-center justify-between gap-3">
            <h2 class="text-sm font-semibold text-[var(--ui-text-highlighted)]">
              基础身份
            </h2>
            <UTooltip text="重随机基础身份">
              <UButton
                icon="i-lucide-dices"
                color="neutral"
                size="xs"
                variant="ghost"
                :class="sectionActionButtonClass"
                @click="regeneratePerson"
              />
            </UTooltip>
          </div>
        </template>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
          <div
            :class="copyRowClass"
            title="点击复制 全名"
            @click="copyField(identity.person.fullName, 'fullName')"
          >
            <div class="text-xs text-[var(--ui-text-muted)] mb-1">
              全名
            </div>
            <div
              class="text-sm font-semibold text-[var(--ui-text-highlighted)] truncate w-full pr-8"
              :title="identity.person.fullName"
            >
              {{ identity.person.fullName }}
            </div>
            <UButton
              :icon="copiedKey === 'fullName' ? 'i-lucide-check' : 'i-lucide-copy'"
              :color="copiedKey === 'fullName' ? 'success' : 'neutral'"
              size="xs"
              variant="ghost"
              class="absolute right-2 top-1/2 -translate-y-1/2 lg:opacity-0 lg:group-hover:opacity-100 transition-all text-[var(--ui-text-muted)] group-hover:text-[var(--ui-text)]"
              @click.stop="copyField(identity.person.fullName, 'fullName')"
            />
          </div>
          <div
            :class="copyRowClass"
            title="点击复制 性别"
            @click="copyField(identity.person.gender, 'gender')"
          >
            <div class="text-xs text-[var(--ui-text-muted)] mb-1">
              性别
            </div>
            <div
              class="text-sm font-semibold text-[var(--ui-text-highlighted)] truncate w-full pr-8"
              :title="identity.person.gender"
            >
              {{ identity.person.gender }}
            </div>
            <UButton
              :icon="copiedKey === 'gender' ? 'i-lucide-check' : 'i-lucide-copy'"
              :color="copiedKey === 'gender' ? 'success' : 'neutral'"
              size="xs"
              variant="ghost"
              class="absolute right-2 top-1/2 -translate-y-1/2 lg:opacity-0 lg:group-hover:opacity-100 transition-all text-[var(--ui-text-muted)] group-hover:text-[var(--ui-text)]"
              @click.stop="copyField(identity.person.gender, 'gender')"
            />
          </div>
          <div
            :class="copyRowClass"
            title="点击复制 年龄"
            @click="copyField(String(identity.person.age), 'age')"
          >
            <div class="text-xs text-[var(--ui-text-muted)] mb-1">
              年龄
            </div>
            <div
              class="text-sm font-semibold text-[var(--ui-text-highlighted)] truncate w-full pr-8"
              :title="String(identity.person.age)"
            >
              {{ identity.person.age }}
            </div>
            <UButton
              :icon="copiedKey === 'age' ? 'i-lucide-check' : 'i-lucide-copy'"
              :color="copiedKey === 'age' ? 'success' : 'neutral'"
              size="xs"
              variant="ghost"
              class="absolute right-2 top-1/2 -translate-y-1/2 lg:opacity-0 lg:group-hover:opacity-100 transition-all text-[var(--ui-text-muted)] group-hover:text-[var(--ui-text)]"
              @click.stop="copyField(String(identity.person.age), 'age')"
            />
          </div>
          <div
            :class="copyRowClass"
            title="点击复制 出生日期"
            @click="copyField(identity.person.birthDate, 'birthDate')"
          >
            <div class="text-xs text-[var(--ui-text-muted)] mb-1">
              出生日期
            </div>
            <div
              class="text-sm font-semibold text-[var(--ui-text-highlighted)] truncate w-full pr-8"
              :title="identity.person.birthDate"
            >
              {{ identity.person.birthDate }}
            </div>
            <UButton
              :icon="copiedKey === 'birthDate' ? 'i-lucide-check' : 'i-lucide-copy'"
              :color="copiedKey === 'birthDate' ? 'success' : 'neutral'"
              size="xs"
              variant="ghost"
              class="absolute right-2 top-1/2 -translate-y-1/2 lg:opacity-0 lg:group-hover:opacity-100 transition-all text-[var(--ui-text-muted)] group-hover:text-[var(--ui-text)]"
              @click.stop="copyField(identity.person.birthDate, 'birthDate')"
            />
          </div>
          <div
            :class="copyRowClass"
            title="点击复制 电话"
            @click="copyField(identity.contact.phone, 'phone')"
          >
            <div class="text-xs text-[var(--ui-text-muted)] mb-1">
              电话号码
            </div>
            <div
              class="text-sm font-semibold text-[var(--ui-text-highlighted)] truncate w-full pr-8"
              :title="identity.contact.phone"
            >
              {{ identity.contact.phone }}
            </div>
            <UButton
              :icon="copiedKey === 'phone' ? 'i-lucide-check' : 'i-lucide-copy'"
              :color="copiedKey === 'phone' ? 'success' : 'neutral'"
              size="xs"
              variant="ghost"
              class="absolute right-2 top-1/2 -translate-y-1/2 lg:opacity-0 lg:group-hover:opacity-100 transition-all text-[var(--ui-text-muted)] group-hover:text-[var(--ui-text)]"
              @click.stop="copyField(identity.contact.phone, 'phone')"
            />
          </div>
          <div
            :class="copyRowClass"
            title="点击复制 邮箱"
            @click="copyField(identity.contact.email, 'email')"
          >
            <div class="text-xs text-[var(--ui-text-muted)] mb-1">
              邮箱
            </div>
            <div
              class="text-sm font-semibold text-[var(--ui-text-highlighted)] truncate w-full pr-8"
              :title="identity.contact.email"
            >
              {{ identity.contact.email }}
            </div>
            <UButton
              :icon="copiedKey === 'email' ? 'i-lucide-check' : 'i-lucide-copy'"
              :color="copiedKey === 'email' ? 'success' : 'neutral'"
              size="xs"
              variant="ghost"
              class="absolute right-2 top-1/2 -translate-y-1/2 lg:opacity-0 lg:group-hover:opacity-100 transition-all text-[var(--ui-text-muted)] group-hover:text-[var(--ui-text)]"
              @click.stop="copyField(identity.contact.email, 'email')"
            />
          </div>
          <div
            :class="copyRowClass"
            title="点击复制 用户名"
            @click="copyField(identity.contact.username, 'username')"
          >
            <div class="text-xs text-[var(--ui-text-muted)] mb-1">
              用户名
            </div>
            <div
              class="text-sm font-semibold text-[var(--ui-text-highlighted)] truncate w-full pr-8"
              :title="identity.contact.username"
            >
              {{ identity.contact.username }}
            </div>
            <UButton
              :icon="copiedKey === 'username' ? 'i-lucide-check' : 'i-lucide-copy'"
              :color="copiedKey === 'username' ? 'success' : 'neutral'"
              size="xs"
              variant="ghost"
              class="absolute right-2 top-1/2 -translate-y-1/2 lg:opacity-0 lg:group-hover:opacity-100 transition-all text-[var(--ui-text-muted)] group-hover:text-[var(--ui-text)]"
              @click.stop="copyField(identity.contact.username, 'username')"
            />
          </div>
        </div>
      </UCard>

      <!-- 真实公共地址 -->
      <UCard :ui="cardUi">
        <template #header>
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-2 min-w-0">
              <h2 class="text-sm font-semibold text-[var(--ui-text-highlighted)]">
                真实公共地址
              </h2>
              <UIcon
                v-if="addressPending"
                name="i-lucide-loader-2"
                class="w-4 h-4 text-primary-500 animate-spin"
              />
            </div>
            <UTooltip text="重随机地址">
              <UButton
                icon="i-lucide-dices"
                color="neutral"
                size="xs"
                variant="ghost"
                :loading="addressPending"
                :disabled="addressPending"
                :class="sectionActionButtonClass"
                @click="regenerateAddress"
              />
            </UTooltip>
          </div>
        </template>

        <!-- 地址加载中 — 骨架屏，撑起与真实地址相近高度 -->
        <div
          v-if="addressPending"
          class="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3"
        >
          <div class="sm:col-span-2 px-3 py-1.5 space-y-1.5">
            <USkeleton class="h-3 w-16" />
            <USkeleton class="h-4 w-3/5" />
          </div>
          <div class="px-3 py-1.5 space-y-1.5">
            <USkeleton class="h-3 w-16" />
            <USkeleton class="h-4 w-4/5" />
          </div>
          <div class="px-3 py-1.5 space-y-1.5">
            <USkeleton class="h-3 w-12" />
            <USkeleton class="h-4 w-2/5" />
          </div>
          <div class="px-3 py-1.5 space-y-1.5">
            <USkeleton class="h-3 w-14" />
            <USkeleton class="h-4 w-1/3" />
          </div>
          <div class="px-3 py-1.5 space-y-1.5">
            <USkeleton class="h-3 w-10" />
            <USkeleton class="h-4 w-1/4" />
          </div>
        </div>

        <!-- 地址加载失败 -->
        <div
          v-else-if="addressError"
          class="flex items-center justify-center py-4 text-sm text-[var(--ui-text-muted)]"
        >
          <UIcon
            name="i-lucide-alert-circle"
            class="w-4 h-4 mr-2"
          />
          {{ addressError }}
        </div>

        <!-- 地址内容 -->
        <div
          v-if="identity.address"
          class="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3"
        >
          <!-- 完整地址 -->
          <div
            :class="['sm:col-span-2', copyRowClass]"
            title="点击复制 完整地址"
            @click="copyField(fullAddress, 'fullAddress')"
          >
            <div class="text-xs text-[var(--ui-text-muted)] mb-1">
              完整地址
            </div>
            <div
              class="line-clamp-2 w-full pr-8 text-sm font-semibold leading-snug text-[var(--ui-text-highlighted)]"
              :title="fullAddress"
            >
              {{ fullAddress }}
            </div>
            <UButton
              :icon="copiedKey === 'fullAddress' ? 'i-lucide-check' : 'i-lucide-copy'"
              :color="copiedKey === 'fullAddress' ? 'success' : 'neutral'"
              size="xs"
              variant="ghost"
              class="absolute right-2 top-1/2 -translate-y-1/2 lg:opacity-0 lg:group-hover:opacity-100 transition-all text-[var(--ui-text-muted)] group-hover:text-[var(--ui-text)]"
              @click.stop="copyField(fullAddress, 'fullAddress')"
            />
          </div>

          <div
            :class="['sm:col-span-2', copyRowClass]"
            title="点击复制 地点名称"
            @click="copyField(identity.address.placeName, 'placeName')"
          >
            <div class="text-xs text-[var(--ui-text-muted)] mb-1">
              地点名称 <UBadge
                size="xs"
                color="neutral"
                class="ml-1"
              >
                {{ identity.address.category }}
              </UBadge>
            </div>
            <div
              class="text-sm font-semibold text-[var(--ui-text-highlighted)] truncate w-full pr-8"
              :title="identity.address.placeName"
            >
              {{ identity.address.placeName }}
            </div>
            <UButton
              :icon="copiedKey === 'placeName' ? 'i-lucide-check' : 'i-lucide-copy'"
              :color="copiedKey === 'placeName' ? 'success' : 'neutral'"
              size="xs"
              variant="ghost"
              class="absolute right-2 top-1/2 -translate-y-1/2 lg:opacity-0 lg:group-hover:opacity-100 transition-all text-[var(--ui-text-muted)] group-hover:text-[var(--ui-text)]"
              @click.stop="copyField(identity.address.placeName, 'placeName')"
            />
          </div>
          <div
            :class="copyRowClass"
            title="点击复制 街道地址"
            @click="copyField(identity.address.street, 'street')"
          >
            <div class="text-xs text-[var(--ui-text-muted)] mb-1">
              街道地址
            </div>
            <div
              class="text-sm font-semibold text-[var(--ui-text-highlighted)] truncate w-full pr-8"
              :title="identity.address.street"
            >
              {{ identity.address.street }}
            </div>
            <UButton
              :icon="copiedKey === 'street' ? 'i-lucide-check' : 'i-lucide-copy'"
              :color="copiedKey === 'street' ? 'success' : 'neutral'"
              size="xs"
              variant="ghost"
              class="absolute right-2 top-1/2 -translate-y-1/2 lg:opacity-0 lg:group-hover:opacity-100 transition-all text-[var(--ui-text-muted)] group-hover:text-[var(--ui-text)]"
              @click.stop="copyField(identity.address.street, 'street')"
            />
          </div>
          <div
            :class="copyRowClass"
            title="点击复制 城市"
            @click="copyField(identity.address.city, 'city')"
          >
            <div class="text-xs text-[var(--ui-text-muted)] mb-1">
              城市
            </div>
            <div
              class="text-sm font-semibold text-[var(--ui-text-highlighted)] truncate w-full pr-8"
              :title="identity.address.city"
            >
              {{ identity.address.city }}
            </div>
            <UButton
              :icon="copiedKey === 'city' ? 'i-lucide-check' : 'i-lucide-copy'"
              :color="copiedKey === 'city' ? 'success' : 'neutral'"
              size="xs"
              variant="ghost"
              class="absolute right-2 top-1/2 -translate-y-1/2 lg:opacity-0 lg:group-hover:opacity-100 transition-all text-[var(--ui-text-muted)] group-hover:text-[var(--ui-text)]"
              @click.stop="copyField(identity.address.city, 'city')"
            />
          </div>
          <div
            :class="copyRowClass"
            title="点击复制 地区"
            @click="copyField(identity.address.state, 'state')"
          >
            <div class="text-xs text-[var(--ui-text-muted)] mb-1">
              地区/省州
            </div>
            <div
              class="text-sm font-semibold text-[var(--ui-text-highlighted)] truncate w-full pr-8"
              :title="`${identity.address.state} (${identity.address.stateCode})`"
            >
              {{ identity.address.state }} ({{ identity.address.stateCode }})
            </div>
            <UButton
              :icon="copiedKey === 'state' ? 'i-lucide-check' : 'i-lucide-copy'"
              :color="copiedKey === 'state' ? 'success' : 'neutral'"
              size="xs"
              variant="ghost"
              class="absolute right-2 top-1/2 -translate-y-1/2 lg:opacity-0 lg:group-hover:opacity-100 transition-all text-[var(--ui-text-muted)] group-hover:text-[var(--ui-text)]"
              @click.stop="copyField(`${identity.address.state} (${identity.address.stateCode})`, 'state')"
            />
          </div>
          <div
            :class="copyRowClass"
            title="点击复制 邮编"
            @click="copyField(identity.address.zipCode, 'zipCode')"
          >
            <div class="text-xs text-[var(--ui-text-muted)] mb-1">
              邮编
            </div>
            <div
              class="text-sm font-semibold text-[var(--ui-text-highlighted)] truncate w-full pr-8"
              :title="identity.address.zipCode"
            >
              {{ identity.address.zipCode }}
            </div>
            <UButton
              :icon="copiedKey === 'zipCode' ? 'i-lucide-check' : 'i-lucide-copy'"
              :color="copiedKey === 'zipCode' ? 'success' : 'neutral'"
              size="xs"
              variant="ghost"
              class="absolute right-2 top-1/2 -translate-y-1/2 lg:opacity-0 lg:group-hover:opacity-100 transition-all text-[var(--ui-text-muted)] group-hover:text-[var(--ui-text)]"
              @click.stop="copyField(identity.address.zipCode, 'zipCode')"
            />
          </div>
        </div>
        <template
          v-if="identity.address"
          #footer
        >
          <div class="flex items-center gap-1 text-[11px] leading-tight text-[var(--ui-text-muted)]">
            <UIcon
              name="i-lucide-info"
              class="w-3.5 h-3.5"
            />
            <span>坐标: {{ identity.address.lat.toFixed(4) }}, {{ identity.address.lon.toFixed(4) }} · 来源: {{ identity.address.source === 'overpass' ? 'Overpass' : '备用地址' }}</span>
          </div>
        </template>
      </UCard>

      <!-- 公民/税务信息 -->
      <UCard :ui="cardUi">
        <template #header>
          <div class="flex items-center justify-between gap-3">
            <h2 class="text-sm font-semibold text-[var(--ui-text-highlighted)]">
              公民与税务
            </h2>
            <UTooltip text="重随机证件信息">
              <UButton
                icon="i-lucide-dices"
                color="neutral"
                size="xs"
                variant="ghost"
                :class="sectionActionButtonClass"
                @click="regenerateCivil"
              />
            </UTooltip>
          </div>
        </template>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
          <div
            :class="copyRowClass"
            title="点击复制 国籍"
            @click="copyField(identity.civil.nationality, 'nationality')"
          >
            <div class="text-xs text-[var(--ui-text-muted)] mb-1">
              国籍
            </div>
            <div
              class="text-sm font-semibold text-[var(--ui-text-highlighted)] truncate w-full pr-8"
              :title="identity.civil.nationality"
            >
              {{ identity.civil.nationality }}
            </div>
            <UButton
              :icon="copiedKey === 'nationality' ? 'i-lucide-check' : 'i-lucide-copy'"
              :color="copiedKey === 'nationality' ? 'success' : 'neutral'"
              size="xs"
              variant="ghost"
              class="absolute right-2 top-1/2 -translate-y-1/2 lg:opacity-0 lg:group-hover:opacity-100 transition-all text-[var(--ui-text-muted)] group-hover:text-[var(--ui-text)]"
              @click.stop="copyField(identity.civil.nationality, 'nationality')"
            />
          </div>
          <div
            :class="copyRowClass"
            title="点击复制 税务居民"
            @click="copyField(identity.civil.taxResidency, 'taxResidency')"
          >
            <div class="text-xs text-[var(--ui-text-muted)] mb-1">
              税务居民
            </div>
            <div
              class="text-sm font-semibold text-[var(--ui-text-highlighted)] truncate w-full pr-8"
              :title="identity.civil.taxResidency"
            >
              {{ identity.civil.taxResidency }}
            </div>
            <UButton
              :icon="copiedKey === 'taxResidency' ? 'i-lucide-check' : 'i-lucide-copy'"
              :color="copiedKey === 'taxResidency' ? 'success' : 'neutral'"
              size="xs"
              variant="ghost"
              class="absolute right-2 top-1/2 -translate-y-1/2 lg:opacity-0 lg:group-hover:opacity-100 transition-all text-[var(--ui-text-muted)] group-hover:text-[var(--ui-text)]"
              @click.stop="copyField(identity.civil.taxResidency, 'taxResidency')"
            />
          </div>
          <div
            :class="copyRowClass"
            :title="`点击复制 ${identity.civil.idLabel1}`"
            @click="copyField(identity.civil.idValue1, 'idValue1')"
          >
            <div class="text-xs text-[var(--ui-text-muted)] mb-1">
              {{ identity.civil.idLabel1 }}
            </div>
            <div
              class="text-sm font-semibold text-[var(--ui-text-highlighted)] truncate w-full pr-8"
              :title="identity.civil.idValue1"
            >
              {{ identity.civil.idValue1 }}
            </div>
            <UButton
              :icon="copiedKey === 'idValue1' ? 'i-lucide-check' : 'i-lucide-copy'"
              :color="copiedKey === 'idValue1' ? 'success' : 'neutral'"
              size="xs"
              variant="ghost"
              class="absolute right-2 top-1/2 -translate-y-1/2 lg:opacity-0 lg:group-hover:opacity-100 transition-all text-[var(--ui-text-muted)] group-hover:text-[var(--ui-text)]"
              @click.stop="copyField(identity.civil.idValue1, 'idValue1')"
            />
          </div>
          <div
            :class="copyRowClass"
            :title="`点击复制 ${identity.civil.idLabel2}`"
            @click="copyField(identity.civil.idValue2, 'idValue2')"
          >
            <div class="text-xs text-[var(--ui-text-muted)] mb-1">
              {{ identity.civil.idLabel2 }}
            </div>
            <div
              class="text-sm font-semibold text-[var(--ui-text-highlighted)] truncate w-full pr-8"
              :title="identity.civil.idValue2"
            >
              {{ identity.civil.idValue2 }}
            </div>
            <UButton
              :icon="copiedKey === 'idValue2' ? 'i-lucide-check' : 'i-lucide-copy'"
              :color="copiedKey === 'idValue2' ? 'success' : 'neutral'"
              size="xs"
              variant="ghost"
              class="absolute right-2 top-1/2 -translate-y-1/2 lg:opacity-0 lg:group-hover:opacity-100 transition-all text-[var(--ui-text-muted)] group-hover:text-[var(--ui-text)]"
              @click.stop="copyField(identity.civil.idValue2, 'idValue2')"
            />
          </div>
        </div>
      </UCard>

      <!-- 工作信息 -->
      <UCard :ui="cardUi">
        <template #header>
          <div class="flex items-center justify-between gap-3">
            <h2 class="text-sm font-semibold text-[var(--ui-text-highlighted)]">
              工作信息
            </h2>
            <UTooltip text="重随机工作信息">
              <UButton
                icon="i-lucide-dices"
                color="neutral"
                size="xs"
                variant="ghost"
                :class="sectionActionButtonClass"
                @click="regenerateWork"
              />
            </UTooltip>
          </div>
        </template>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
          <div
            :class="copyRowClass"
            title="点击复制 职位"
            @click="copyField(identity.work.jobTitle, 'jobTitle')"
          >
            <div class="text-xs text-[var(--ui-text-muted)] mb-1">
              职位
            </div>
            <div
              class="text-sm font-semibold text-[var(--ui-text-highlighted)] truncate w-full pr-8"
              :title="identity.work.jobTitle"
            >
              {{ identity.work.jobTitle }}
            </div>
            <UButton
              :icon="copiedKey === 'jobTitle' ? 'i-lucide-check' : 'i-lucide-copy'"
              :color="copiedKey === 'jobTitle' ? 'success' : 'neutral'"
              size="xs"
              variant="ghost"
              class="absolute right-2 top-1/2 -translate-y-1/2 lg:opacity-0 lg:group-hover:opacity-100 transition-all text-[var(--ui-text-muted)] group-hover:text-[var(--ui-text)]"
              @click.stop="copyField(identity.work.jobTitle, 'jobTitle')"
            />
          </div>
          <div
            :class="copyRowClass"
            title="点击复制 公司"
            @click="copyField(identity.work.company, 'company')"
          >
            <div class="text-xs text-[var(--ui-text-muted)] mb-1">
              公司
            </div>
            <div
              class="text-sm font-semibold text-[var(--ui-text-highlighted)] truncate w-full pr-8"
              :title="identity.work.company"
            >
              {{ identity.work.company }}
            </div>
            <UButton
              :icon="copiedKey === 'company' ? 'i-lucide-check' : 'i-lucide-copy'"
              :color="copiedKey === 'company' ? 'success' : 'neutral'"
              size="xs"
              variant="ghost"
              class="absolute right-2 top-1/2 -translate-y-1/2 lg:opacity-0 lg:group-hover:opacity-100 transition-all text-[var(--ui-text-muted)] group-hover:text-[var(--ui-text)]"
              @click.stop="copyField(identity.work.company, 'company')"
            />
          </div>
        </div>
        <template #footer>
          <div class="text-[11px] leading-tight text-[var(--ui-text-muted)] flex items-center justify-end gap-1">
            <UIcon
              name="i-lucide-clock"
              class="w-3.5 h-3.5"
            />
            <span>生成时间: {{ new Date(identity.meta.generatedAt).toLocaleString() }}</span>
          </div>
        </template>
      </UCard>
    </div>
  </div>
</template>

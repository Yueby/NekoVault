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
  copyIdentity: copyFullIdentity
} = useRandomIdentity()

const toast = useToast()

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
const copyRowClass = 'group flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-[var(--ui-bg-muted)] active:bg-[var(--ui-bg-accented)]/50 transition-colors cursor-pointer'

onMounted(() => {
  if (!identity.value) {
    generateIdentity()
  }
})
</script>

<template>
  <UContainer class="py-3 lg:py-5 max-w-3xl">
    <!-- Header Actions -->
    <div class="flex items-center justify-between mb-4">
      <div>
        <h2 class="text-xl font-bold text-[var(--ui-text-highlighted)]">
          虚拟身份
        </h2>
        <p class="text-sm text-[var(--ui-text-muted)] mt-1">
          个人信息为虚拟测试数据，地址来自真实公共/商业地点
        </p>
      </div>

      <div class="flex gap-1.5 items-center">
        <!-- 国家选择 -->
        <USelectMenu
          :model-value="selectedCountry"
          :items="countryOptions"
          value-key="value"
          size="sm"
          class="w-28"
          @update:model-value="onCountryChange"
        />
        <UTooltip text="复制全部">
          <UButton
            :icon="copiedKey === 'all' ? 'i-lucide-check' : 'i-lucide-copy'"
            :color="copiedKey === 'all' ? 'success' : 'neutral'"
            variant="ghost"
            :disabled="!identity || pending"
            @click="copyAll"
          />
        </UTooltip>
        <UTooltip text="重新生成">
          <UButton
            icon="i-lucide-refresh-cw"
            color="primary"
            variant="soft"
            :loading="pending"
            :disabled="pending"
            @click="generateIdentity"
          />
        </UTooltip>
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
      class="space-y-3"
    >
      <!-- 基础信息 -->
      <UCard class="ring-1 ring-[var(--ui-border)] shadow-sm overflow-hidden [&>div:first-child]:py-2.5 [&>div:last-child]:py-2.5 [&>div:nth-child(2)]:py-2.5">
        <template #header>
          <div class="flex items-center gap-2 py-0.5">
            <UIcon
              name="i-lucide-user"
              class="w-5 h-5 text-primary-500"
            />
            <h3 class="font-semibold text-[var(--ui-text-highlighted)]">
              基础身份
            </h3>
          </div>
        </template>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div
            :class="copyRowClass"
            title="点击复制 全名"
            @click="copyField(identity.person.fullName, 'fullName')"
          >
            <div class="min-w-0">
              <div class="text-[11px] leading-tight text-[var(--ui-text-muted)] mb-0.5">
                全名
              </div>
              <div
                class="text-sm font-medium text-[var(--ui-text-highlighted)] truncate"
                :title="identity.person.fullName"
              >
                {{ identity.person.fullName }}
              </div>
            </div>
            <UButton
              :icon="copiedKey === 'fullName' ? 'i-lucide-check' : 'i-lucide-copy'"
              :color="copiedKey === 'fullName' ? 'success' : 'neutral'"
              size="xs"
              variant="ghost"
              class="shrink-0 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity"
              @click.stop="copyField(identity.person.fullName, 'fullName')"
            />
          </div>
          <div
            :class="copyRowClass"
            title="点击复制 性别"
            @click="copyField(identity.person.gender, 'gender')"
          >
            <div class="min-w-0">
              <div class="text-[11px] leading-tight text-[var(--ui-text-muted)] mb-0.5">
                性别
              </div>
              <div
                class="text-sm font-medium text-[var(--ui-text-highlighted)] truncate"
                :title="identity.person.gender"
              >
                {{ identity.person.gender }}
              </div>
            </div>
            <UButton
              :icon="copiedKey === 'gender' ? 'i-lucide-check' : 'i-lucide-copy'"
              :color="copiedKey === 'gender' ? 'success' : 'neutral'"
              size="xs"
              variant="ghost"
              class="shrink-0 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity"
              @click.stop="copyField(identity.person.gender, 'gender')"
            />
          </div>
          <div
            :class="copyRowClass"
            title="点击复制 年龄"
            @click="copyField(String(identity.person.age), 'age')"
          >
            <div class="min-w-0">
              <div class="text-[11px] leading-tight text-[var(--ui-text-muted)] mb-0.5">
                年龄
              </div>
              <div
                class="text-sm font-medium text-[var(--ui-text-highlighted)] truncate"
                :title="String(identity.person.age)"
              >
                {{ identity.person.age }}
              </div>
            </div>
            <UButton
              :icon="copiedKey === 'age' ? 'i-lucide-check' : 'i-lucide-copy'"
              :color="copiedKey === 'age' ? 'success' : 'neutral'"
              size="xs"
              variant="ghost"
              class="shrink-0 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity"
              @click.stop="copyField(String(identity.person.age), 'age')"
            />
          </div>
          <div
            :class="copyRowClass"
            title="点击复制 出生日期"
            @click="copyField(identity.person.birthDate, 'birthDate')"
          >
            <div class="min-w-0">
              <div class="text-[11px] leading-tight text-[var(--ui-text-muted)] mb-0.5">
                出生日期
              </div>
              <div
                class="text-sm font-medium text-[var(--ui-text-highlighted)] truncate"
                :title="identity.person.birthDate"
              >
                {{ identity.person.birthDate }}
              </div>
            </div>
            <UButton
              :icon="copiedKey === 'birthDate' ? 'i-lucide-check' : 'i-lucide-copy'"
              :color="copiedKey === 'birthDate' ? 'success' : 'neutral'"
              size="xs"
              variant="ghost"
              class="shrink-0 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity"
              @click.stop="copyField(identity.person.birthDate, 'birthDate')"
            />
          </div>
        </div>
      </UCard>

      <!-- 真实公共地址 -->
      <UCard class="ring-1 ring-[var(--ui-border)] shadow-sm overflow-hidden [&>div:first-child]:py-2.5 [&>div:last-child]:py-2.5 [&>div:nth-child(2)]:py-2.5">
        <template #header>
          <div class="flex items-center gap-2 py-0.5">
            <UIcon
              name="i-lucide-map-pin"
              class="w-5 h-5 text-primary-500"
            />
            <h3 class="font-semibold text-[var(--ui-text-highlighted)]">
              真实公共地址
            </h3>
            <UIcon
              v-if="addressPending"
              name="i-lucide-loader-2"
              class="w-4 h-4 text-primary-500 animate-spin"
            />
          </div>
        </template>

        <!-- 地址加载中 — 骨架屏，撑起与真实地址相近高度 -->
        <div
          v-if="addressPending"
          class="grid grid-cols-1 sm:grid-cols-2 gap-2"
        >
          <div class="sm:col-span-2 px-2.5 py-1.5 space-y-1.5">
            <USkeleton class="h-3 w-16" />
            <USkeleton class="h-4 w-3/5" />
          </div>
          <div class="px-2.5 py-1.5 space-y-1.5">
            <USkeleton class="h-3 w-16" />
            <USkeleton class="h-4 w-4/5" />
          </div>
          <div class="px-2.5 py-1.5 space-y-1.5">
            <USkeleton class="h-3 w-12" />
            <USkeleton class="h-4 w-2/5" />
          </div>
          <div class="px-2.5 py-1.5 space-y-1.5">
            <USkeleton class="h-3 w-14" />
            <USkeleton class="h-4 w-1/3" />
          </div>
          <div class="px-2.5 py-1.5 space-y-1.5">
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
          class="grid grid-cols-1 sm:grid-cols-2 gap-2"
        >
          <div
            :class="['sm:col-span-2', copyRowClass]"
            title="点击复制 地点名称"
            @click="copyField(identity.address.placeName, 'placeName')"
          >
            <div class="min-w-0">
              <div class="text-[11px] leading-tight text-[var(--ui-text-muted)] mb-0.5">
                地点名称 <UBadge
                  size="xs"
                  color="neutral"
                  class="ml-1"
                >
                  {{ identity.address.category }}
                </UBadge>
              </div>
              <div
                class="text-sm font-medium text-[var(--ui-text-highlighted)] truncate"
                :title="identity.address.placeName"
              >
                {{ identity.address.placeName }}
              </div>
            </div>
            <UButton
              :icon="copiedKey === 'placeName' ? 'i-lucide-check' : 'i-lucide-copy'"
              :color="copiedKey === 'placeName' ? 'success' : 'neutral'"
              size="xs"
              variant="ghost"
              class="shrink-0 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity"
              @click.stop="copyField(identity.address.placeName, 'placeName')"
            />
          </div>
          <div
            :class="copyRowClass"
            title="点击复制 街道地址"
            @click="copyField(identity.address.street, 'street')"
          >
            <div class="min-w-0">
              <div class="text-[11px] leading-tight text-[var(--ui-text-muted)] mb-0.5">
                街道地址
              </div>
              <div
                class="text-sm font-medium text-[var(--ui-text-highlighted)] truncate"
                :title="identity.address.street"
              >
                {{ identity.address.street }}
              </div>
            </div>
            <UButton
              :icon="copiedKey === 'street' ? 'i-lucide-check' : 'i-lucide-copy'"
              :color="copiedKey === 'street' ? 'success' : 'neutral'"
              size="xs"
              variant="ghost"
              class="shrink-0 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity"
              @click.stop="copyField(identity.address.street, 'street')"
            />
          </div>
          <div
            :class="copyRowClass"
            title="点击复制 城市"
            @click="copyField(identity.address.city, 'city')"
          >
            <div class="min-w-0">
              <div class="text-[11px] leading-tight text-[var(--ui-text-muted)] mb-0.5">
                城市
              </div>
              <div
                class="text-sm font-medium text-[var(--ui-text-highlighted)] truncate"
                :title="identity.address.city"
              >
                {{ identity.address.city }}
              </div>
            </div>
            <UButton
              :icon="copiedKey === 'city' ? 'i-lucide-check' : 'i-lucide-copy'"
              :color="copiedKey === 'city' ? 'success' : 'neutral'"
              size="xs"
              variant="ghost"
              class="shrink-0 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity"
              @click.stop="copyField(identity.address.city, 'city')"
            />
          </div>
          <div
            :class="copyRowClass"
            title="点击复制 地区"
            @click="copyField(identity.address.state, 'state')"
          >
            <div class="min-w-0">
              <div class="text-[11px] leading-tight text-[var(--ui-text-muted)] mb-0.5">
                地区/省州
              </div>
              <div
                class="text-sm font-medium text-[var(--ui-text-highlighted)] truncate"
                :title="`${identity.address.state} (${identity.address.stateCode})`"
              >
                {{ identity.address.state }} ({{ identity.address.stateCode }})
              </div>
            </div>
            <UButton
              :icon="copiedKey === 'state' ? 'i-lucide-check' : 'i-lucide-copy'"
              :color="copiedKey === 'state' ? 'success' : 'neutral'"
              size="xs"
              variant="ghost"
              class="shrink-0 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity"
              @click.stop="copyField(identity.address.state, 'state')"
            />
          </div>
          <div
            :class="copyRowClass"
            title="点击复制 邮编"
            @click="copyField(identity.address.zipCode, 'zipCode')"
          >
            <div class="min-w-0">
              <div class="text-[11px] leading-tight text-[var(--ui-text-muted)] mb-0.5">
                邮编
              </div>
              <div
                class="text-sm font-medium text-[var(--ui-text-highlighted)] truncate"
                :title="identity.address.zipCode"
              >
                {{ identity.address.zipCode }}
              </div>
            </div>
            <UButton
              :icon="copiedKey === 'zipCode' ? 'i-lucide-check' : 'i-lucide-copy'"
              :color="copiedKey === 'zipCode' ? 'success' : 'neutral'"
              size="xs"
              variant="ghost"
              class="shrink-0 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity"
              @click.stop="copyField(identity.address.zipCode, 'zipCode')"
            />
          </div>
        </div>
        <template
          v-if="identity.address"
          #footer
        >
          <div class="text-[11px] leading-tight text-[var(--ui-text-muted)] flex items-center gap-1 py-0.5">
            <UIcon
              name="i-lucide-info"
              class="w-3 h-3"
            />
            坐标: {{ identity.address.lat.toFixed(4) }}, {{ identity.address.lon.toFixed(4) }} ·
            来源: {{ identity.address.source === 'overpass' ? 'Overpass' : '备用地址' }}
          </div>
        </template>
      </UCard>

      <!-- 联系方式 -->
      <UCard class="ring-1 ring-[var(--ui-border)] shadow-sm overflow-hidden [&>div:first-child]:py-2.5 [&>div:last-child]:py-2.5 [&>div:nth-child(2)]:py-2.5">
        <template #header>
          <div class="flex items-center gap-2 py-0.5">
            <UIcon
              name="i-lucide-phone"
              class="w-5 h-5 text-primary-500"
            />
            <h3 class="font-semibold text-[var(--ui-text-highlighted)]">
              联系方式
            </h3>
          </div>
        </template>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div
            :class="copyRowClass"
            title="点击复制 电话"
            @click="copyField(identity.contact.phone, 'phone')"
          >
            <div class="min-w-0">
              <div class="text-[11px] leading-tight text-[var(--ui-text-muted)] mb-0.5">
                电话号码
              </div>
              <div
                class="text-sm font-medium text-[var(--ui-text-highlighted)] truncate"
                :title="identity.contact.phone"
              >
                {{ identity.contact.phone }}
              </div>
            </div>
            <UButton
              :icon="copiedKey === 'phone' ? 'i-lucide-check' : 'i-lucide-copy'"
              :color="copiedKey === 'phone' ? 'success' : 'neutral'"
              size="xs"
              variant="ghost"
              class="shrink-0 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity"
              @click.stop="copyField(identity.contact.phone, 'phone')"
            />
          </div>
          <div
            :class="copyRowClass"
            title="点击复制 邮箱"
            @click="copyField(identity.contact.email, 'email')"
          >
            <div class="min-w-0 flex-1">
              <div class="text-[11px] leading-tight text-[var(--ui-text-muted)] mb-0.5">
                邮箱
              </div>
              <div
                class="text-sm font-medium text-[var(--ui-text-highlighted)] truncate"
                :title="identity.contact.email"
              >
                {{ identity.contact.email }}
              </div>
            </div>
            <UButton
              :icon="copiedKey === 'email' ? 'i-lucide-check' : 'i-lucide-copy'"
              :color="copiedKey === 'email' ? 'success' : 'neutral'"
              size="xs"
              variant="ghost"
              class="shrink-0 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity"
              @click.stop="copyField(identity.contact.email, 'email')"
            />
          </div>
          <div
            :class="copyRowClass"
            title="点击复制 用户名"
            @click="copyField(identity.contact.username, 'username')"
          >
            <div class="min-w-0">
              <div class="text-[11px] leading-tight text-[var(--ui-text-muted)] mb-0.5">
                用户名
              </div>
              <div
                class="text-sm font-medium text-[var(--ui-text-highlighted)] truncate"
                :title="identity.contact.username"
              >
                {{ identity.contact.username }}
              </div>
            </div>
            <UButton
              :icon="copiedKey === 'username' ? 'i-lucide-check' : 'i-lucide-copy'"
              :color="copiedKey === 'username' ? 'success' : 'neutral'"
              size="xs"
              variant="ghost"
              class="shrink-0 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity"
              @click.stop="copyField(identity.contact.username, 'username')"
            />
          </div>
        </div>
      </UCard>

      <!-- 公民/税务信息 -->
      <UCard class="ring-1 ring-[var(--ui-border)] shadow-sm overflow-hidden [&>div:first-child]:py-2.5 [&>div:last-child]:py-2.5 [&>div:nth-child(2)]:py-2.5">
        <template #header>
          <div class="flex items-center gap-2 py-0.5">
            <UIcon
              name="i-lucide-landmark"
              class="w-5 h-5 text-primary-500"
            />
            <h3 class="font-semibold text-[var(--ui-text-highlighted)]">
              公民与税务
            </h3>
          </div>
        </template>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div
            :class="copyRowClass"
            title="点击复制 国籍"
            @click="copyField(identity.civil.nationality, 'nationality')"
          >
            <div class="min-w-0">
              <div class="text-[11px] leading-tight text-[var(--ui-text-muted)] mb-0.5">
                国籍
              </div>
              <div
                class="text-sm font-medium text-[var(--ui-text-highlighted)] truncate"
                :title="identity.civil.nationality"
              >
                {{ identity.civil.nationality }}
              </div>
            </div>
            <UButton
              :icon="copiedKey === 'nationality' ? 'i-lucide-check' : 'i-lucide-copy'"
              :color="copiedKey === 'nationality' ? 'success' : 'neutral'"
              size="xs"
              variant="ghost"
              class="shrink-0 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity"
              @click.stop="copyField(identity.civil.nationality, 'nationality')"
            />
          </div>
          <div
            :class="copyRowClass"
            title="点击复制 税务居民"
            @click="copyField(identity.civil.taxResidency, 'taxResidency')"
          >
            <div class="min-w-0">
              <div class="text-[11px] leading-tight text-[var(--ui-text-muted)] mb-0.5">
                税务居民
              </div>
              <div
                class="text-sm font-medium text-[var(--ui-text-highlighted)] truncate"
                :title="identity.civil.taxResidency"
              >
                {{ identity.civil.taxResidency }}
              </div>
            </div>
            <UButton
              :icon="copiedKey === 'taxResidency' ? 'i-lucide-check' : 'i-lucide-copy'"
              :color="copiedKey === 'taxResidency' ? 'success' : 'neutral'"
              size="xs"
              variant="ghost"
              class="shrink-0 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity"
              @click.stop="copyField(identity.civil.taxResidency, 'taxResidency')"
            />
          </div>
          <div
            :class="copyRowClass"
            :title="`点击复制 ${identity.civil.idLabel1}`"
            @click="copyField(identity.civil.idValue1, 'idValue1')"
          >
            <div class="min-w-0">
              <div class="text-[11px] leading-tight text-[var(--ui-text-muted)] mb-0.5">
                {{ identity.civil.idLabel1 }}
              </div>
              <div
                class="text-sm font-medium text-[var(--ui-text-highlighted)] truncate"
                :title="identity.civil.idValue1"
              >
                {{ identity.civil.idValue1 }}
              </div>
            </div>
            <UButton
              :icon="copiedKey === 'idValue1' ? 'i-lucide-check' : 'i-lucide-copy'"
              :color="copiedKey === 'idValue1' ? 'success' : 'neutral'"
              size="xs"
              variant="ghost"
              class="shrink-0 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity"
              @click.stop="copyField(identity.civil.idValue1, 'idValue1')"
            />
          </div>
          <div
            :class="copyRowClass"
            :title="`点击复制 ${identity.civil.idLabel2}`"
            @click="copyField(identity.civil.idValue2, 'idValue2')"
          >
            <div class="min-w-0">
              <div class="text-[11px] leading-tight text-[var(--ui-text-muted)] mb-0.5">
                {{ identity.civil.idLabel2 }}
              </div>
              <div
                class="text-sm font-medium text-[var(--ui-text-highlighted)] truncate"
                :title="identity.civil.idValue2"
              >
                {{ identity.civil.idValue2 }}
              </div>
            </div>
            <UButton
              :icon="copiedKey === 'idValue2' ? 'i-lucide-check' : 'i-lucide-copy'"
              :color="copiedKey === 'idValue2' ? 'success' : 'neutral'"
              size="xs"
              variant="ghost"
              class="shrink-0 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity"
              @click.stop="copyField(identity.civil.idValue2, 'idValue2')"
            />
          </div>
        </div>
      </UCard>

      <!-- 工作信息 -->
      <UCard class="ring-1 ring-[var(--ui-border)] shadow-sm overflow-hidden mb-6 [&>div:first-child]:py-2.5 [&>div:last-child]:py-2.5 [&>div:nth-child(2)]:py-2.5">
        <template #header>
          <div class="flex items-center gap-2 py-0.5">
            <UIcon
              name="i-lucide-briefcase"
              class="w-5 h-5 text-primary-500"
            />
            <h3 class="font-semibold text-[var(--ui-text-highlighted)]">
              工作信息
            </h3>
          </div>
        </template>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div
            :class="copyRowClass"
            title="点击复制 职位"
            @click="copyField(identity.work.jobTitle, 'jobTitle')"
          >
            <div class="min-w-0">
              <div class="text-[11px] leading-tight text-[var(--ui-text-muted)] mb-0.5">
                职位
              </div>
              <div
                class="text-sm font-medium text-[var(--ui-text-highlighted)] truncate"
                :title="identity.work.jobTitle"
              >
                {{ identity.work.jobTitle }}
              </div>
            </div>
            <UButton
              :icon="copiedKey === 'jobTitle' ? 'i-lucide-check' : 'i-lucide-copy'"
              :color="copiedKey === 'jobTitle' ? 'success' : 'neutral'"
              size="xs"
              variant="ghost"
              class="shrink-0 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity"
              @click.stop="copyField(identity.work.jobTitle, 'jobTitle')"
            />
          </div>
          <div
            :class="copyRowClass"
            title="点击复制 公司"
            @click="copyField(identity.work.company, 'company')"
          >
            <div class="min-w-0">
              <div class="text-[11px] leading-tight text-[var(--ui-text-muted)] mb-0.5">
                公司
              </div>
              <div
                class="text-sm font-medium text-[var(--ui-text-highlighted)] truncate"
                :title="identity.work.company"
              >
                {{ identity.work.company }}
              </div>
            </div>
            <UButton
              :icon="copiedKey === 'company' ? 'i-lucide-check' : 'i-lucide-copy'"
              :color="copiedKey === 'company' ? 'success' : 'neutral'"
              size="xs"
              variant="ghost"
              class="shrink-0 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity"
              @click.stop="copyField(identity.work.company, 'company')"
            />
          </div>
        </div>
        <template #footer>
          <div class="text-[11px] leading-tight text-[var(--ui-text-muted)] text-right py-0.5">
            生成时间: {{ new Date(identity.meta.generatedAt).toLocaleString() }}
          </div>
        </template>
      </UCard>
    </div>
  </UContainer>
</template>

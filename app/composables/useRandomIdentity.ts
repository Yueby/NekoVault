/**
 * 随机测试身份 Composable
 *
 * 使用 @faker-js/faker 生成虚拟个人信息/联系方式/证件，
 * 调用 /api/identity/address?country=XX 获取真实公共/商业地址（异步独立加载）。
 * 支持 P5 国家：CN/US/RU/GB/FR。
 * 证件号为随机生成的测试数据，不接入任何真实校验源。
 */
import type { RandomIdentity, AddressInfo, CountryCode } from '~/types/identity'
import { COUNTRY_CONFIG } from '~/types/identity'
import { Faker, base, en, zh_CN, ru, en_GB, fr, ja, ko, de, en_CA, en_AU, it, es, nl, de_CH } from '@faker-js/faker'
import { useVaultStore } from '~/stores/vault'

/** 各国家 Faker 实例 */
const FAKERS: Record<CountryCode, Faker> = {
  CN: new Faker({ locale: [zh_CN, en, base] }),
  US: new Faker({ locale: [en, base] }),
  RU: new Faker({ locale: [ru, en, base] }),
  GB: new Faker({ locale: [en_GB, en, base] }),
  FR: new Faker({ locale: [fr, en, base] }),
  JP: new Faker({ locale: [ja, en, base] }),
  KR: new Faker({ locale: [ko, en, base] }),
  DE: new Faker({ locale: [de, en, base] }),
  CA: new Faker({ locale: [en_CA, en, base] }),
  AU: new Faker({ locale: [en_AU, en, base] }),
  IT: new Faker({ locale: [it, en, base] }),
  ES: new Faker({ locale: [es, en, base] }),
  NL: new Faker({ locale: [nl, en, base] }),
  SG: new Faker({ locale: [en, base] }),
  CH: new Faker({ locale: [de_CH, de, en, base] })
}

/** 从 birthDate 计算年龄 */
function computeAge(birthDate: Date): number {
  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--
  }
  return age
}

/** 中国居民身份证校验位 */
function getChineseIdCheckDigit(first17: string): string {
  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2]
  const checkDigits = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2']
  const sum = first17
    .split('')
    .reduce((total, digit, index) => total + Number(digit) * (weights[index] ?? 0), 0)
  return checkDigits[sum % 11] ?? '0'
}

/** 按国家生成完整格式随机证件号 1 (test-only) */
function generateIdValue1(country: CountryCode, birthDate: Date): string {
  const f = FAKERS[country]
  const d = f.string.numeric
  switch (country) {
    case 'US': return `${f.number.int({ min: 100, max: 899 })}-${f.number.int({ min: 10, max: 99 })}-${d(4)}`
    case 'GB': return `${f.string.alpha({ casing: 'upper', length: 2 })}${d(6)}${f.string.alpha({ casing: 'upper', length: 1 })}`
    case 'CN': {
      const region = ['110101', '310101', '440106', '440305', '510104'][f.number.int({ min: 0, max: 4 })] ?? '110101'
      const birth = birthDate.toISOString().slice(0, 10).replaceAll('-', '')
      const seq = d(3)
      const first17 = `${region}${birth}${seq}`
      return `${first17}${getChineseIdCheckDigit(first17)}`
    }
    case 'RU': return d(12)
    case 'FR': return `${f.number.int({ min: 1, max: 2 })} ${d(2)} ${d(2)} ${d(2)} ${d(3)} ${d(3)} ${d(2)}`
    case 'JP': return d(12)
    case 'KR': return `${d(6)}-${d(7)}`
    case 'DE': return `${f.number.int({ min: 10, max: 99 })}/${f.number.int({ min: 100, max: 999 })}/${d(4)}`
    case 'CA': return `${d(3)}-${d(3)}-${d(3)}`
    case 'AU': return `${f.number.int({ min: 100, max: 999 })} ${d(3)} ${d(3)}`
    case 'IT': {
      const cons = () => f.string.alpha({ casing: 'upper', length: 1 })
      return `${cons()}${cons()}${cons()}${cons()}${cons()}${cons()}${d(2)}${cons()}${d(2)}${cons()}${d(3)}${cons()}`
    }
    case 'ES': return `${f.number.int({ min: 10, max: 99 })}${d(7)}${f.string.alpha({ casing: 'upper', length: 1 })}`
    case 'NL': return d(9)
    case 'SG': return `${f.string.alpha({ casing: 'upper', length: 1 })}${d(7)}${f.string.alpha({ casing: 'upper', length: 1 })}`
    case 'CH': return d(12)
  }
}

/** 按国家生成完整格式随机证件号 2 (test-only) */
function generateIdValue2(country: CountryCode): string {
  const f = FAKERS[country]
  const d = f.string.numeric
  switch (country) {
    case 'US': return `${f.string.alpha({ casing: 'upper', length: 1 })}${d(8)}`
    case 'GB': return d(9)
    case 'CN': return `E${d(8)}`
    case 'RU': return `${d(2)} ${d(2)} ${d(6)}`
    case 'FR': return `${d(2)}${f.string.alpha({ casing: 'upper', length: 2 })}${d(5)}`
    case 'JP': return `TK${d(7)}`
    case 'KR': return `K${d(8)}`
    case 'DE': return `${f.string.alpha({ casing: 'upper', length: 1 })}${d(8)}`
    case 'CA': return `CA${d(8)}`
    case 'AU': return `AU${d(8)}`
    case 'IT': return `IT${d(8)}`
    case 'ES': return `ES${d(8)}`
    case 'NL': return `NL${d(8)}`
    case 'SG': return `K${d(7)}`
    case 'CH': return `CH${d(8)}`
  }
}

/** 按国家生成本地格式虚拟电话号码 */
function generateTestPhone(country: CountryCode): string {
  const f = FAKERS[country]
  const d = f.string.numeric
  switch (country) {
    case 'US': return `+1 ${f.number.int({ min: 201, max: 989 })}-${f.number.int({ min: 200, max: 999 })}-${d(4)}`
    case 'GB': return `+44 7${d(3)} ${d(6)}`
    case 'CN': return `+86 1${f.number.int({ min: 30, max: 99 })} ${d(4)} ${d(4)}`
    case 'RU': return `+7 9${d(2)} ${d(3)}-${d(2)}-${d(2)}`
    case 'FR': return `+33 ${f.number.int({ min: 6, max: 7 })} ${d(2)} ${d(2)} ${d(2)} ${d(2)}`
    case 'JP': return `+81 ${f.number.int({ min: 3, max: 9 })}-${d(4)}-${d(4)}`
    case 'KR': return `+82 10-${d(4)}-${d(4)}`
    case 'DE': return `+49 ${f.number.int({ min: 30, max: 89 })} ${d(7)}`
    case 'CA': return `+1 ${f.number.int({ min: 204, max: 905 })}-${d(3)}-${d(4)}`
    case 'AU': return `+61 ${f.number.int({ min: 2, max: 5 })} ${d(4)} ${d(4)}`
    case 'IT': return `+39 ${f.number.int({ min: 2, max: 9 })}${d(2)} ${d(3)} ${d(4)}`
    case 'ES': return `+34 ${f.number.int({ min: 6, max: 9 })}${d(2)} ${d(2)} ${d(2)} ${d(2)}`
    case 'NL': return `+31 6-${d(8)}`
    case 'SG': return `+65 ${f.number.int({ min: 8, max: 9 })}${d(3)} ${d(4)}`
    case 'CH': return `+41 ${f.number.int({ min: 21, max: 79 })} ${d(3)} ${d(2)} ${d(2)}`
  }
}

export function useRandomIdentity() {
  const identity = ref<RandomIdentity | null>(null)
  const pending = ref(false)
  const error = ref<string | null>(null)
  const addressPending = ref(false)
  const addressError = ref<string | null>(null)
  const selectedCountry = ref<CountryCode>('US')

  /** 地址请求版本号，用于避免竞态 */
  let addressVersion = 0

  /**
   * 切换国家并重新生成身份
   */
  function switchCountry(country: CountryCode): void {
    if (country === selectedCountry.value) return
    selectedCountry.value = country
    generateIdentity()
  }

  /**
   * 生成一组完整的随机测试身份（不含地址），地址异步独立加载
   */
  async function generateIdentity(): Promise<void> {
    if (pending.value) return
    const country = selectedCountry.value
    pending.value = true
    error.value = null
    addressPending.value = true
    addressError.value = null
    addressVersion++

    try {
      const f = FAKERS[country]
      const config = COUNTRY_CONFIG[country]

      // 1. 生成虚拟个人信息
      const firstName = f.person.firstName()
      const lastName = f.person.lastName()
      const gender = f.person.sex() as 'male' | 'female'
      const birthDate = f.date.birthdate({ min: 18, max: 80, mode: 'age' })
      const age = computeAge(birthDate)

      // 东亚姓名习惯：姓在前
      const fullName = (country === 'CN' || country === 'JP' || country === 'KR')
        ? `${lastName}${firstName}`
        : `${firstName} ${lastName}`

      // 2. 生成虚拟联系方式
      const username = f.internet.username({ firstName, lastName }).toLowerCase() || 'testuser'
      const email = `${username}@example.com`
      const phone = generateTestPhone(country)

      // 3. 立即组装身份（地址暂空）
      const result: RandomIdentity = {
        country,
        person: {
          firstName,
          lastName,
          fullName,
          gender,
          birthDate: birthDate.toISOString().split('T')[0] ?? '',
          age
        },
        address: null,
        contact: {
          email,
          phone,
          username
        },
        civil: {
          nationality: config.nationality,
          taxResidency: config.nationality,
          idValue1: generateIdValue1(country, birthDate),
          idValue2: generateIdValue2(country),
          idLabel1: config.idLabel,
          idLabel2: config.idLabel2,
          _testOnly: true
        },
        work: {
          company: f.company.name(),
          jobTitle: f.person.jobTitle()
        },
        meta: {
          generatedAt: Date.now(),
          version: 1
        }
      }

      identity.value = result
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '生成身份失败'
      error.value = message
      addressPending.value = false
    } finally {
      pending.value = false
    }

    // 4. 地址异步独立加载
    if (identity.value) {
      fetchAddress(country)
    }
  }

  /**
   * 异步获取地址，使用 version 避免竞态
   */
  async function fetchAddress(country: CountryCode): Promise<void> {
    const currentVersion = addressVersion
    try {
      const vaultStore = useVaultStore()
      const result = await $fetch<{ address: AddressInfo }>('/api/identity/address', {
        params: { country },
        headers: { 'x-admin-token': vaultStore.adminToken }
      })
      if (currentVersion !== addressVersion) return
      if (identity.value) {
        identity.value.address = result.address
        if (result.address.state && result.address.stateCode) {
          identity.value.civil.taxResidency = `${result.address.state} (${result.address.stateCode})`
        }
      }
    } catch {
      if (currentVersion !== addressVersion) return
      addressError.value = '获取地址失败'
    } finally {
      if (currentVersion === addressVersion) {
        addressPending.value = false
      }
    }
  }

  /**
   * 复制指定文本到剪贴板
   */
  async function copyText(text: string, _label: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      return false
    }
  }

  /**
   * 复制完整身份信息到剪贴板
   */
  async function copyIdentity(): Promise<boolean> {
    if (!identity.value) return false

    const i = identity.value
    const addr = i.address
    const addressLines = addr
      ? [
          `地址: ${addr.placeName}`,
          `街道: ${addr.street}`,
          `城市: ${addr.city}`,
          `地区: ${addr.state} (${addr.stateCode})`,
          `邮编: ${addr.zipCode}`
        ]
      : ['地址: 未获取']

    const text = [
      `全名: ${i.person.fullName}`,
      `性别: ${i.person.gender}`,
      `年龄: ${i.person.age}`,
      `出生日期: ${i.person.birthDate}`,
      `---`,
      ...addressLines,
      `---`,
      `电话: ${i.contact.phone}`,
      `邮箱: ${i.contact.email}`,
      `用户名: ${i.contact.username}`,
      `---`,
      `国籍: ${i.civil.nationality}`,
      `税务居民: ${i.civil.taxResidency}`,
      `${i.civil.idLabel1}: ${i.civil.idValue1}`,
      `${i.civil.idLabel2}: ${i.civil.idValue2}`,
      `---`,
      `公司: ${i.work.company}`,
      `职位: ${i.work.jobTitle}`
    ].join('\n')

    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      return false
    }
  }

  return {
    identity: readonly(identity),
    pending: readonly(pending),
    error: readonly(error),
    addressPending: readonly(addressPending),
    addressError: readonly(addressError),
    selectedCountry: readonly(selectedCountry),
    switchCountry,
    generateIdentity,
    copyText,
    copyIdentity
  }
}

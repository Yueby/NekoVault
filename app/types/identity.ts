/**
 * 随机测试身份类型定义
 *
 * 个人信息/联系方式/证件字段均为虚拟测试数据；
 * 地址来自真实公共/商业地点。
 * 证件号为随机生成的测试数据，不接入任何真实校验源。
 */

/** 国家代码 */
export type CountryCode = 'US' | 'CN' | 'RU' | 'GB' | 'FR' | 'JP' | 'KR' | 'DE' | 'CA' | 'AU' | 'IT' | 'ES' | 'NL' | 'SG' | 'CH'

/** 国家配置 */
export const COUNTRY_CONFIG: Record<CountryCode, {
  label: string
  locale: string
  nationality: string
  idLabel: string
  idLabel2: string
  idFormat: string
}> = {
  US: { label: '美国', locale: 'en', nationality: '美国', idLabel: '社会安全码(SSN)', idLabel2: '护照号码', idFormat: 'SSN' },
  CN: { label: '中国', locale: 'zh_CN', nationality: '中国', idLabel: '居民身份号码', idLabel2: '护照号码', idFormat: 'CN' },
  RU: { label: '俄罗斯', locale: 'ru', nationality: '俄罗斯', idLabel: '个人纳税号', idLabel2: '护照号码', idFormat: 'RU' },
  GB: { label: '英国', locale: 'en_GB', nationality: '英国', idLabel: '国家保险号(NINO)', idLabel2: '护照号码', idFormat: 'NINO' },
  FR: { label: '法国', locale: 'fr', nationality: '法国', idLabel: '身份证号', idLabel2: '护照号码', idFormat: 'FR' },
  JP: { label: '日本', locale: 'ja', nationality: '日本', idLabel: '個人番号', idLabel2: '护照号码', idFormat: 'JP' },
  KR: { label: '韩国', locale: 'ko', nationality: '韩国', idLabel: '住民登记号码', idLabel2: '护照号码', idFormat: 'KR' },
  DE: { label: '德国', locale: 'de', nationality: '德国', idLabel: '税号(Steuernummer)', idLabel2: '护照号码', idFormat: 'DE' },
  CA: { label: '加拿大', locale: 'en_CA', nationality: '加拿大', idLabel: '社会保险号(SIN)', idLabel2: '护照号码', idFormat: 'CA' },
  AU: { label: '澳大利亚', locale: 'en_AU', nationality: '澳大利亚', idLabel: '税号(TFN)', idLabel2: '护照号码', idFormat: 'AU' },
  IT: { label: '意大利', locale: 'it', nationality: '意大利', idLabel: '税号(Codice Fiscale)', idLabel2: '护照号码', idFormat: 'IT' },
  ES: { label: '西班牙', locale: 'es', nationality: '西班牙', idLabel: '身份证号(DNI)', idLabel2: '护照号码', idFormat: 'ES' },
  NL: { label: '荷兰', locale: 'nl', nationality: '荷兰', idLabel: '市民服务号(BSN)', idLabel2: '护照号码', idFormat: 'NL' },
  SG: { label: '新加坡', locale: 'en', nationality: '新加坡', idLabel: '身份证号(NRIC)', idLabel2: '护照号码', idFormat: 'SG' },
  CH: { label: '瑞士', locale: 'de_CH', nationality: '瑞士', idLabel: '身份证号', idLabel2: '护照号码', idFormat: 'CH' }
}

// ============================================================
// 个人信息
// ============================================================

/** 虚拟个人信息 */
export interface PersonInfo {
  /** 名 */
  firstName: string
  /** 姓 */
  lastName: string
  /** 全名 */
  fullName: string
  /** 性别 */
  gender: 'male' | 'female'
  /** 出生日期 (ISO date string) */
  birthDate: string
  /** 年龄（与 birthDate 一致） */
  age: number
}

// ============================================================
// 地址信息
// ============================================================

/** 真实公共/商业地址（来自 Overpass API 或 fallback 池） */
export interface AddressInfo {
  /** POI 名称 */
  placeName: string
  /** 街道门牌 */
  street: string
  /** 城市 */
  city: string
  /** 省/州/地区全名 */
  state: string
  /** 省/州/地区缩写 */
  stateCode: string
  /** 邮编 */
  zipCode: string
  /** 国家代码 */
  country: CountryCode
  /** 纬度 */
  lat: number
  /** 经度 */
  lon: number
  /** POI 类别 */
  category: string
  /** 数据来源 */
  source: 'overpass' | 'fallback'
}

// ============================================================
// 联系方式
// ============================================================

/** 虚拟联系方式 */
export interface ContactInfo {
  /** 邮箱（使用 example.com 域名） */
  email: string
  /** 电话号码 */
  phone: string
  /** 用户名 */
  username: string
}

// ============================================================
// 公民字段（test-only）
// ============================================================

/** 虚拟公民字段 — 仅用于测试展示，不可用于真实场景 */
export interface CivilInfo {
  /** 国籍（test-only 虚拟） */
  nationality: string
  /** 税务居民（test-only 虚拟） */
  taxResidency: string
  /** 随机证件号 1（SSN/NINO 等，格式因国家而异，test-only） */
  idValue1: string
  /** 随机证件号 2（护照等，格式因国家而异，test-only） */
  idValue2: string
  /** 证件号 1 标签 */
  idLabel1: string
  /** 证件号 2 标签 */
  idLabel2: string
  /** 标注此为测试数据 */
  _testOnly: true
}

// ============================================================
// 工作信息
// ============================================================

/** 虚拟工作信息 */
export interface WorkInfo {
  /** 公司名 */
  company: string
  /** 职位 */
  jobTitle: string
}

// ============================================================
// 元数据
// ============================================================

/** 生成元数据 */
export interface IdentityMeta {
  /** 生成时间戳 */
  generatedAt: number
  /** 数据版本 */
  version: 1
}

// ============================================================
// 聚合类型
// ============================================================

/** 完整的随机测试身份 */
export interface RandomIdentity {
  /** 国家代码 */
  country: CountryCode
  person: PersonInfo
  address: AddressInfo | null
  contact: ContactInfo
  civil: CivilInfo
  work: WorkInfo
  meta: IdentityMeta
}

// ============================================================
// API 响应
// ============================================================

/** GET /api/identity/address 响应体 */
export interface AddressApiResponse {
  address: AddressInfo
}

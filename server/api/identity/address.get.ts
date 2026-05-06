/**
 * GET /api/identity/address?country=US
 *
 * 通过 OpenStreetMap Overpass API 随机获取真实公共/商业 POI 地址。
 * 支持多国：CN/US/RU/GB/FR/JP/KR/DE/CA/AU/IT/ES/NL/SG/CH。
 * 仅接受 amenity/shop/office/tourism/craft/leisure 标签，
 * 要求 addr:housenumber + addr:street，排除住宅 building。
 * 失败时返回内置 fallback 公共地址池中的随机真实公共地址。
 * 需要 ADMIN_TOKEN 鉴权，防止开放代理滥用。
 */

import type { AddressInfo, CountryCode } from '~/types/identity'

/** Overpass API 端点 */
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'

/** Overpass 请求头 — Accept 避免 406，User-Agent 符合 OSM 规范 */
const OVERPASS_HEADERS = {
  'Content-Type': 'application/x-www-form-urlencoded',
  'Accept': 'application/json',
  'User-Agent': 'NekoVault/1.1.3 (+https://github.com/yueby/NekoVault)'
} as const

/** 请求超时（毫秒） */
const FETCH_TIMEOUT = 12_000

/** Bbox 区域定义 */
interface BboxArea {
  name: string
  south: number
  west: number
  north: number
  east: number
}

/** 各国家 bbox 池 */
const BBOX_POOLS: Record<CountryCode, BboxArea[]> = {
  US: [
    { name: 'New York', south: 40.70, west: -74.02, north: 40.78, east: -73.95 },
    { name: 'Los Angeles', south: 33.98, west: -118.35, north: 34.08, east: -118.15 },
    { name: 'Chicago', south: 41.78, west: -87.72, north: 41.92, east: -87.58 },
    { name: 'San Francisco', south: 37.72, west: -122.50, north: 37.82, east: -122.38 },
    { name: 'Seattle', south: 47.55, west: -122.40, north: 47.68, east: -122.28 },
    { name: 'Austin', south: 30.20, west: -97.82, north: 30.35, east: -97.68 },
    { name: 'Boston', south: 42.32, west: -71.08, north: 42.40, east: -71.00 },
    { name: 'Denver', south: 39.68, west: -105.05, north: 39.78, east: -104.90 },
    { name: 'Portland', south: 45.48, west: -122.72, north: 45.56, east: -122.60 },
    { name: 'Miami', south: 25.72, west: -80.25, north: 25.82, east: -80.12 }
  ],
  CN: [
    { name: 'Beijing', south: 39.80, west: 116.25, north: 39.98, east: 116.50 },
    { name: 'Shanghai', south: 31.15, west: 121.40, north: 31.30, east: 121.55 },
    { name: 'Guangzhou', south: 23.05, west: 113.20, north: 23.20, east: 113.40 },
    { name: 'Shenzhen', south: 22.50, west: 113.90, north: 22.60, east: 114.10 },
    { name: 'Chengdu', south: 30.55, west: 104.00, north: 30.72, east: 104.15 }
  ],
  RU: [
    { name: 'Moscow', south: 55.60, west: 37.45, north: 55.80, east: 37.70 },
    { name: 'Saint Petersburg', south: 59.85, west: 30.20, north: 59.98, east: 30.45 },
    { name: 'Novosibirsk', south: 54.95, west: 82.85, north: 55.10, east: 83.10 }
  ],
  GB: [
    { name: 'London', south: 51.45, west: -0.15, north: 51.55, east: 0.00 },
    { name: 'Manchester', south: 53.42, west: -2.30, north: 53.52, east: -2.15 },
    { name: 'Edinburgh', south: 55.90, west: -3.25, north: 55.98, east: -3.15 }
  ],
  FR: [
    { name: 'Paris', south: 48.82, west: 2.25, north: 48.92, east: 2.45 },
    { name: 'Lyon', south: 45.70, west: 4.75, north: 45.82, east: 4.95 },
    { name: 'Marseille', south: 43.25, west: 5.30, north: 43.35, east: 5.45 }
  ],
  JP: [
    { name: 'Tokyo', south: 35.60, west: 139.65, north: 35.80, east: 139.85 },
    { name: 'Osaka', south: 34.60, west: 135.45, north: 34.75, east: 135.55 },
    { name: 'Kyoto', south: 34.95, west: 135.70, north: 35.05, east: 135.80 },
    { name: 'Yokohama', south: 35.40, west: 139.55, north: 35.50, east: 139.70 }
  ],
  KR: [
    { name: 'Seoul', south: 37.50, west: 126.90, north: 37.62, east: 127.05 },
    { name: 'Busan', south: 35.08, west: 128.95, north: 35.18, east: 129.10 },
    { name: 'Incheon', south: 37.38, west: 126.55, north: 37.50, east: 126.72 }
  ],
  DE: [
    { name: 'Berlin', south: 52.40, west: 13.20, north: 52.55, east: 13.50 },
    { name: 'Munich', south: 48.10, west: 11.50, north: 48.20, east: 11.65 },
    { name: 'Hamburg', south: 53.45, west: 9.85, north: 53.60, east: 10.10 },
    { name: 'Frankfurt', south: 50.05, west: 8.60, north: 50.15, east: 8.75 }
  ],
  CA: [
    { name: 'Toronto', south: 43.60, west: -79.45, north: 43.72, east: -79.30 },
    { name: 'Vancouver', south: 49.20, west: -123.15, north: 49.30, east: -123.00 },
    { name: 'Montreal', south: 45.45, west: -73.65, north: 45.55, east: -73.50 },
    { name: 'Ottawa', south: 45.38, west: -75.75, north: 45.45, east: -75.65 }
  ],
  AU: [
    { name: 'Sydney', south: -33.92, west: 151.15, north: -33.82, east: 151.28 },
    { name: 'Melbourne', south: -37.85, west: 144.90, north: -37.78, east: 145.02 },
    { name: 'Brisbane', south: -27.55, west: 153.00, north: -27.42, east: 153.12 }
  ],
  IT: [
    { name: 'Rome', south: 41.80, west: 12.40, north: 41.95, east: 12.58 },
    { name: 'Milan', south: 45.42, west: 9.12, north: 45.52, east: 9.25 },
    { name: 'Florence', south: 43.74, west: 11.20, north: 43.80, east: 11.30 }
  ],
  ES: [
    { name: 'Madrid', south: 40.35, west: -3.80, north: 40.50, east: -3.60 },
    { name: 'Barcelona', south: 41.35, west: 2.10, north: 41.45, east: 2.25 },
    { name: 'Valencia', south: 39.42, west: -0.42, north: 39.52, east: -0.30 }
  ],
  NL: [
    { name: 'Amsterdam', south: 52.32, west: 4.85, north: 52.42, east: 5.00 },
    { name: 'Rotterdam', south: 51.88, west: 4.42, north: 51.96, east: 4.55 },
    { name: 'The Hague', south: 52.04, west: 4.22, north: 52.12, east: 4.38 }
  ],
  SG: [
    { name: 'Singapore Central', south: 1.27, west: 103.82, north: 1.33, east: 103.88 }
  ],
  CH: [
    { name: 'Zurich', south: 47.34, west: 8.48, north: 47.42, east: 8.62 },
    { name: 'Geneva', south: 46.18, west: 6.10, north: 46.24, east: 6.18 },
    { name: 'Bern', south: 46.92, west: 7.38, north: 46.98, east: 7.48 }
  ]
}

/** 允许的公共/商业标签 */
const ALLOWED_TAGS = [
  'amenity',
  'shop',
  'office',
  'tourism',
  'craft',
  'leisure'
] as const

/** 构建 Overpass QL 查询语句 */
function buildOverpassQuery(bbox: BboxArea): string {
  const bboxStr = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`

  return [
    '[out:json][timeout:10];',
    '(',
    ...ALLOWED_TAGS.map(tag => `  node["${tag}"]["addr:housenumber"]["addr:street"](${bboxStr});`),
    ...ALLOWED_TAGS.map(tag => `  way["${tag}"]["addr:housenumber"]["addr:street"](${bboxStr});`),
    ');',
    'out body center 50;'
  ].join('\n')
}

// ============================================================
// Overpass 元素类型
// ============================================================

interface OverpassCenter {
  lat: number
  lon: number
}

interface OverpassElement {
  type: string
  id: number
  lat?: number
  lon?: number
  center?: OverpassCenter
  tags?: Record<string, string>
}

interface OverpassResponse {
  elements: OverpassElement[]
}

/** 各国家省/州名 → 缩写映射 */
const REGION_CODE_MAPS: Record<CountryCode, Record<string, string>> = {
  US: {
    'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
    'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
    'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID',
    'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS',
    'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
    'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
    'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
    'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
    'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK',
    'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
    'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT',
    'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV',
    'Wisconsin': 'WI', 'Wyoming': 'WY', 'District of Columbia': 'DC'
  },
  CN: {
    北京市: '京', 上海市: '沪', 广东省: '粤', 浙江省: '浙',
    江苏省: '苏', 四川省: '川', 湖北省: '鄂', 湖南省: '湘',
    福建省: '闽', 山东省: '鲁', 河南省: '豫', 河北省: '冀',
    陕西省: '陕', 辽宁省: '辽', 吉林省: '吉', 黑龙江省: '黑',
    安徽省: '皖', 江西省: '赣', 云南省: '滇', 贵州省: '黔',
    甘肃省: '甘', 青海省: '青', 台湾省: '台', 海南省: '琼',
    重庆市: '渝', 天津市: '津',
    香港特别行政区: '港', 澳门特别行政区: '澳',
    内蒙古自治区: '蒙', 广西壮族自治区: '桂', 西藏自治区: '藏',
    宁夏回族自治区: '宁', 新疆维吾尔自治区: '新'
  },
  RU: {
    'Москва': 'МСК',
    'Санкт-Петербург': 'СПб',
    'Московская область': 'МО',
    'Ленинградская область': 'ЛО',
    'Новосибирская область': 'НСО',
    'Свердловская область': 'СВР',
    'Краснодарский край': 'ККД',
    'Татарстан': 'ТТН'
  },
  GB: {
    'England': 'ENG', 'Scotland': 'SCT', 'Wales': 'WLS',
    'Northern Ireland': 'NIR',
    'Greater London': 'LND',
    'Greater Manchester': 'GMC',
    'West Midlands': 'WMD', 'Merseyside': 'MSY',
    'West Yorkshire': 'WYK'
  },
  FR: {
    'Île-de-France': 'IDF',
    'Auvergne-Rhône-Alpes': 'ARA',
    'Provence-Alpes-Côte d\'Azur': 'PAC',
    'Occitanie': 'OCC',
    'Nouvelle-Aquitaine': 'NAQ', 'Bretagne': 'BRE',
    'Normandie': 'NOR',
    'Hauts-de-France': 'HDF',
    'Grand Est': 'GES',
    'Pays de la Loire': 'PDL',
    'Bourgogne-Franche-Comté': 'BFC',
    'Centre-Val de Loire': 'CVL',
    'Corse': 'COR'
  },
  JP: {
    東京都: 'TK', 大阪府: 'OS', 京都府: 'KT', 神奈川県: 'KN',
    愛知県: 'AI', 福岡県: 'FK', 北海道: 'HK', 長野県: 'NG',
    Tōkyō: 'TK', Ōsaka: 'OS', Kyōto: 'KT', Kanagawa: 'KN',
    Aichi: 'AI', Fukuoka: 'FK', Hokkaidō: 'HK', Nagano: 'NG'
  },
  KR: {
    서울특별시: 'SE', 부산광역시: 'BS', 인천광역시: 'IC',
    대구광역시: 'DG', 대전광역시: 'DJ', 광주광역시: 'GJ',
    Seoul: 'SE', Busan: 'BS', Incheon: 'IC',
    Daegu: 'DG', Daejeon: 'DJ', Gwangju: 'GJ'
  },
  DE: {
    'Berlin': 'BE', 'Bayern': 'BY', 'Hamburg': 'HH', 'Hessen': 'HE',
    'Nordrhein-Westfalen': 'NW', 'Baden-Württemberg': 'BW',
    'Niedersachsen': 'NI', 'Sachsen': 'SN', 'Rheinland-Pfalz': 'RP',
    'Brandenburg': 'BB', 'Schleswig-Holstein': 'SH', 'Thüringen': 'TH'
  },
  CA: {
    'Ontario': 'ON', 'British Columbia': 'BC', 'Quebec': 'QC',
    'Alberta': 'AB', 'Manitoba': 'MB', 'Saskatchewan': 'SK',
    'Nova Scotia': 'NS', 'New Brunswick': 'NB',
    'Newfoundland and Labrador': 'NL', 'Prince Edward Island': 'PE'
  },
  AU: {
    'New South Wales': 'NSW', 'Victoria': 'VIC', 'Queensland': 'QLD',
    'Western Australia': 'WA', 'South Australia': 'SA',
    'Tasmania': 'TAS', 'Australian Capital Territory': 'ACT',
    'Northern Territory': 'NT'
  },
  IT: {
    'Lazio': 'LAZ', 'Lombardia': 'LOM', 'Toscana': 'TOS',
    'Campania': 'CAM', 'Veneto': 'VEN', 'Emilia-Romagna': 'EMR',
    'Piemonte': 'PMN', 'Liguria': 'LIG', 'Puglia': 'PUG',
    'Sicilia': 'SIC', 'Sardegna': 'SAR'
  },
  ES: {
    'Comunidad de Madrid': 'MD', 'Cataluña': 'CT', 'Comunidad Valenciana': 'VC',
    'Andalucía': 'AN', 'País Vasco': 'PV', 'Galicia': 'GA',
    'Castilla y León': 'CL', 'Canarias': 'CN', 'Aragón': 'AR'
  },
  NL: {
    'Noord-Holland': 'NH', 'Zuid-Holland': 'ZH', 'Utrecht': 'UT',
    'Noord-Brabant': 'NB', 'Gelderland': 'GE', 'Overijssel': 'OV',
    'Limburg': 'LI', 'Friesland': 'FR', 'Groningen': 'GR'
  },
  SG: {
    'Central Region': 'CR', 'East Region': 'ER', 'North Region': 'NR',
    'North-East Region': 'NER', 'West Region': 'WR'
  },
  CH: {
    'Zürich': 'ZH', 'Genève': 'GE', 'Bern': 'BE', 'Vaud': 'VD',
    'Basel-Stadt': 'BS', 'Ticino': 'TI', 'Aargau': 'AG',
    'St. Gallen': 'SG', 'Luzern': 'LU', 'Valais': 'VS'
  }
}

/** 反向映射构建（用于补全） */
function buildReverseMap(map: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(map).map(([k, v]) => [v, k]))
}

/**
 * 将 Overpass 元素规范化为 AddressInfo。
 * 返回 null 表示不符合要求（缺少必要字段或为住宅）。
 */
function normalizeOverpassElement(el: OverpassElement, country: CountryCode): AddressInfo | null {
  const tags = el.tags
  if (!tags) return null

  // 排除住宅 building
  const building = tags.building
  if (building === 'residential' || building === 'apartments' || building === 'house' || building === 'detached') {
    return null
  }

  const housenumber = tags['addr:housenumber']
  const street = tags['addr:street']
  if (!housenumber || !street) return null

  const city = tags['addr:city'] ?? ''
  const state = tags['addr:state'] ?? ''
  const postcode = tags['addr:postcode'] ?? ''

  if (!city || !state) return null

  const placeName = tags.name || tags.brand || ''
  if (!placeName || !postcode) return null

  // 确定类别
  let category = ''
  for (const tag of ALLOWED_TAGS) {
    if (tags[tag] !== undefined) {
      category = `${tag}=${tags[tag]}`
      break
    }
  }

  // 省/州名与缩写双向补全
  const regionMap = REGION_CODE_MAPS[country] ?? {}
  const reverseMap = buildReverseMap(regionMap)
  let stateName = state
  let stateCode = regionMap[state] ?? ''
  if (!stateCode && reverseMap[state]) {
    stateName = reverseMap[state]
    stateCode = state
  }
  // 无映射时，用原名作缩写
  if (!stateCode) {
    stateCode = state
  }

  // 获取坐标
  const lat = el.center?.lat ?? el.lat ?? 0
  const lon = el.center?.lon ?? el.lon ?? 0
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || (lat === 0 && lon === 0)) {
    return null
  }

  return {
    placeName,
    street: `${housenumber} ${street}`,
    city,
    state: stateName,
    stateCode,
    zipCode: postcode,
    country,
    lat,
    lon,
    category,
    source: 'overpass'
  }
}

// ============================================================
// Fallback 地址池 — 真实公共/商业地址（按国家）
// ============================================================

const FALLBACK_POOLS: Record<CountryCode, AddressInfo[]> = {
  US: [
    {
      placeName: 'New York Public Library - Stephen A. Schwarzman Building',
      street: '476 5th Avenue',
      city: 'New York',
      state: 'New York',
      stateCode: 'NY',
      zipCode: '10018',
      country: 'US',
      lat: 40.7532,
      lon: -73.9822,
      category: 'amenity=library',
      source: 'fallback'
    },
    {
      placeName: 'Smithsonian National Air and Space Museum',
      street: '600 Independence Avenue SW',
      city: 'Washington',
      state: 'District of Columbia',
      stateCode: 'DC',
      zipCode: '20560',
      country: 'US',
      lat: 38.8881,
      lon: -77.0199,
      category: 'tourism=museum',
      source: 'fallback'
    },
    {
      placeName: 'San Francisco City Hall',
      street: '1 Dr Carlton B Goodlett Place',
      city: 'San Francisco',
      state: 'California',
      stateCode: 'CA',
      zipCode: '94102',
      country: 'US',
      lat: 37.7793,
      lon: -122.4193,
      category: 'office=government',
      source: 'fallback'
    },
    {
      placeName: 'Seattle Central Library',
      street: '1000 4th Avenue',
      city: 'Seattle',
      state: 'Washington',
      stateCode: 'WA',
      zipCode: '98104',
      country: 'US',
      lat: 47.6067,
      lon: -122.3329,
      category: 'amenity=library',
      source: 'fallback'
    },
    {
      placeName: 'Chicago Public Library - Harold Washington Library Center',
      street: '400 S State Street',
      city: 'Chicago',
      state: 'Illinois',
      stateCode: 'IL',
      zipCode: '60605',
      country: 'US',
      lat: 41.8758,
      lon: -87.6272,
      category: 'amenity=library',
      source: 'fallback'
    }
  ],
  CN: [
    {
      placeName: '国家图书馆总馆',
      street: '中关村南大街33号',
      city: '北京',
      state: '北京市',
      stateCode: '京',
      zipCode: '100081',
      country: 'CN',
      lat: 39.9427,
      lon: 116.3177,
      category: 'amenity=library',
      source: 'fallback'
    },
    {
      placeName: '上海图书馆（淮海路馆）',
      street: '淮海中路1555号',
      city: '上海',
      state: '上海市',
      stateCode: '沪',
      zipCode: '200031',
      country: 'CN',
      lat: 31.2056,
      lon: 121.4403,
      category: 'amenity=library',
      source: 'fallback'
    },
    {
      placeName: '广州图书馆',
      street: '珠江东路4号',
      city: '广州',
      state: '广东省',
      stateCode: '粤',
      zipCode: '510623',
      country: 'CN',
      lat: 23.1156,
      lon: 113.3240,
      category: 'amenity=library',
      source: 'fallback'
    }
  ],
  RU: [
    {
      placeName: 'Российская государственная библиотека',
      street: 'Воздвиженка ул., д. 3',
      city: 'Москва',
      state: 'Москва',
      stateCode: 'МСК',
      zipCode: '119019',
      country: 'RU',
      lat: 55.7517,
      lon: 37.6167,
      category: 'amenity=library',
      source: 'fallback'
    },
    {
      placeName: 'Российская национальная библиотека',
      street: 'Садовая ул., д. 18',
      city: 'Санкт-Петербург',
      state: 'Санкт-Петербург',
      stateCode: 'СПб',
      zipCode: '191069',
      country: 'RU',
      lat: 59.9341,
      lon: 30.3224,
      category: 'amenity=library',
      source: 'fallback'
    }
  ],
  GB: [
    {
      placeName: 'British Library',
      street: '96 Euston Road',
      city: 'London',
      state: 'Greater London',
      stateCode: 'LND',
      zipCode: 'NW1 2DB',
      country: 'GB',
      lat: 51.5299,
      lon: -0.1269,
      category: 'amenity=library',
      source: 'fallback'
    },
    {
      placeName: 'Manchester Central Library',
      street: 'St Peter\'s Square',
      city: 'Manchester',
      state: 'Greater Manchester',
      stateCode: 'GMC',
      zipCode: 'M2 5PD',
      country: 'GB',
      lat: 53.4791,
      lon: -2.2468,
      category: 'amenity=library',
      source: 'fallback'
    }
  ],
  FR: [
    {
      placeName: 'Bibliothèque nationale de France — François Mitterrand',
      street: 'Quai François-Mauriac',
      city: 'Paris',
      state: 'Île-de-France',
      stateCode: 'IDF',
      zipCode: '75013',
      country: 'FR',
      lat: 48.8336,
      lon: 2.3747,
      category: 'amenity=library',
      source: 'fallback'
    },
    {
      placeName: 'Bibliothèque municipale de Lyon — Part-Dieu',
      street: '30 Boulevard Marius Vivier-Merle',
      city: 'Lyon',
      state: 'Auvergne-Rhône-Alpes',
      stateCode: 'ARA',
      zipCode: '69003',
      country: 'FR',
      lat: 45.7602,
      lon: 4.8597,
      category: 'amenity=library',
      source: 'fallback'
    }
  ],
  JP: [
    {
      placeName: '国立国会図書館',
      street: '永田町1-10-1',
      city: '東京',
      state: '東京都',
      stateCode: 'TK',
      zipCode: '100-8924',
      country: 'JP',
      lat: 35.6759,
      lon: 139.7447,
      category: 'amenity=library',
      source: 'fallback'
    },
    {
      placeName: '大阪市立中央図書館',
      street: '大手前4-1-2',
      city: '大阪',
      state: '大阪府',
      stateCode: 'OS',
      zipCode: '540-0027',
      country: 'JP',
      lat: 34.6851,
      lon: 135.5198,
      category: 'amenity=library',
      source: 'fallback'
    }
  ],
  KR: [
    {
      placeName: '국립중앙도서관',
      street: '반포대로 201',
      city: '서울',
      state: '서울특별시',
      stateCode: 'SE',
      zipCode: '06590',
      country: 'KR',
      lat: 37.5104,
      lon: 126.9931,
      category: 'amenity=library',
      source: 'fallback'
    },
    {
      placeName: '부산시립중앙도서관',
      street: '중앙대로 206',
      city: '부산',
      state: '부산광역시',
      stateCode: 'BS',
      zipCode: '48943',
      country: 'KR',
      lat: 35.1792,
      lon: 129.0755,
      category: 'amenity=library',
      source: 'fallback'
    }
  ],
  DE: [
    {
      placeName: 'Staatsbibliothek zu Berlin',
      street: 'Unter den Linden 8',
      city: 'Berlin',
      state: 'Berlin',
      stateCode: 'BE',
      zipCode: '10117',
      country: 'DE',
      lat: 52.5173,
      lon: 13.3925,
      category: 'amenity=library',
      source: 'fallback'
    },
    {
      placeName: 'Bayerische Staatsbibliothek',
      street: 'Ludwigstraße 16',
      city: 'München',
      state: 'Bayern',
      stateCode: 'BY',
      zipCode: '80539',
      country: 'DE',
      lat: 48.1476,
      lon: 11.5771,
      category: 'amenity=library',
      source: 'fallback'
    }
  ],
  CA: [
    {
      placeName: 'Toronto Reference Library',
      street: '789 Yonge Street',
      city: 'Toronto',
      state: 'Ontario',
      stateCode: 'ON',
      zipCode: 'M4W 2G8',
      country: 'CA',
      lat: 43.6714,
      lon: -79.3928,
      category: 'amenity=library',
      source: 'fallback'
    },
    {
      placeName: 'Vancouver Public Library — Central Branch',
      street: '350 West Georgia Street',
      city: 'Vancouver',
      state: 'British Columbia',
      stateCode: 'BC',
      zipCode: 'V6B 6A1',
      country: 'CA',
      lat: 49.2805,
      lon: -123.1162,
      category: 'amenity=library',
      source: 'fallback'
    }
  ],
  AU: [
    {
      placeName: 'State Library of New South Wales',
      street: '1 Shakespeare Place',
      city: 'Sydney',
      state: 'New South Wales',
      stateCode: 'NSW',
      zipCode: '2000',
      country: 'AU',
      lat: -33.8688,
      lon: 151.2093,
      category: 'amenity=library',
      source: 'fallback'
    },
    {
      placeName: 'State Library of Victoria',
      street: '328 Swanston Street',
      city: 'Melbourne',
      state: 'Victoria',
      stateCode: 'VIC',
      zipCode: '3000',
      country: 'AU',
      lat: -37.8097,
      lon: 144.9654,
      category: 'amenity=library',
      source: 'fallback'
    }
  ],
  IT: [
    {
      placeName: 'Biblioteca Nazionale Centrale di Roma',
      street: 'Viale del Castro Pretorio 105',
      city: 'Roma',
      state: 'Lazio',
      stateCode: 'LAZ',
      zipCode: '00185',
      country: 'IT',
      lat: 41.9026,
      lon: 12.5049,
      category: 'amenity=library',
      source: 'fallback'
    },
    {
      placeName: 'Biblioteca Nazionale Braidense',
      street: 'Via Brera 28',
      city: 'Milano',
      state: 'Lombardia',
      stateCode: 'LOM',
      zipCode: '20121',
      country: 'IT',
      lat: 45.4723,
      lon: 9.1867,
      category: 'amenity=library',
      source: 'fallback'
    }
  ],
  ES: [
    {
      placeName: 'Biblioteca Nacional de España',
      street: 'Paseo de Recoletos 20',
      city: 'Madrid',
      state: 'Comunidad de Madrid',
      stateCode: 'MD',
      zipCode: '28001',
      country: 'ES',
      lat: 40.4241,
      lon: -3.6914,
      category: 'amenity=library',
      source: 'fallback'
    },
    {
      placeName: 'Biblioteca de Catalunya',
      street: 'Carrer de l\'Hospital 56',
      city: 'Barcelona',
      state: 'Cataluña',
      stateCode: 'CT',
      zipCode: '08001',
      country: 'ES',
      lat: 41.3828,
      lon: 2.1756,
      category: 'amenity=library',
      source: 'fallback'
    }
  ],
  NL: [
    {
      placeName: 'Koninklijke Bibliotheek van Nederland',
      street: 'Prins Willem-Alexanderhof 5',
      city: 'Den Haag',
      state: 'Zuid-Holland',
      stateCode: 'ZH',
      zipCode: '2595 BE',
      country: 'NL',
      lat: 52.0800,
      lon: 4.3139,
      category: 'amenity=library',
      source: 'fallback'
    },
    {
      placeName: 'Openbare Bibliotheek Amsterdam',
      street: 'Oosterdokskade 143',
      city: 'Amsterdam',
      state: 'Noord-Holland',
      stateCode: 'NH',
      zipCode: '1011 DL',
      country: 'NL',
      lat: 52.3742,
      lon: 4.9099,
      category: 'amenity=library',
      source: 'fallback'
    }
  ],
  SG: [
    {
      placeName: 'National Library Board Singapore',
      street: '100 Victoria Street',
      city: 'Singapore',
      state: 'Central Region',
      stateCode: 'CR',
      zipCode: '188064',
      country: 'SG',
      lat: 1.2978,
      lon: 103.8539,
      category: 'amenity=library',
      source: 'fallback'
    }
  ],
  CH: [
    {
      placeName: 'Zentralbibliothek Zürich',
      street: 'Bahnhofstrasse 15',
      city: 'Zürich',
      state: 'Zürich',
      stateCode: 'ZH',
      zipCode: '8001',
      country: 'CH',
      lat: 47.3730,
      lon: 8.5388,
      category: 'amenity=library',
      source: 'fallback'
    },
    {
      placeName: 'Bibliothèque de Genève',
      street: 'Promenade des Philosophes 5',
      city: 'Genève',
      state: 'Genève',
      stateCode: 'GE',
      zipCode: '1205',
      country: 'CH',
      lat: 46.2067,
      lon: 6.1448,
      category: 'amenity=library',
      source: 'fallback'
    }
  ]
}

/** 从指定国家的 fallback 池随机选取一个地址 */
function getRandomFallback(country: CountryCode): AddressInfo {
  const pool = FALLBACK_POOLS[country] ?? FALLBACK_POOLS.US
  const idx = Math.floor(Math.random() * pool.length)
  const src = pool[idx]
  if (!src) return pool[0]!
  return {
    placeName: src.placeName,
    street: src.street,
    city: src.city,
    state: src.state,
    stateCode: src.stateCode,
    zipCode: src.zipCode,
    country: src.country,
    lat: src.lat,
    lon: src.lon,
    category: src.category,
    source: src.source
  }
}

/** 合法国家代码 */
const VALID_COUNTRIES = new Set<CountryCode>(['CN', 'US', 'RU', 'GB', 'FR', 'JP', 'KR', 'DE', 'CA', 'AU', 'IT', 'ES', 'NL', 'SG', 'CH'])

// ============================================================
// Handler
// ============================================================

export default defineEventHandler(async (event) => {
  await verifyAdminToken(event)

  // 读取国家参数，默认 US
  const query = getQuery(event)
  const rawCountry = String(query.country ?? 'US')
  const country: CountryCode = VALID_COUNTRIES.has(rawCountry as CountryCode)
    ? (rawCountry as CountryCode)
    : 'US'

  // 选取该国家的 bbox
  const bboxPool = BBOX_POOLS[country] ?? BBOX_POOLS.US
  const bbox = bboxPool[Math.floor(Math.random() * bboxPool.length)]!
  const overpassQuery = buildOverpassQuery(bbox)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT)

  try {
    const response = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: OVERPASS_HEADERS,
      body: `data=${encodeURIComponent(overpassQuery)}`,
      signal: controller.signal
    })

    if (!response.ok) {
      throw new Error(`Overpass HTTP ${response.status}`)
    }

    const data = await response.json() as OverpassResponse

    if (!data.elements || data.elements.length === 0) {
      return { address: getRandomFallback(country) }
    }

    const addresses: AddressInfo[] = []
    for (const el of data.elements) {
      const addr = normalizeOverpassElement(el, country)
      if (addr) {
        addresses.push(addr)
      }
    }

    if (addresses.length === 0) {
      return { address: getRandomFallback(country) }
    }

    const chosen = addresses[Math.floor(Math.random() * addresses.length)]!
    return { address: chosen }
  } catch (error) {
    console.warn('[Overpass] fallback:', error instanceof Error ? error.message : error)
    return { address: getRandomFallback(country) }
  } finally {
    clearTimeout(timeoutId)
  }
})

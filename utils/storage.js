/**
 * 云开发数据库封装
 * 集合：wedding_config / blessings / guests
 * 未开通云开发时自动回退本地存储，保证功能可用
 */
const { DEFAULT_WEDDING } = require('../data/wedding.js')

const KEY_WEDDING = 'wedding_config'
const KEY_BLESSINGS = 'blessings'
const KEY_GUESTS = 'guest_list'
const DOC_WEDDING_ID = 'main'

// 静态托管域名（媒体资源最终地址）与历史 cloud:// 文件名 -> 现名的映射
const STATIC_BASE = 'https://cloud1-d1gknvmit778344ba-1327805972.tcloudbaseapp.com'
const LEGACY_FILE_RENAMES = {
  'images/玫瑰.png': 'images/rose.png',
  'images/求婚-removebg-preview.png': 'images/propose.png'
}

// 旧配置里存的是 cloud:// 云存储地址（客户端 getTempFileURL 受权限规则限制，已弃用），
// 统一迁移到静态托管公网 https 地址
function migrateMediaSrc(v) {
  if (typeof v !== 'string' || v.indexOf('cloud://') !== 0) {
    return v
  }
  const slash = v.indexOf('/', 'cloud://'.length)
  if (slash < 0) {
    return v
  }
  const path = v.slice(slash + 1)
  return STATIC_BASE + '/' + (LEGACY_FILE_RENAMES[path] || path)
}

let cloudReady = false

function initCloud() {
  if (!wx.cloud) {
    console.log('当前基础库不支持云开发，使用本地存储')
    return false
  }
  try {
    const app = getApp()
    const env = (app && app.globalData && app.globalData.cloudEnv) || ''
    if (env) {
      wx.cloud.init({ env, traceUser: true })
    } else {
      wx.cloud.init({ traceUser: true })
    }
    cloudReady = true
    return true
  } catch (e) {
    console.log('云开发初始化失败，回退本地存储', e)
    cloudReady = false
    return false
  }
}

function isCloudReady() {
  return cloudReady
}

function getDb() {
  if (!cloudReady) {
    return null
  }
  try {
    return wx.cloud.database()
  } catch (e) {
    return null
  }
}

function padZero(num) {
  return num < 10 ? '0' + num : '' + num
}

function formatTime(date) {
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hour = date.getHours()
  const minute = date.getMinutes()
  return `${month}月${day}日 ${padZero(hour)}:${padZero(minute)}`
}

// 合并配置：媒体资源已全部改走静态托管（公网 https），旧配置里的 cloud:// 云存储地址
// 迁移到静态托管；包内本地路径、unsplash 外链、误存的占位文本（如 "URL"）一律回退默认地址
function mergeWedding(saved) {
  const merged = { ...DEFAULT_WEDDING, ...saved }
  const isValidMediaSrc = (v) =>
    typeof v === 'string' &&
    (v.indexOf('cloud://') === 0 || v.indexOf('https://') === 0 || v.indexOf('http://') === 0)
  // cloud:// 优先迁移成静态托管地址，迁移失败再走默认回退
  merged.musicSrc = migrateMediaSrc(merged.musicSrc)
  merged.coverImage = migrateMediaSrc(merged.coverImage)
  merged.inviteImage = migrateMediaSrc(merged.inviteImage)
  // 旧配置里存过包内本地路径、空值或占位文本会盖掉云存储默认地址，导致音乐/图片静默失效，这里补回默认
  if (!isValidMediaSrc(merged.musicSrc)) {
    merged.musicSrc = DEFAULT_WEDDING.musicSrc
  }
  if (!isValidMediaSrc(merged.coverImage)) {
    merged.coverImage = DEFAULT_WEDDING.coverImage
  }
  if (!isValidMediaSrc(merged.inviteImage)) {
    merged.inviteImage = DEFAULT_WEDDING.inviteImage
  }
  // 装饰图为对象配置，逐项迁移 cloud:// 后校验，无效地址回填默认值
  const deco = { ...DEFAULT_WEDDING.deco, ...((saved && saved.deco) || {}) }
  Object.keys(deco).forEach((key) => {
    deco[key] = migrateMediaSrc(deco[key])
    if (!isValidMediaSrc(deco[key])) {
      deco[key] = DEFAULT_WEDDING.deco[key]
    }
  })
  merged.deco = deco
  // 地图导航功能已移除，清理旧配置里遗留的经纬度
  delete merged.latitude
  delete merged.longitude
  // 照片逐张校验：先迁移 cloud://，无效地址按同序号默认照片回填，越界的无效条目丢弃
  if (Array.isArray(merged.photos)) {
    merged.photos = merged.photos
      .map((p, i) => {
        const fallback = DEFAULT_WEDDING.photos[i]
        const src = p && migrateMediaSrc(p.src)
        if (!p || typeof p !== 'object' || !isValidMediaSrc(src)) {
          return fallback ? { ...fallback, ...(p || {}), src: fallback.src } : null
        }
        return { ...p, src }
      })
      .filter(Boolean)
  }
  // 旧配置的流程条目没有英文名（en）和图标（icon），按序号回填默认值，保证左右分栏排版完整
  if (Array.isArray(merged.timeline)) {
    merged.timeline = merged.timeline.map((item, i) => {
      const fallback = DEFAULT_WEDDING.timeline[i] || {}
      return {
        ...fallback,
        ...item,
        en: item.en || fallback.en,
        icon: item.icon || fallback.icon
      }
    })
  }
  return merged
}

function getWeddingLocal() {
  try {
    const saved = wx.getStorageSync(KEY_WEDDING)
    if (saved && typeof saved === 'object') {
      return mergeWedding(saved)
    }
  } catch (e) {
    console.log('读取本地婚礼配置失败', e)
  }
  return { ...DEFAULT_WEDDING }
}

function setWeddingLocal(config) {
  const next = { ...getWeddingLocal(), ...config }
  wx.setStorageSync(KEY_WEDDING, next)
  return next
}

function getBlessingsLocal() {
  try {
    return wx.getStorageSync(KEY_BLESSINGS) || []
  } catch (e) {
    return []
  }
}

function setBlessingsLocal(list) {
  wx.setStorageSync(KEY_BLESSINGS, list || [])
}

function getGuestsLocal() {
  try {
    return wx.getStorageSync(KEY_GUESTS) || []
  } catch (e) {
    return []
  }
}

function setGuestsLocal(list) {
  wx.setStorageSync(KEY_GUESTS, list || [])
}

function getWedding() {
  return getWeddingLocal()
}

function setWedding(config) {
  const next = setWeddingLocal(config)
  saveWeddingCloud(next)
  return next
}

function getBlessings() {
  return getBlessingsLocal()
}

function setBlessings(list) {
  setBlessingsLocal(list)
}

function getGuests() {
  return getGuestsLocal()
}

function setGuests(list) {
  setGuestsLocal(list)
  saveGuestsCloud(list)
}

async function loadWeddingAsync() {
  const local = getWeddingLocal()
  const db = getDb()
  if (!db) {
    return local
  }
  try {
    // 空集合时 doc('main').get() 会抛「cannot find document」错误，改用查询：无记录返回空数组
    const res = await db.collection('wedding_config').limit(1).get()
    const doc = res && res.data && res.data[0]
    if (doc) {
      const merged = mergeWedding(doc)
      delete merged._id
      setWeddingLocal(merged)
      return merged
    }
  } catch (e) {
    console.log('云端婚礼配置读取失败，使用本地', e)
  }
  return local
}

async function saveWeddingCloud(config) {
  const db = getDb()
  if (!db) {
    return false
  }
  try {
    const payload = { ...config }
    delete payload._id
    payload.updatedAt = db.serverDate()
    await db.collection('wedding_config').doc(DOC_WEDDING_ID).set({
      data: payload
    })
    return true
  } catch (e) {
    console.log('云端婚礼配置保存失败', e)
    return false
  }
}

async function loadBlessingsAsync() {
  const local = getBlessingsLocal()
  const db = getDb()
  if (!db) {
    return local
  }
  try {
    const res = await db.collection('blessings').orderBy('createdAt', 'desc').limit(100).get()
    const list = (res.data || []).map((item) => ({
      id: item._id,
      name: item.name,
      count: item.count,
      message: item.message,
      time: item.time
    }))
    if (list.length > 0) {
      setBlessingsLocal(list)
      return list
    }
  } catch (e) {
    console.log('云端祝福读取失败，使用本地', e)
  }
  return local
}

async function addBlessingAsync(blessing) {
  const localList = [blessing, ...getBlessingsLocal()]
  setBlessingsLocal(localList)

  const db = getDb()
  if (!db) {
    return { ok: true, cloud: false, list: localList, blessing }
  }
  try {
    const res = await db.collection('blessings').add({
      data: {
        name: blessing.name,
        count: blessing.count,
        message: blessing.message,
        time: blessing.time,
        createdAt: db.serverDate()
      }
    })
    if (res._id) {
      blessing.id = res._id
      localList[0] = blessing
      setBlessingsLocal(localList)
    }
    return { ok: true, cloud: true, list: localList, blessing }
  } catch (e) {
    console.log('云端祝福写入失败，已保存在本地', e)
    return { ok: true, cloud: false, list: localList, blessing }
  }
}

async function loadGuestsAsync() {
  const local = getGuestsLocal()
  const db = getDb()
  if (!db) {
    return local
  }
  try {
    const res = await db.collection('guests').orderBy('createdAt', 'desc').limit(200).get()
    const list = (res.data || []).map((item) => ({
      id: item._id || item.id,
      name: item.name,
      count: item.count,
      status: item.status,
      message: item.message,
      time: item.time
    }))
    if (list.length > 0) {
      setGuestsLocal(list)
      return list
    }
  } catch (e) {
    console.log('云端名单读取失败，使用本地', e)
  }
  return local
}

async function saveGuestsCloud(list) {
  const db = getDb()
  if (!db) {
    return false
  }
  // 名单以本地为准全量同步较重，改为单条 upsert 由调用方处理
  return true
}

async function upsertGuestAsync(guest) {
  const guests = getGuestsLocal()
  const idx = guests.findIndex((g) => g.id === guest.id)
  if (idx >= 0) {
    guests[idx] = guest
  } else {
    guests.unshift(guest)
  }
  setGuestsLocal(guests)

  const db = getDb()
  if (!db) {
    return { ok: true, cloud: false, list: guests }
  }
  try {
    const data = {
      name: guest.name,
      count: guest.count,
      status: guest.status,
      message: guest.message || '',
      time: guest.time || formatTime(new Date()),
      updatedAt: db.serverDate()
    }
    if (guest.id && typeof guest.id === 'string' && guest.id.length >= 16) {
      await db.collection('guests').doc(guest.id).update({ data })
    } else {
      const res = await db.collection('guests').add({
        data: { ...data, createdAt: db.serverDate() }
      })
      if (res._id) {
        if (idx >= 0) {
          guests[idx].id = res._id
        } else {
          guests[0].id = res._id
        }
        setGuestsLocal(guests)
      }
    }
    return { ok: true, cloud: true, list: guests }
  } catch (e) {
    console.log('云端名单写入失败，已保存在本地', e)
    return { ok: true, cloud: false, list: guests }
  }
}

async function removeGuestAsync(id) {
  const guests = getGuestsLocal().filter((g) => g.id !== id)
  setGuestsLocal(guests)
  const db = getDb()
  if (!db) {
    return { ok: true, cloud: false, list: guests }
  }
  try {
    if (typeof id === 'string' && id.length >= 16) {
      await db.collection('guests').doc(id).remove()
    }
    return { ok: true, cloud: true, list: guests }
  } catch (e) {
    console.log('云端名单删除失败，已在本地删除', e)
    return { ok: true, cloud: false, list: guests }
  }
}

module.exports = {
  initCloud,
  isCloudReady,
  getWedding,
  setWedding,
  getBlessings,
  setBlessings,
  getGuests,
  setGuests,
  loadWeddingAsync,
  loadBlessingsAsync,
  loadGuestsAsync,
  addBlessingAsync,
  upsertGuestAsync,
  removeGuestAsync,
  padZero,
  formatTime,
  DEFAULT_WEDDING
}

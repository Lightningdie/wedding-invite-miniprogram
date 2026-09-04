/**
 * 云开发数据库封装
 * 集合：wedding_config / blessings / guests
 * 未开通云开发时自动回退本地存储，保证功能可用
 */
const { DEFAULT_WEDDING } = require('../data/wedding.js')

const KEY_WEDDING = 'wedding_config'
const KEY_BLESSINGS = 'blessings'
const KEY_GUESTS = 'guest_list'
// 已删除宾客 id 墓碑：云端记录受「仅创建者可读写」权限限制删不掉时，防止下次从云端拉取时复活
const KEY_GUEST_DELETED = 'guest_deleted_ids'
// 已删除留言 id 墓碑：同上，留言管理页删除失败时本机保持隐藏
const KEY_BLESS_DELETED = 'blessing_deleted_ids'
// 云端留言「已清空」标记：区分「云端真的被清空」与「云端异常为空（环境重置/误清）」，
// 后者保留本地数据，避免云端意外清空连带损失本机留言
const KEY_BLESS_CLEARED = 'blessing_cloud_cleared'
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
  // 数组字段防损坏：存档里被写成非数组时整体回退默认，避免损坏值透传到页面渲染
  const useArrayOr = (v, fallback) => (Array.isArray(v) ? v : fallback)
  merged.inviteLines = useArrayOr(merged.inviteLines, DEFAULT_WEDDING.inviteLines)
  merged.inviteFiller = useArrayOr(merged.inviteFiller, DEFAULT_WEDDING.inviteFiller)
  merged.stories = useArrayOr(merged.stories, DEFAULT_WEDDING.stories)
  merged.transportTips = useArrayOr(merged.transportTips, DEFAULT_WEDDING.transportTips)
  merged.photos = useArrayOr(merged.photos, DEFAULT_WEDDING.photos.map((p) => ({ ...p })))
  merged.timeline = useArrayOr(merged.timeline, DEFAULT_WEDDING.timeline.map((t) => ({ ...t })))
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

// 已删除宾客 id 列表（统一存字符串，避免数字/字符串 id 比较不一致）
function getDeletedGuestIds() {
  try {
    return (wx.getStorageSync(KEY_GUEST_DELETED) || []).map(String)
  } catch (e) {
    return []
  }
}

function setDeletedGuestIds(list) {
  wx.setStorageSync(KEY_GUEST_DELETED, list || [])
}

// 已删除留言 id 列表（统一存字符串，与宾客墓碑同理）
function getDeletedBlessingIds() {
  try {
    return (wx.getStorageSync(KEY_BLESS_DELETED) || []).map(String)
  } catch (e) {
    return []
  }
}

function setDeletedBlessingIds(list) {
  wx.setStorageSync(KEY_BLESS_DELETED, list || [])
}

// 云端「已清空」标记（时间戳）：clearBlessingsAsync 成功后落盘
function getBlessingClearFlag() {
  try {
    return wx.getStorageSync(KEY_BLESS_CLEARED) || 0
  } catch (e) {
    return 0
  }
}

function setBlessingClearFlag() {
  wx.setStorageSync(KEY_BLESS_CLEARED, Date.now())
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
  const deleted = getDeletedBlessingIds()
  const mapRow = (item) => ({
    id: item._id || item.id,
    name: item.name,
    count: item.count,
    message: item.message,
    time: item.time
  })

  // 云函数优先：全量拉取（绕过权限）；墓碑过滤兜底历史删除失败的记录
  const viaFn = await callBlessingsApi('list')
  if (viaFn && viaFn.list) {
    const list = viaFn.list.map(mapRow).filter((b) => deleted.indexOf(String(b.id)) < 0)
    // 云端为空且没有「已清空」标记时视为异常（环境重置/误清），保留本地数据防丢失
    if (list.length === 0 && !getBlessingClearFlag() && local.length > 0) {
      console.log('云端留言异常为空，保留本地数据')
      return local
    }
    setBlessingsLocal(list)
    return list
  }

  const db = getDb()
  if (!db) {
    return local
  }
  try {
    const res = await db.collection('blessings').orderBy('createdAt', 'desc').limit(100).get()
    const list = (res.data || [])
      .map(mapRow)
      .filter((b) => deleted.indexOf(String(b.id)) < 0)
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

// 云函数 manageGuests（管理端专用）：以云端权限执行，绕过「仅创建者可读写」限制，
// 让名单管理界面的增删改查真正落到云数据库；函数未部署/失败时返回 null 走回退链
async function callGuestsApi(action, payload) {
  if (!cloudReady || !wx.cloud.callFunction) {
    return null
  }
  try {
    const res = await wx.cloud.callFunction({
      name: 'manageGuests',
      data: Object.assign({ action }, payload || {})
    })
    const result = res && res.result
    if (result && result.ok) {
      return result
    }
    console.log('manageGuests 拒绝请求', result && result.error)
  } catch (e) {
    console.log('manageGuests 云函数不可用，回退直连', e)
  }
  return null
}

// 云函数 manageBlessings（管理端专用）：与管理函数同款约定，绕过「仅创建者可读写」，
// 让留言管理界面的改删清空真正落到云数据库；函数未部署/失败时返回 null 走回退链
async function callBlessingsApi(action, payload) {
  if (!cloudReady || !wx.cloud.callFunction) {
    return null
  }
  try {
    const res = await wx.cloud.callFunction({
      name: 'manageBlessings',
      data: Object.assign({ action }, payload || {})
    })
    const result = res && res.result
    if (result && result.ok) {
      return result
    }
    console.log('manageBlessings 拒绝请求', result && result.error)
  } catch (e) {
    console.log('manageBlessings 云函数不可用，回退直连', e)
  }
  return null
}

// 云函数 manageConfig（管理端专用）：与管理函数同款约定，
// 「恢复默认」时删除云端 wedding_config.main 文档用
async function callConfigApi(action) {
  if (!cloudReady || !wx.cloud.callFunction) {
    return null
  }
  try {
    const res = await wx.cloud.callFunction({
      name: 'manageConfig',
      data: { action: action }
    })
    const result = res && res.result
    if (result && result.ok) {
      return result
    }
    console.log('manageConfig 拒绝请求', result && result.error)
  } catch (e) {
    console.log('manageConfig 云函数不可用，回退直连', e)
  }
  return null
}

// 「恢复默认」：云端文档与本地存档一并清掉（只删本地会被云值重新覆盖，重置形同虚设）
async function resetWeddingAsync() {
  let cloud = false
  // 1) 云函数优先：云端权限删配置（doc 兼存 adminOpenId，删掉后下次云端调用重新登记管理员）
  if (await callConfigApi('clear')) {
    cloud = true
  } else if (cloudReady) {
    // 2) 云函数不可用：回退直连（doc 为本机创建时才能删掉）
    const db = getDb()
    if (db) {
      try {
        await db.collection('wedding_config').doc(DOC_WEDDING_ID).remove()
        cloud = true
      } catch (e) {
        console.log('云端婚礼配置删除失败', e)
      }
    }
  }
  // 3) 本地存档必清
  try {
    wx.removeStorageSync(KEY_WEDDING)
  } catch (e) {
    console.log('本地婚礼配置清除失败', e)
  }
  return { ok: true, cloud }
}

async function loadGuestsAsync() {
  const local = getGuestsLocal()
  // 云函数优先：全量拉取（绕过权限）；墓碑过滤兜底历史删除失败的记录
  const viaFn = await callGuestsApi('list')
  if (viaFn && viaFn.list) {
    const deleted = getDeletedGuestIds()
    const list = viaFn.list
      .map((item) => ({
        id: item._id || item.id,
        name: item.name,
        count: item.count,
        status: item.status,
        message: item.message,
        time: item.time
      }))
      .filter((g) => deleted.indexOf(String(g.id)) < 0)
    setGuestsLocal(list)
    return list
  }
  const db = getDb()
  if (!db) {
    return local
  }
  try {
    const res = await db.collection('guests').orderBy('createdAt', 'desc').limit(200).get()
    // 已删除墓碑过滤：云端删不掉的记录（权限仅创建者可写）在本机保持隐藏，避免删除后又被拉回来
    const deleted = getDeletedGuestIds()
    const list = (res.data || [])
      .map((item) => ({
        id: item._id || item.id,
        name: item.name,
        count: item.count,
        status: item.status,
        message: item.message,
        time: item.time
      }))
      .filter((g) => deleted.indexOf(String(g.id)) < 0)
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

// manage=true 表示来自名单管理页：可走 manageGuests 云函数（云端权限，能改删所有人记录）。
// 首页宾客提交祝福的自动登记走直连（创建者权限即可），避免宾客触发云函数抢先成为管理员。
async function upsertGuestAsync(guest, manage) {
  const data = {
    name: guest.name,
    count: guest.count,
    status: guest.status,
    message: guest.message || '',
    time: guest.time || formatTime(new Date())
  }
  let id = guest.id
  let cloud = false

  // 1) 云函数优先（仅管理页）：绕过「仅创建者可读写」，任何记录都能改
  if (manage && typeof id === 'string' && id.length >= 16) {
    if (await callGuestsApi('update', { id, guest: data })) {
      cloud = true
    }
  } else if (manage) {
    const r = await callGuestsApi('add', { guest: data })
    if (r && r.id) {
      id = r.id
      cloud = true
    }
  }

  // 2) 云函数不可用：回退客户端直连（仅能写本机创建的记录）
  if (!cloud && cloudReady) {
    const db = getDb()
    if (db) {
      try {
        if (typeof id === 'string' && id.length >= 16) {
          await db
            .collection('guests')
            .doc(id)
            .update({ data: Object.assign({}, data, { updatedAt: db.serverDate() }) })
          cloud = true
        } else {
          const res = await db
            .collection('guests')
            .add({ data: Object.assign({}, data, { createdAt: db.serverDate() }) })
          if (res._id) {
            id = res._id
            cloud = true
          }
        }
      } catch (e) {
        console.log('云端名单写入失败，已保存在本地', e)
      }
    }
  }

  // 3) 本地记录同步（云端 add 换了 _id 时，把旧数字 id 记录替换掉）
  const guests = getGuestsLocal()
  if (String(id) !== String(guest.id)) {
    const oldIdx = guests.findIndex((g) => String(g.id) === String(guest.id))
    if (oldIdx >= 0) {
      guests.splice(oldIdx, 1)
    }
  }
  const record = Object.assign({}, guest, { id })
  const idx = guests.findIndex((g) => String(g.id) === String(id))
  if (idx >= 0) {
    guests[idx] = record
  } else {
    guests.unshift(record)
  }
  setGuestsLocal(guests)
  return { ok: true, cloud, list: guests }
}

async function removeGuestAsync(id) {
  // dataset 传参在部分机型会把数字 id 转成字符串，统一按字符串比较，避免漏删
  const sid = String(id)
  let cloud = false

  // 1) 云函数优先：云端权限删除（数字 id 是纯本地记录，云端本来就没有，跳过）
  if (typeof id === 'string' && id.length >= 16) {
    if (await callGuestsApi('remove', { id })) {
      cloud = true
      // 云端真删掉了，清掉这条墓碑
      setDeletedGuestIds(getDeletedGuestIds().filter((d) => d !== sid))
    }
  }

  // 2) 云函数不可用：回退直连（仅创建者权限，别人的记录删不掉）
  if (!cloud && cloudReady && typeof id === 'string' && id.length >= 16) {
    const db = getDb()
    if (db) {
      try {
        await db.collection('guests').doc(id).remove()
        cloud = true
      } catch (e) {
        console.log('云端名单删除失败（权限受限）', e)
      }
    }
  }

  // 3) 云端删不掉时记墓碑：本机拉取时不再显示，防止删除后又被拉回来
  if (!cloud) {
    const deleted = getDeletedGuestIds()
    if (deleted.indexOf(sid) < 0) {
      deleted.unshift(sid)
      setDeletedGuestIds(deleted)
    }
  }

  const guests = getGuestsLocal().filter((g) => String(g.id) !== sid)
  setGuestsLocal(guests)
  return { ok: true, cloud, list: guests }
}

async function updateBlessingAsync(blessing) {
  const data = {
    name: blessing.name,
    count: Number(blessing.count) || 1,
    message: blessing.message,
    time: blessing.time || ''
  }
  let cloud = false
  const sid = String(blessing.id)

  // 1) 云函数优先：云端权限可改任何人的记录（数字 id 是纯本地记录，云端没有，跳过）
  if (typeof blessing.id === 'string' && blessing.id.length >= 16) {
    if (await callBlessingsApi('update', { id: blessing.id, blessing: data })) {
      cloud = true
    } else if (cloudReady) {
      // 2) 云函数不可用：回退直连（仅能改本机创建的记录）
      const db = getDb()
      if (db) {
        try {
          await db.collection('blessings').doc(blessing.id).update({ data })
          cloud = true
        } catch (e) {
          console.log('云端祝福更新失败', e)
        }
      }
    }
  }

  // 3) 本地同步：界面上立即生效
  const list = getBlessingsLocal().map((b) => {
    return String(b.id) === sid ? Object.assign({}, b, data) : b
  })
  setBlessingsLocal(list)
  return { ok: true, cloud, list }
}

async function removeBlessingAsync(id) {
  // dataset 传参在部分机型会把数字 id 转成字符串，统一按字符串比较，避免漏删
  const sid = String(id)
  let cloud = false

  // 1) 云函数优先：云端权限删除；真删掉则清掉这条墓碑
  if (typeof id === 'string' && id.length >= 16) {
    if (await callBlessingsApi('remove', { id })) {
      cloud = true
      setDeletedBlessingIds(getDeletedBlessingIds().filter((d) => d !== sid))
    }
  }

  // 2) 云函数不可用：回退直连（仅创建者权限，别人的记录删不掉）
  if (!cloud && cloudReady && typeof id === 'string' && id.length >= 16) {
    const db = getDb()
    if (db) {
      try {
        await db.collection('blessings').doc(id).remove()
        cloud = true
      } catch (e) {
        console.log('云端祝福删除失败（权限受限）', e)
      }
    }
  }

  // 3) 云端删不掉时记墓碑：本机拉取时不再显示，防止删除后又被拉回来
  if (!cloud) {
    const deleted = getDeletedBlessingIds()
    if (deleted.indexOf(sid) < 0) {
      deleted.unshift(sid)
      setDeletedBlessingIds(deleted)
    }
  }

  const list = getBlessingsLocal().filter((b) => String(b.id) !== sid)
  setBlessingsLocal(list)
  return { ok: true, cloud, list }
}

async function clearBlessingsAsync() {
  let cloud = false
  const locals = getBlessingsLocal()

  // 1) 云函数优先：云端权限清空整集合，成功后落「已清空」标记
  if (await callBlessingsApi('clear')) {
    cloud = true
    setBlessingClearFlag()
  }

  // 2) 云函数不可用时：直连删不掉别人的记录，全部记墓碑保持隐藏，防止拉取时复活
  if (!cloud) {
    const deleted = getDeletedBlessingIds()
    locals.forEach((b) => {
      const sid = String(b.id)
      if (typeof b.id === 'string' && b.id.length >= 16 && deleted.indexOf(sid) < 0) {
        deleted.unshift(sid)
      }
    })
    setDeletedBlessingIds(deleted)
  }

  setBlessingsLocal([])
  return { ok: true, cloud, list: [] }
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
  resetWeddingAsync,
  loadGuestsAsync,
  addBlessingAsync,
  updateBlessingAsync,
  removeBlessingAsync,
  clearBlessingsAsync,
  upsertGuestAsync,
  removeGuestAsync,
  padZero,
  formatTime,
  DEFAULT_WEDDING
}

/**
 * 祝福留言云端管理（管理页专用）
 *
 * 与 manageGuests 同理：blessings 集合默认权限「仅创建者可读写」，
 * 管理端直连数据库改删不掉别的 openid 创建的留言，云函数以云端管理权限
 * 执行，绕过安全规则，让留言管理界面的改删清空真正落到云数据库。
 *
 * 动作：
 *   list    拉取全部留言（按创建时间倒序）
 *   update  按 _id 更新留言
 *   remove  按 _id 删除留言
 *   clear   清空全部留言（写入 clearedAt 标记供各端同步）
 *
 * 管理员识别：与管理页共用 wedding_config.main.adminOpenId，
 * 首位调用者自动登记为管理员，此后仅管理员可操作。
 */
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

async function ensureAdmin(openid) {
  const col = db.collection('wedding_config')
  let doc = null
  try {
    doc = (await col.doc('main').get()).data
  } catch (e) {
    doc = null // 文档不存在
  }
  if (doc && doc.adminOpenId) {
    return doc.adminOpenId === openid
  }
  // 首位调用者成为管理员；update 只改这一个字段，不动其他配置
  if (doc) {
    await col.doc('main').update({ data: { adminOpenId: openid } })
  } else {
    await col.doc('main').set({ data: { adminOpenId: openid } })
  }
  return true
}

// 清空事件标记（wedding_config.blessings_cleared.clearedAt）：
// 管理端清空云端后写入，其他设备拉取时发现标记比本地记录的新，
// 就同步清掉本机留言缓存，保证各端留言展示区跟着变化
async function readClearedAt() {
  try {
    const doc = (await db.collection('wedding_config').doc('blessings_cleared').get()).data
    return (doc && doc.clearedAt) || 0
  } catch (e) {
    return 0 // 标记文档不存在，视为从未清空
  }
}

async function writeClearedAt() {
  const ts = Date.now()
  try {
    await db.collection('wedding_config').doc('blessings_cleared').set({
      data: { clearedAt: ts }
    })
  } catch (e) {
    console.log('清空标记写入失败', e)
  }
  return ts
}

function pickBlessing(b) {
  b = b || {}
  return {
    name: b.name || '',
    count: Number(b.count) || 1,
    message: b.message || '',
    time: b.time || ''
  }
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const action = event.action
  const col = db.collection('blessings')

  try {
    if (!(await ensureAdmin(OPENID))) {
      return { ok: false, error: '仅管理员可管理祝福留言' }
    }

    if (action === 'list') {
      const res = await col.orderBy('createdAt', 'desc').limit(1000).get()
      return { ok: true, list: res.data, clearedAt: await readClearedAt() }
    }
    if (action === 'update') {
      const data = Object.assign(pickBlessing(event.blessing), { updatedAt: db.serverDate() })
      await col.doc(event.id).update({ data })
      return { ok: true }
    }
    if (action === 'remove') {
      await col.doc(event.id).remove()
      return { ok: true }
    }
    if (action === 'clear') {
      // 分批删，单次 remove 全集合会超时/超限
      const MAX = 100
      for (;;) {
        const res = await col.limit(MAX).get()
        if (!res.data || res.data.length === 0) {
          break
        }
        for (const doc of res.data) {
          await col.doc(doc._id).remove()
        }
        if (res.data.length < MAX) {
          break
        }
      }
      const clearedAt = await writeClearedAt()
      return { ok: true, clearedAt }
    }
    return { ok: false, error: '未知操作 ' + action }
  } catch (e) {
    return { ok: false, error: (e && e.errMsg) || String(e) }
  }
}

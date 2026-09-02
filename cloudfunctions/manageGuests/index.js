/**
 * 宾客名单云端管理（管理页专用）
 *
 * 背景：guests 集合默认权限「仅创建者可读写」，管理端直连数据库删不掉
 * 别的 openid 创建的记录。云函数以云端管理权限执行，绕过安全规则，
 * 让名单管理界面的增删改查真正落到云数据库。
 *
 * 动作：
 *   list   拉取全部宾客（按创建时间倒序）
 *   add    新增宾客，返回云端 _id
 *   update 按 _id 更新宾客
 *   remove 按 _id 删除宾客
 *
 * 管理员识别：只有管理页会调用本函数，首次调用者自动登记为管理员
 * （存于 wedding_config.main.adminOpenId），此后仅管理员可操作。
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

function pickGuest(g) {
  g = g || {}
  return {
    name: g.name || '',
    count: Number(g.count) || 1,
    status: g.status || 'pending',
    message: g.message || '',
    time: g.time || ''
  }
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const action = event.action
  const col = db.collection('guests')

  try {
    if (!(await ensureAdmin(OPENID))) {
      return { ok: false, error: '仅管理员可管理宾客名单' }
    }

    if (action === 'list') {
      const res = await col.orderBy('createdAt', 'desc').limit(1000).get()
      return { ok: true, list: res.data }
    }
    if (action === 'add') {
      const data = Object.assign(pickGuest(event.guest), {
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      })
      const res = await col.add({ data })
      return { ok: true, id: res._id }
    }
    if (action === 'update') {
      const data = Object.assign(pickGuest(event.guest), { updatedAt: db.serverDate() })
      await col.doc(event.id).update({ data })
      return { ok: true }
    }
    if (action === 'remove') {
      await col.doc(event.id).remove()
      return { ok: true }
    }
    return { ok: false, error: '未知操作 ' + action }
  } catch (e) {
    return { ok: false, error: (e && e.errMsg) || String(e) }
  }
}

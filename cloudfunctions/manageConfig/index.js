/**
 * 婚礼配置云端管理（管理页专用）
 *
 * 背景：「恢复默认」此前只删本地存档，云端 wedding_config.main 仍在，
 * 下次读取又被云值覆盖，重置形同虚设。本函数以云端管理权限删除配置文档，
 * 与 manageGuests / manageBlessings 共用同一管理员识别
 * （wedding_config.main.adminOpenId，首位调用者自动登记）。
 *
 * 动作：
 *   clear 删除 wedding_config.main 文档（下次读取回退默认配置）
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

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const action = event.action

  try {
    if (!(await ensureAdmin(OPENID))) {
      return { ok: false, error: '仅管理员可管理婚礼配置' }
    }

    if (action === 'clear') {
      // 文档不存在时 remove 会抛错，视为已清空
      try {
        await db.collection('wedding_config').doc('main').remove()
      } catch (e) {
        // ignore: 文档本来就不存在
      }
      return { ok: true }
    }
    return { ok: false, error: '未知操作 ' + action }
  } catch (e) {
    return { ok: false, error: (e && e.errMsg) || String(e) }
  }
}

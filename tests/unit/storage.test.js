const { describe, it, beforeEach, assert } = require('../run.js')
const h = require('../helpers/harness.js')

describe('utils/storage.js 白盒：纯函数', () => {
  let storage
  beforeEach(() => {
    h.reset()
    storage = require(h.ROOT + '/utils/storage.js')
  })

  it('padZero 个位补零、两位保持', () => {
    assert.equal(storage.padZero(0), '00')
    assert.equal(storage.padZero(5), '05')
    assert.equal(storage.padZero(10), '10')
    assert.equal(storage.padZero(99), '99')
  })

  it('formatTime 中文格式，时分补零', () => {
    const t = storage.formatTime(new Date(2026, 8, 29, 8, 5))
    assert.equal(t, '9月29日 08:05')
  })
})

describe('utils/storage.js 白盒：本地配置合并与媒体迁移', () => {
  let storage
  let DEFAULT
  beforeEach(() => {
    h.reset()
    storage = require(h.ROOT + '/utils/storage.js')
    DEFAULT = storage.DEFAULT_WEDDING
  })

  it('无存档时返回全默认配置', () => {
    const w = storage.getWedding()
    assert.equal(w.groom, DEFAULT.groom)
    assert.equal(w.musicSrc, DEFAULT.musicSrc)
    assert.equal(w.photos.length, DEFAULT.photos.length)
  })

  it('cloud:// 旧地址迁移为静态托管 https 地址', () => {
    h.state.wx.setStorageSync('wedding_config', {
      coverImage: 'cloud://env-abc.1234-env-abc/images/firstpage.jpg'
    })
    const w = storage.getWedding()
    assert.ok(w.coverImage.indexOf('https://') === 0, '封面应迁移为 https: ' + w.coverImage)
    assert.ok(w.coverImage.indexOf('tcloudbaseapp.com') > 0)
    assert.ok(w.coverImage.indexOf('/images/firstpage.jpg') > 0)
  })

  it('占位文本/包内路径的媒体地址回退默认值', () => {
    h.state.wx.setStorageSync('wedding_config', {
      musicSrc: 'URL',
      coverImage: '/assets/images/local.jpg',
      inviteImage: ''
    })
    const w = storage.getWedding()
    assert.equal(w.musicSrc, DEFAULT.musicSrc)
    assert.equal(w.coverImage, DEFAULT.coverImage)
    assert.equal(w.inviteImage, DEFAULT.inviteImage)
  })

  it('deco 无效项回默认、cloud:// 项迁移', () => {
    h.state.wx.setStorageSync('wedding_config', {
      deco: {
        rose: 'cloud://env-abc.1234-env-abc/images/rose.png',
        cake: 'broken'
      }
    })
    const w = storage.getWedding()
    assert.ok(w.deco.rose.indexOf('https://') === 0)
    assert.ok(w.deco.rose.indexOf('/images/rose.png') > 0, '旧中文名应映射为 rose.png')
    assert.equal(w.deco.cake, DEFAULT.deco.cake)
  })

  it('照片无效地址按同序号默认回填，越界无效条目丢弃', () => {
    const saved = DEFAULT.photos.map((p) => ({ src: p.src, title: p.title }))
    saved[1].src = 'garbage'
    saved[1].title = '保留自定义标题'
    saved.push({ src: 'garbage2', title: '多余照片' })
    h.state.wx.setStorageSync('wedding_config', { photos: saved })
    const w = storage.getWedding()
    assert.equal(w.photos.length, DEFAULT.photos.length, '越界无效条目应被丢弃')
    assert.equal(w.photos[1].src, DEFAULT.photos[1].src, '无效照片应回填默认 src')
    assert.equal(w.photos[1].title, '保留自定义标题', '其他字段应保留')
  })

  it('timeline 缺失 en/icon 按序号回填，旧经纬度被清理', () => {
    h.state.wx.setStorageSync('wedding_config', {
      latitude: 38.5,
      longitude: 117.2,
      timeline: [
        { time: '07:30', title: '提前迎宾' },
        { time: '09:00', title: '开席' }
      ]
    })
    const w = storage.getWedding()
    assert.equal(w.latitude, undefined)
    assert.equal(w.longitude, undefined)
    assert.equal(w.timeline[0].en, DEFAULT.timeline[0].en)
    assert.equal(w.timeline[0].icon, DEFAULT.timeline[0].icon)
    assert.equal(w.timeline[0].time, '07:30')
    assert.equal(w.timeline[1].title, '开席')
  })

  it('photos/timeline 等数组字段损坏为非数组时整体回退默认', () => {
    h.state.wx.setStorageSync('wedding_config', {
      photos: 'corrupted',
      timeline: 42,
      inviteLines: { bad: true }
    })
    const w = storage.getWedding()
    assert.equal(w.photos.length, DEFAULT.photos.length)
    assert.equal(w.photos[0].src, DEFAULT.photos[0].src)
    assert.equal(w.timeline.length, DEFAULT.timeline.length)
    assert.ok(Array.isArray(w.inviteLines) && w.inviteLines.length >= 5)
  })
})

describe('utils/storage.js 白盒：云端链路与回退', () => {
  let storage
  let DEFAULT
  beforeEach(() => {
    h.reset()
    h.bootApp() // 触发 initCloud，cloudReady = true
    h.openCloudFunctions() // 注册真实云函数（未注册时 callFunction 报 not found）
    storage = require(h.ROOT + '/utils/storage.js')
    DEFAULT = storage.DEFAULT_WEDDING
  })

  it('loadWeddingAsync 优先云端文档并回写本地存档（剔除 _id）', async () => {
    const db = h.state.db
    await db.collection('wedding_config').doc('main').set({
      data: { groom: '云上新郎', bride: '云上新娘' }
    })
    const w = await storage.loadWeddingAsync()
    assert.equal(w.groom, '云上新郎')
    assert.equal(w._id, undefined)
    const saved = h.state.wx.getStorageSync('wedding_config')
    assert.equal(saved.groom, '云上新郎')
  })

  it('云端集合为空时回退本地配置', async () => {
    const w = await storage.loadWeddingAsync()
    assert.equal(w.groom, DEFAULT.groom)
  })

  it('云端读取抛错时回退本地配置', async () => {
    h.state.db.failNext('wedding_config', 'get', new Error('network down'))
    const w = await storage.loadWeddingAsync()
    assert.equal(w.groom, DEFAULT.groom)
  })

  it('loadBlessingsAsync 走云函数返回云端列表（_id 映射为 id）', async () => {
    const db = h.state.db
    await db.collection('blessings').add({
      data: { name: '张三', count: '2', message: '新婚快乐', time: '9月1日 10:00' }
    })
    const list = await storage.loadBlessingsAsync()
    assert.equal(list.length, 1)
    assert.equal(list[0].id, db.__ids('blessings')[0])
    assert.equal(list[0].name, '张三')
    assert.equal(list[0].count, '2')
  })

  it('loadBlessingsAsync 过滤已删除墓碑', async () => {
    const db = h.state.db
    const r1 = await db.collection('blessings').add({ data: { name: '甲', message: 'a' } })
    await db.collection('blessings').add({ data: { name: '乙', message: 'b' } })
    h.state.wx.setStorageSync('blessing_deleted_ids', [r1._id])
    const list = await storage.loadBlessingsAsync()
    assert.equal(list.length, 1)
    assert.equal(list[0].name, '乙')
  })

  it('云端异常为空（无清空标记）时保留本地留言防丢失', async () => {
    storage.setBlessings([{ id: 1, name: '本地留言', message: 'x' }])
    const list = await storage.loadBlessingsAsync()
    assert.equal(list.length, 1, '无清空标记的云端空列表不应清掉本地')
    assert.equal(list[0].name, '本地留言')
  })

  it('云端为空但有「已清空」标记时正常清空本地', async () => {
    h.state.wx.setStorageSync('blessing_cloud_cleared', Date.now())
    storage.setBlessings([{ id: 1, name: '旧留言', message: 'x' }])
    const list = await storage.loadBlessingsAsync()
    assert.deepEqual(list, [])
    assert.deepEqual(storage.getBlessings(), [])
  })

  it('云端非空列表正常覆盖本地', async () => {
    await h.state.db.collection('blessings').add({
      data: { name: '云端留言', count: '1', message: 'm', time: 't' }
    })
    storage.setBlessings([{ id: 1, name: '本地旧留言', message: 'x' }])
    const list = await storage.loadBlessingsAsync()
    assert.equal(list.length, 1)
    assert.equal(list[0].name, '云端留言')
  })

  it('addBlessingAsync 云端写入成功后 id 替换为 _id 并同步本地', async () => {
    const blessing = { id: 12345, name: '李四', count: '1', message: '百年好合', time: '9月2日 08:00' }
    const result = await storage.addBlessingAsync(blessing)
    assert.equal(result.cloud, true)
    const db = h.state.db
    assert.equal(db.__ids('blessings').length, 1)
    assert.equal(blessing.id, db.__ids('blessings')[0])
    assert.equal(storage.getBlessings()[0].id, db.__ids('blessings')[0])
  })

  it('云函数未部署时 loadBlessingsAsync 回退直连数据库', async () => {
    // 不注册 manageBlessings（模拟未部署），callFunction reject 后走 db 直连
    global.wx.__state.cloudFunctions = {}
    const db = h.state.db
    await db.collection('blessings').add({
      data: { name: '王五', count: '1', message: '直连写入', time: '9月3日 12:00' }
    })
    const list = await storage.loadBlessingsAsync()
    assert.equal(list.length, 1)
    assert.equal(list[0].message, '直连写入')
  })

  it('addBlessingAsync 云端写入抛错时仍保本地（cloud=false）', async () => {
    h.state.db.failNext('blessings', 'add', new Error('quota exceeded'))
    const blessing = { id: 999, name: '赵六', count: '3', message: '早生贵子', time: 't' }
    const result = await storage.addBlessingAsync(blessing)
    assert.equal(result.cloud, false)
    assert.equal(storage.getBlessings().length, 1)
  })

  it('upsertGuestAsync 新增宾客：本地数字 id 替换为云端 _id', async () => {
    const guest = { id: 777, name: '宾客甲', count: 2, status: 'confirmed', message: '', time: 't' }
    const result = await storage.upsertGuestAsync(guest)
    assert.equal(result.cloud, true)
    const db = h.state.db
    const cloudIds = db.__ids('guests')
    assert.equal(cloudIds.length, 1)
    const local = storage.getGuests()
    assert.equal(local.length, 1)
    assert.equal(local[0].id, cloudIds[0], '本地旧数字 id 应被云端 id 替换')
  })

  it('upsertGuestAsync manage=true 走云函数新增', async () => {
    const guest = { id: 888, name: '管理端新增', count: 4, status: 'pending', message: '', time: 't' }
    const result = await storage.upsertGuestAsync(guest, true)
    assert.equal(result.cloud, true)
    const local = storage.getGuests()
    assert.equal(local[0].name, '管理端新增')
    assert.equal(typeof local[0].id, 'string')
  })

  it('upsertGuestAsync 更新已有云端宾客走 update', async () => {
    const db = h.state.db
    const added = await db.collection('guests').add({
      data: { name: '原始名', count: 1, status: 'pending', message: '', time: 't' }
    })
    const local = [{ id: added._id, name: '原始名', count: 1, status: 'pending', message: '', time: 't' }]
    h.state.wx.setStorageSync('guest_list', local)
    const result = await storage.upsertGuestAsync(
      { id: added._id, name: '改名', count: 3, status: 'confirmed', message: '改', time: 't2' },
      true
    )
    assert.equal(result.cloud, true)
    const after = await db.collection('guests').doc(added._id).get()
    assert.equal(after.data.name, '改名')
    assert.equal(after.data.count, 3)
  })

  it('纯本地模式（未开通云）upsertGuestAsync 仅落本地', async () => {
    h.reset()
    h.bootApp({ noCloud: true })
    const storage2 = require(h.ROOT + '/utils/storage.js')
    const guest = { id: 111, name: '纯本地', count: 1, status: 'confirmed', message: '', time: 't' }
    const result = await storage2.upsertGuestAsync(guest)
    assert.equal(result.cloud, false)
    assert.equal(storage2.getGuests().length, 1)
  })

  it('removeGuestAsync 云函数删除成功后清墓碑', async () => {
    const db = h.state.db
    const added = await db.collection('guests').add({
      data: { name: '待删', count: 1, status: 'pending', message: '', time: 't' }
    })
    // 预置一条旧墓碑，验证成功删除后会被清除
    h.state.wx.setStorageSync('guest_deleted_ids', [added._id])
    const result = await storage.removeGuestAsync(added._id)
    assert.equal(result.cloud, true)
    assert.equal(db.__ids('guests').length, 0)
    assert.deepEqual(h.state.wx.getStorageSync('guest_deleted_ids'), [])
  })

  it('removeGuestAsync 云端删不掉时记墓碑防止复活', async () => {
    const db = h.state.db
    const added = await db.collection('guests').add({
      data: { name: '删不掉', count: 1, status: 'pending', message: '', time: 't' }
    })
    global.wx.__state.cloudFunctions = {} // 云函数不可用
    db.failNext('guests', 'doc.remove', new Error('permission denied'))
    const result = await storage.removeGuestAsync(added._id)
    assert.equal(result.cloud, false)
    const tombstones = h.state.wx.getStorageSync('guest_deleted_ids').map(String)
    assert.ok(tombstones.indexOf(added._id) >= 0, '删除失败应记录墓碑')
    const list = await storage.loadGuestsAsync()
    assert.equal(list.length, 0, '墓碑应过滤已删记录')
  })

  it('removeBlessingAsync 墓碑过滤留言', async () => {
    const db = h.state.db
    const added = await db.collection('blessings').add({
      data: { name: '留言甲', count: 1, message: 'm', time: 't' }
    })
    global.wx.__state.cloudFunctions = {}
    h.state.db.failNext('blessings', 'doc.remove', new Error('permission denied'))
    const result = await storage.removeBlessingAsync(added._id)
    assert.equal(result.cloud, false)
    assert.deepEqual(result.list, [])
    const list = await storage.loadBlessingsAsync()
    assert.equal(list.length, 0)
  })

  it('clearBlessingsAsync 走云函数清空整集合', async () => {
    const db = h.state.db
    for (let i = 0; i < 5; i++) {
      await db.collection('blessings').add({ data: { name: 'n' + i, message: 'm' } })
    }
    const result = await storage.clearBlessingsAsync()
    assert.equal(result.cloud, true)
    assert.deepEqual(result.list, [])
    const remain = await db.collection('blessings').get()
    assert.equal(remain.data.length, 0)
  })

  it('clearBlessingsAsync 云函数不可用时全部记墓碑', async () => {
    const db = h.state.db
    const ids = []
    for (let i = 0; i < 3; i++) {
      const r = await db.collection('blessings').add({
        data: { name: 'n' + i, message: 'm' }
      })
      ids.push(r._id)
    }
    // 本地同样持有这些留言（真实场景：本机先前拉取/提交过）
    storage.setBlessings(ids.map((id) => ({ id: id, name: 'n', message: 'm' })))
    global.wx.__state.cloudFunctions = {}
    const result = await storage.clearBlessingsAsync()
    assert.equal(result.cloud, false)
    const tombstones = h.state.wx.getStorageSync('blessing_deleted_ids').map(String)
    ids.forEach((id) => assert.ok(tombstones.indexOf(id) >= 0, '应记录墓碑 ' + id))
  })
})

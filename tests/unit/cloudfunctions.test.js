const { describe, it, beforeEach, assert } = require('../run.js')
const h = require('../helpers/harness.js')

describe('云函数 manageGuests', () => {
  let main
  let db
  beforeEach(() => {
    h.reset()
    main = h.loadCloudFunction('manageGuests').main
    db = h.state.db
  })

  it('首位调用者自动登记为管理员', async () => {
    h.state.openid = 'openid-A'
    const res = await main({ action: 'list' })
    assert.equal(res.ok, true)
    const doc = await db.collection('wedding_config').doc('main').get()
    assert.equal(doc.data.adminOpenId, 'openid-A')
  })

  it('非管理员被拒绝操作', async () => {
    h.state.openid = 'openid-A'
    await main({ action: 'list' }) // A 注册为管理员
    h.state.openid = 'openid-B'
    const res = await main({ action: 'list' })
    assert.equal(res.ok, false)
    assert.ok(String(res.error).indexOf('管理员') >= 0)
  })

  it('list/add/update/remove 全链路', async () => {
    h.state.openid = 'openid-A'
    const add1 = await main({
      action: 'add',
      guest: { name: '张三', count: 2, status: 'confirmed', message: '带家属' }
    })
    assert.equal(add1.ok, true)
    const add2 = await main({ action: 'add', guest: { name: '李四' } })
    const list1 = await main({ action: 'list' })
    assert.equal(list1.list.length, 2)
    // 缺省字段补全：count=1、status=pending
    const lid = add2.id
    const raw2 = await db.collection('guests').doc(lid).get()
    assert.equal(raw2.data.count, 1)
    assert.equal(raw2.data.status, 'pending')

    const upd = await main({
      action: 'update',
      id: add1.id,
      guest: { name: '张三丰', count: 3, status: 'declined', message: '来不了' }
    })
    assert.equal(upd.ok, true)
    const raw1 = await db.collection('guests').doc(add1.id).get()
    assert.equal(raw1.data.name, '张三丰')
    assert.equal(raw1.data.count, 3)

    const rm = await main({ action: 'remove', id: add1.id })
    assert.equal(rm.ok, true)
    const list2 = await main({ action: 'list' })
    assert.equal(list2.list.length, 1)
    assert.equal(list2.list[0].name, '李四')
  })

  it('clear 清空全部宾客', async () => {
    h.state.openid = 'openid-A'
    for (let i = 0; i < 5; i++) {
      await main({ action: 'add', guest: { name: '客' + i } })
    }
    const res = await main({ action: 'clear' })
    assert.equal(res.ok, true)
    const list = await main({ action: 'list' })
    assert.equal(list.list.length, 0)
  })

  it('未知 action 返回错误信息', async () => {
    h.state.openid = 'openid-A'
    const res = await main({ action: 'hack' })
    assert.equal(res.ok, false)
    assert.ok(String(res.error).indexOf('未知操作') === 0)
  })

  it('数据库异常时返回 ok:false 而不是抛出', async () => {
    h.state.openid = 'openid-A'
    db.failNext('guests', 'add', new Error('storage full'))
    const res = await main({ action: 'add', guest: { name: 'x' } })
    assert.equal(res.ok, false)
    assert.ok(String(res.error).indexOf('storage full') >= 0)
  })
})

describe('云函数 manageConfig', () => {
  let main
  let db
  beforeEach(() => {
    h.reset()
    main = h.loadCloudFunction('manageConfig').main
    db = h.state.db
  })

  it('管理员 clear 删除 wedding_config.main 文档', async () => {
    h.state.openid = 'openid-A'
    await db.collection('wedding_config').doc('main').set({
      data: { groom: '云上新郎', adminOpenId: 'openid-A' }
    })
    const res = await main({ action: 'clear' })
    assert.equal(res.ok, true)
    let gone = false
    try {
      await db.collection('wedding_config').doc('main').get()
    } catch (e) {
      gone = true
    }
    assert.ok(gone, 'clear 后文档应不存在')
  })

  it('文档不存在时 clear 也返回成功', async () => {
    h.state.openid = 'openid-A'
    const res = await main({ action: 'clear' })
    assert.equal(res.ok, true)
  })

  it('非管理员 clear 被拒绝', async () => {
    h.state.openid = 'openid-A'
    await main({ action: 'clear' }) // A 首调登记为管理员
    h.state.openid = 'openid-B'
    await db.collection('wedding_config').doc('main').set({
      data: { groom: 'x', adminOpenId: 'openid-A' }
    })
    const res = await main({ action: 'clear' })
    assert.equal(res.ok, false)
    const doc = await db.collection('wedding_config').doc('main').get()
    assert.equal(doc.data.groom, 'x', '拒绝后配置不应被删')
  })

  it('未知 action 返回错误信息', async () => {
    h.state.openid = 'openid-A'
    const res = await main({ action: 'what' })
    assert.equal(res.ok, false)
    assert.ok(String(res.error).indexOf('未知操作') === 0)
  })
})

describe('云函数 manageBlessings', () => {
  let main
  let db
  beforeEach(() => {
    h.reset()
    main = h.loadCloudFunction('manageBlessings').main
    db = h.state.db
  })

  async function seedAdmin() {
    h.state.openid = 'openid-A'
    await db.collection('wedding_config').doc('main').set({ data: { adminOpenId: 'openid-A' } })
  }

  it('update 修改留言并保留未提交字段', async () => {
    await seedAdmin()
    const added = await db.collection('blessings').add({
      data: { name: '王五', count: 2, message: '原始', time: '9月1日 10:00' }
    })
    const res = await main({
      action: 'update',
      id: added._id,
      blessing: { name: '王五改', count: 5, message: '改过', time: '9月2日 11:00' }
    })
    assert.equal(res.ok, true)
    const after = await db.collection('blessings').doc(added._id).get()
    assert.equal(after.data.name, '王五改')
    assert.equal(after.data.count, 5)
    assert.equal(after.data.time, '9月2日 11:00')
  })

  it('remove 删除指定留言', async () => {
    await seedAdmin()
    const added = await db.collection('blessings').add({
      data: { name: '赵六', count: 1, message: 'm', time: 't' }
    })
    const res = await main({ action: 'remove', id: added._id })
    assert.equal(res.ok, true)
    const remain = await db.collection('blessings').get()
    assert.equal(remain.data.length, 0)
  })

  it('clear 分批清空 250 条留言并写入 clearedAt 标记', async () => {
    await seedAdmin()
    for (let i = 0; i < 250; i++) {
      await db.collection('blessings').add({ data: { name: 'n' + i, count: 1, message: 'm' } })
    }
    const res = await main({ action: 'clear' })
    assert.equal(res.ok, true)
    const remain = await db.collection('blessings').get()
    assert.equal(remain.data.length, 0)
    // 清空事件标记落库，供其他设备同步清空本地缓存
    assert.ok(res.clearedAt > 0, 'clear 应返回 clearedAt')
    const marker = await db.collection('wedding_config').doc('blessings_cleared').get()
    assert.equal(marker.data.clearedAt, res.clearedAt)
  })

  it('list 返回清空标记 clearedAt（无标记时为 0）', async () => {
    await seedAdmin()
    const res1 = await main({ action: 'list' })
    assert.equal(res1.clearedAt, 0, '从未清空过应为 0')
    await db.collection('wedding_config').doc('blessings_cleared').set({ data: { clearedAt: 12345 } })
    const res2 = await main({ action: 'list' })
    assert.equal(res2.clearedAt, 12345)
  })

  it('非管理员 clear 被拒绝', async () => {
    await seedAdmin()
    await db.collection('blessings').add({ data: { name: 'x', count: 1, message: 'm' } })
    h.state.openid = 'openid-B'
    const res = await main({ action: 'clear' })
    assert.equal(res.ok, false)
    const remain = await db.collection('blessings').get()
    assert.equal(remain.data.length, 1, '拒绝后不应删数据')
  })

  it('未知 action 返回错误信息', async () => {
    await seedAdmin()
    const res = await main({ action: 'nope' })
    assert.equal(res.ok, false)
    assert.ok(String(res.error).indexOf('未知操作') === 0)
  })
})

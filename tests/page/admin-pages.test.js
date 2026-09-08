const { describe, it, beforeEach, afterEach, assert } = require('../run.js')
const h = require('../helpers/harness.js')

describe('pages/admin/home 黑盒：数据聚合', () => {
  let page
  beforeEach(() => {
    h.reset()
    h.openCloudFunctions()
  })
  afterEach(() => {
    if (page && page.onUnload) page.onUnload()
    page = null
  })

  function boot() {
    h.bootApp()
    page = h.loadPage('pages/admin/home/home.js')
  }

  it('汇总宾客人数（含缺省 count 按 1 计）与留言数', async () => {
    boot()
    const db = h.state.db
    await db.collection('guests').add({ data: { name: 'a', count: 2, status: 'confirmed', message: '', time: 't' } })
    await db.collection('guests').add({ data: { name: 'b', count: 3, status: 'pending', message: '', time: 't' } })
    await db.collection('guests').add({ data: { name: 'c', status: 'pending', message: '', time: 't' } })
    await db.collection('blessings').add({ data: { name: 'x', count: 1, message: 'm', time: 't' } })
    await db.collection('blessings').add({ data: { name: 'y', count: 1, message: 'm', time: 't' } })
    await page.refresh()
    assert.equal(page.data.guestCount, 3)
    assert.equal(page.data.guestTotal, 6, 'count 缺省应按 1 计：2+3+1')
    assert.equal(page.data.blessingCount, 2)
    assert.equal(page.data.cloudReady, true)
  })

  it('本地模式统计纯本地宾客', async () => {
    h.bootApp({ noCloud: true })
    page = h.loadPage('pages/admin/home/home.js')
    h.state.wx.setStorageSync('guest_list', [
      { id: 1, name: 'a', count: 4, status: 'confirmed', message: '', time: 't' }
    ])
    await page.refresh()
    assert.equal(page.data.guestCount, 1)
    assert.equal(page.data.guestTotal, 4)
    assert.equal(page.data.cloudReady, false)
  })

  it('管理页入口跳转地址正确', async () => {
    boot()
    page.goEdit()
    page.goGuests()
    page.goBlessings()
    assert.deepEqual(h.state.wx.__state.navigations, [
      '/pages/admin/edit/edit',
      '/pages/admin/guests/guests',
      '/pages/admin/blessings/blessings'
    ])
  })
})

describe('pages/admin/edit 黑盒：配置编辑', () => {
  let page
  beforeEach(() => {
    h.reset()
    h.openCloudFunctions()
    h.bootApp()
  })
  afterEach(() => {
    if (page && page.onUnload) page.onUnload()
    page = null
  })

  function boot() {
    page = h.loadPage('pages/admin/edit/edit.js')
  }

  it('loadForm 回填当前配置', async () => {
    boot()
    await page.loadForm()
    assert.equal(page.data.form.groom, '刘浩宇')
    assert.equal(page.data.form.weddingDate, '2026-09-29 08:30:00')
    assert.ok(page.data.form.musicSrc.indexOf('https://') === 0)
  })

  it('onInput 按字段名写入表单', async () => {
    boot()
    await page.loadForm()
    page.onInput({ currentTarget: { dataset: { field: 'groom' } }, detail: { value: '新郎改' } })
    page.onInput({ currentTarget: { dataset: { field: 'venueHall' } }, detail: { value: '六楼' } })
    assert.equal(page.data.form.groom, '新郎改')
    assert.equal(page.data.form.venueHall, '六楼')
  })

  it('saveForm 持久化到本地并同步云端', async () => {
    boot()
    await page.loadForm()
    page.onInput({ currentTarget: { dataset: { field: 'bride' } }, detail: { value: '新娘改' } })
    await page.saveForm()
    const saved = h.state.wx.getStorageSync('wedding_config')
    assert.equal(saved.bride, '新娘改')
    const doc = await h.state.db.collection('wedding_config').doc('main').get()
    assert.equal(doc.data.bride, '新娘改')
    assert.ok(h.state.wx.__state.toasts.some((t) => t.title === '已同步云端'))
  })

  it('resetForm 确认后清除本地存档（纯本地模式回默认）', async () => {
    h.reset()
    h.bootApp({ noCloud: true })
    boot()
    await page.loadForm()
    page.onInput({ currentTarget: { dataset: { field: 'groom' } }, detail: { value: '临时名' } })
    await page.saveForm()
    h.state.wx.__state.nextModalConfirm = true
    page.resetForm()
    await h.waitFor(() => page.data.form.groom === '刘浩宇')
    assert.equal(page.data.form.groom, '刘浩宇', '无云端时重置应恢复默认')
  })

  it('云端模式下 resetForm 同步删除云端配置，真正恢复默认', async () => {
    boot()
    await page.loadForm()
    page.onInput({ currentTarget: { dataset: { field: 'groom' } }, detail: { value: '临时名' } })
    await page.saveForm() // 本地 + 云端都写入「临时名」
    h.state.wx.__state.nextModalConfirm = true
    page.resetForm()
    await h.waitFor(() => page.data.form.groom === '刘浩宇')
    assert.equal(page.data.form.groom, '刘浩宇', '云端文档删除后表单应回默认')
    let deleted = false
    try {
      await h.state.db.collection('wedding_config').doc('main').get()
    } catch (e) {
      deleted = true
    }
    assert.ok(deleted, '云端 doc 应已删除（读取应抛 not exists）')
  })

  it('resetForm 取消则不动存档', async () => {
    boot()
    await page.loadForm()
    h.state.wx.__state.nextModalConfirm = false
    page.resetForm()
    await h.sleep(20)
    assert.ok(h.state.wx.__state.modals.some((m) => m.title === '确认恢复默认？'))
  })
})

describe('pages/admin/guests 黑盒：名单增删改', () => {
  let page
  beforeEach(() => {
    h.reset()
    h.openCloudFunctions()
  })
  afterEach(() => {
    if (page && page.onUnload) page.onUnload()
    page = null
  })

  function boot() {
    page = h.loadPage('pages/admin/guests/guests.js')
  }

  it('openAdd 重置表单为默认值', async () => {
    h.bootApp()
    boot()
    await page.refresh()
    page.openAdd()
    assert.equal(page.data.showForm, true)
    assert.equal(page.data.editingId, 0)
    assert.equal(page.data.form.count, '1')
    assert.equal(page.data.form.status, 'pending')
  })

  it('saveGuest 空姓名被拦截', async () => {
    h.bootApp()
    boot()
    await page.refresh()
    page.openAdd()
    await page.saveGuest()
    assert.ok(h.state.wx.__state.toasts.some((t) => t.title === '请填写姓名'))
    assert.equal(page.data.showForm, true, '弹层不应关闭')
  })

  it('saveGuest 新增走云函数并刷新列表', async () => {
    h.bootApp()
    boot()
    await page.refresh()
    page.openAdd()
    page.onFormInput({ currentTarget: { dataset: { field: 'name' } }, detail: { value: '王五' } })
    page.onFormInput({ currentTarget: { dataset: { field: 'count' } }, detail: { value: '3' } })
    await page.saveGuest()
    assert.equal(page.data.showForm, false)
    const dbGuests = await h.state.db.collection('guests').get()
    assert.equal(dbGuests.data.length, 1)
    assert.equal(dbGuests.data[0].name, '王五')
    assert.equal(dbGuests.data[0].count, 3)
    assert.ok(h.state.wx.__state.toasts.some((t) => t.title === '已同步云端'))
  })

  it('openEdit 以字符串 id 匹配数字 id 记录并回填', async () => {
    h.bootApp({ noCloud: true }) // 纯本地数字 id 场景
    boot()
    h.state.wx.setStorageSync('guest_list', [
      { id: 42, name: '数字哥', count: 2, status: 'confirmed', message: '带人', time: '9月1日 10:00' }
    ])
    await page.refresh()
    page.openEdit({ currentTarget: { dataset: { id: '42' } } })
    assert.equal(page.data.editingId, '42')
    assert.equal(page.data.form.name, '数字哥')
    assert.equal(page.data.form.count, '2')
    assert.equal(page.data.statusIndex, 1, '已确认应映射到选项下标 1')
  })

  it('saveGuest 编辑更新既有记录', async () => {
    h.bootApp()
    boot()
    const db = h.state.db
    const added = await db.collection('guests').add({
      data: { name: '原始', count: 1, status: 'pending', message: '', time: 't' }
    })
    h.state.wx.setStorageSync('guest_list', [
      { id: added._id, name: '原始', count: 1, status: 'pending', message: '', time: 't' }
    ])
    await page.refresh()
    page.openEdit({ currentTarget: { dataset: { id: added._id } } })
    page.onFormInput({ currentTarget: { dataset: { field: 'name' } }, detail: { value: '改名' } })
    await page.saveGuest()
    const after = await db.collection('guests').doc(added._id).get()
    assert.equal(after.data.name, '改名')
  })

  it('clearAll 确认后云端与本地宾客全部清空', async () => {
    h.bootApp()
    boot()
    const db = h.state.db
    await db.collection('guests').add({ data: { name: 'a', count: 2, status: 'confirmed', message: '', time: 't' } })
    await db.collection('guests').add({ data: { name: 'b', count: 1, status: 'pending', message: '', time: 't' } })
    await page.refresh()
    assert.equal(page.data.guests.length, 2)
    h.state.wx.__state.nextModalConfirm = true
    page.clearAll()
    await h.sleep(40)
    const remain = await db.collection('guests').get()
    assert.equal(remain.data.length, 0)
    assert.equal(page.data.guests.length, 0)
    assert.equal(page.data.totalCount, 0)
    assert.ok(h.state.wx.__state.toasts.some((t) => t.title === '已清空云端'))
  })

  it('clearAll 取消则不动名单', async () => {
    h.bootApp({ noCloud: true })
    boot()
    h.state.wx.setStorageSync('guest_list', [
      { id: 1, name: '留下', count: 1, status: 'pending', message: '', time: 't' }
    ])
    await page.refresh()
    h.state.wx.__state.nextModalConfirm = false
    page.clearAll()
    await h.sleep(20)
    assert.ok(h.state.wx.__state.modals.some((m) => m.title === '确认清空全部宾客？'))
    assert.equal(page.data.guests.length, 1)
  })

  it('removeGuest 确认后删除云端与本机记录', async () => {
    h.bootApp()
    boot()
    const db = h.state.db
    const added = await db.collection('guests').add({
      data: { name: '待删', count: 1, status: 'pending', message: '', time: 't' }
    })
    h.state.wx.setStorageSync('guest_list', [
      { id: added._id, name: '待删', count: 1, status: 'pending', message: '', time: 't' }
    ])
    await page.refresh()
    h.state.wx.__state.nextModalConfirm = true
    page.removeGuest({ currentTarget: { dataset: { id: added._id } } })
    await h.sleep(40)
    const remain = await db.collection('guests').get()
    assert.equal(remain.data.length, 0)
    assert.equal(page.data.guests.length, 0)
  })

  it('removeGuest 取消则不删除', async () => {
    h.bootApp({ noCloud: true }) // 纯本地记录场景
    boot()
    h.state.wx.setStorageSync('guest_list', [
      { id: 7, name: '留下', count: 1, status: 'pending', message: '', time: 't' }
    ])
    await page.refresh()
    h.state.wx.__state.nextModalConfirm = false
    page.removeGuest({ currentTarget: { dataset: { id: '7' } } })
    await h.sleep(20)
    assert.equal(page.data.guests.length, 1)
  })
})

describe('pages/admin/blessings 黑盒：留言改删清空', () => {
  let page
  beforeEach(() => {
    h.reset()
    h.openCloudFunctions()
  })
  afterEach(() => {
    if (page && page.onUnload) page.onUnload()
    page = null
  })

  function boot() {
    page = h.loadPage('pages/admin/blessings/blessings.js')
  }

  it('openEdit 回填内容并保留原提交时间', async () => {
    h.bootApp({ noCloud: true }) // 纯本地留言场景
    boot()
    h.state.wx.setStorageSync('blessings', [
      { id: 'c0000000000000000001', name: '甲', count: 2, message: '原文', time: '9月1日 10:00' }
    ])
    await page.refresh()
    page.openEdit({ currentTarget: { dataset: { id: 'c0000000000000000001' } } })
    assert.equal(page.data.form.name, '甲')
    assert.equal(page.data.form.time, '9月1日 10:00', '编辑应保留原提交时间')
  })

  it('saveBlessing 姓名与内容必填', async () => {
    h.bootApp()
    boot()
    await page.refresh()
    page.onFormInput({ currentTarget: { dataset: { field: 'name' } }, detail: { value: '' } })
    await page.saveBlessing()
    assert.ok(h.state.wx.__state.toasts.some((t) => t.title === '请填写姓名'))
    page.onFormInput({ currentTarget: { dataset: { field: 'name' } }, detail: { value: '乙' } })
    await page.saveBlessing()
    assert.ok(h.state.wx.__state.toasts.some((t) => t.title === '请填写留言内容'))
  })

  it('saveBlessing 编辑走云函数更新', async () => {
    h.bootApp()
    boot()
    const db = h.state.db
    const added = await db.collection('blessings').add({
      data: { name: '丙', count: 1, message: '原', time: '9月1日 09:00' }
    })
    h.state.wx.setStorageSync('blessings', [
      { id: added._id, name: '丙', count: 1, message: '原', time: '9月1日 09:00' }
    ])
    await page.refresh()
    page.openEdit({ currentTarget: { dataset: { id: added._id } } })
    page.onFormInput({ currentTarget: { dataset: { field: 'message' } }, detail: { value: '改好的祝福' } })
    await page.saveBlessing()
    const after = await db.collection('blessings').doc(added._id).get()
    assert.equal(after.data.message, '改好的祝福')
    assert.equal(after.data.time, '9月1日 09:00', '时间不应被改掉')
    assert.ok(h.state.wx.__state.toasts.some((t) => t.title === '已同步云端'))
  })

  it('removeBlessing 确认后删除', async () => {
    h.bootApp()
    boot()
    const db = h.state.db
    const added = await db.collection('blessings').add({
      data: { name: '丁', count: 1, message: 'm', time: 't' }
    })
    h.state.wx.setStorageSync('blessings', [
      { id: added._id, name: '丁', count: 1, message: 'm', time: 't' }
    ])
    await page.refresh()
    h.state.wx.__state.nextModalConfirm = true
    page.removeBlessing({ currentTarget: { dataset: { id: added._id } } })
    await h.sleep(40)
    const remain = await db.collection('blessings').get()
    assert.equal(remain.data.length, 0)
  })

  it('弹层「清空」按钮一键清空全部表单内容', async () => {
    h.bootApp({ noCloud: true })
    boot()
    h.state.wx.setStorageSync('blessings', [
      { id: 1, name: '甲', count: 2, message: '原文', time: '9月1日 10:00' }
    ])
    await page.refresh()
    page.openEdit({ currentTarget: { dataset: { id: 1 } } })
    page.onFormInput({ currentTarget: { dataset: { field: 'name' } }, detail: { value: '改过的名字' } })
    page.clearForm()
    assert.equal(page.data.form.name, '', '姓名应被清空')
    assert.equal(page.data.form.count, '', '人数应被清空')
    assert.equal(page.data.form.message, '', '留言内容应被清空')
    assert.equal(page.data.form.time, '9月1日 10:00', '原提交时间保留供保存沿用')
  })

  it('clearAll 确认后云端清空且本地为空', async () => {
    h.bootApp()
    boot()
    const db = h.state.db
    await db.collection('blessings').add({ data: { name: 'e', count: 1, message: 'm', time: 't' } })
    await page.refresh()
    h.state.wx.__state.nextModalConfirm = true
    page.clearAll()
    await h.sleep(40)
    const remain = await db.collection('blessings').get()
    assert.equal(remain.data.length, 0)
    assert.equal(page.data.blessings.length, 0)
    assert.ok(h.state.wx.__state.toasts.some((t) => t.title === '已清空云端'))
  })
})

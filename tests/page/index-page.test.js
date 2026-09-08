const { describe, it, beforeEach, afterEach, assert } = require('../run.js')
const h = require('../helpers/harness.js')

describe('pages/index 黑盒：启动与倒计时', () => {
  let page
  beforeEach(() => {
    h.reset()
  })
  afterEach(() => {
    if (page && page.onUnload) page.onUnload()
    page = null
  })

  it('启动后配置加载、倒计时启动、自动播放音乐、祝福墙就绪', async () => {
    page = h.launchIndexPage()
    await h.sleep(60)
    assert.equal(page.data.wedding.groom, '刘浩宇')
    assert.ok(page.countdownTimer, '倒计时定时器应已启动')
    assert.equal(page.data.musicOn, true)
    assert.equal(page.data.blessingsLoading, false)
    const audio = h.state.wx.__state.audioInstances
    assert.equal(audio.length, 1)
    assert.deepEqual(audio[0].calls, ['play'])
  })

  it('倒计时按剩余时间逐位补零显示（冻结时钟消除抖动）', async () => {
    page = h.launchIndexPage()
    await h.sleep(40)
    const ms = (1 * 86400 + 2 * 3600 + 3 * 60 + 4) * 1000
    let frozen = Date.now()
    frozen = frozen - (frozen % 1000) // 取整到整秒，避免字符串化丢毫秒导致差值不足
    const RealDate = Date
    function MockDate(...args) {
      if (args.length === 0) return new RealDate(frozen)
      return new RealDate(...args)
    }
    MockDate.now = () => frozen
    MockDate.prototype = RealDate.prototype
    global.Date = MockDate
    try {
      const target = new RealDate(frozen + ms)
      const p2 = (n) => (n < 10 ? '0' + n : '' + n)
      const str =
        target.getFullYear() + '-' + p2(target.getMonth() + 1) + '-' + p2(target.getDate()) +
        ' ' + p2(target.getHours()) + ':' + p2(target.getMinutes()) + ':' + p2(target.getSeconds())
      page.setData({ wedding: Object.assign({}, page.data.wedding, { weddingDate: str }) })
      page.updateCountdown()
    } finally {
      global.Date = RealDate
    }
    assert.equal(page.data.days, '01')
    assert.equal(page.data.hours, '02')
    assert.equal(page.data.minutes, '03')
    assert.equal(page.data.seconds, '04')
    assert.equal(page.data.isWeddingDay, false)
  })

  it('婚期已过：清零并切换「今天我们结婚啦」', async () => {
    page = h.launchIndexPage()
    await h.sleep(40)
    page.setData({ wedding: Object.assign({}, page.data.wedding, { weddingDate: '2020-01-01 08:30:00' }) })
    page.updateCountdown()
    assert.equal(page.data.days, '00')
    assert.equal(page.data.seconds, '00')
    assert.equal(page.data.isWeddingDay, true)
    page.updateCountdown()
    assert.equal(page.data.isWeddingDay, true, '重复调用保持已到状态')
  })

  it('缺少婚期时倒计时保持原值、不报错', async () => {
    page = h.launchIndexPage()
    await h.sleep(40)
    // 启动时 startCountdown 已用默认婚期（2026-09-29）算过一次
    const daysBefore = page.data.days
    assert.ok(daysBefore !== '00', '启动首算应得到真实剩余天数: ' + daysBefore)
    page.setData({ wedding: { groom: 'x' } })
    page.updateCountdown()
    assert.equal(page.data.days, daysBefore, '无婚期时不应改动倒计时')
    assert.equal(page.data.isWeddingDay, false)
  })
})

describe('pages/index 黑盒：祝福提交与祝福墙', () => {
  let page
  beforeEach(() => {
    h.reset()
  })
  afterEach(() => {
    if (page && page.onUnload) page.onUnload()
    page = null
  })

  it('空姓名提交被拦截并提示', async () => {
    page = h.launchIndexPage({ noCloud: true })
    await h.sleep(40)
    page.onMessageInput({ detail: { value: '只有留言' } })
    await page.submitBlessing()
    const toasts = h.state.wx.__state.toasts
    assert.ok(toasts.some((t) => t.title === '请输入您的姓名'))
    assert.equal(page.data.blessings.length, 0)
  })

  it('空留言提交被拦截并提示', async () => {
    page = h.launchIndexPage({ noCloud: true })
    await h.sleep(40)
    page.onNameInput({ detail: { value: '张三' } })
    await page.submitBlessing()
    assert.ok(h.state.wx.__state.toasts.some((t) => t.title === '请写下您的祝福'))
    assert.equal(page.data.blessings.length, 0)
  })

  it('合法提交：本地保存祝福、自动登记宾客、清空表单', async () => {
    page = h.launchIndexPage({ noCloud: true })
    await h.sleep(40)
    page.onNameInput({ detail: { value: '  张三  ' } })
    page.onCountInput({ detail: { value: '2' } })
    page.onMessageInput({ detail: { value: ' 新婚快乐 ' } })
    await page.submitBlessing()
    assert.equal(page.data.blessings.length, 1)
    assert.equal(page.data.blessings[0].name, '张三')
    assert.equal(page.data.blessings[0].message, '新婚快乐')
    assert.equal(page.data.latestBlessingId, page.data.blessings[0].id)
    assert.deepEqual(page.data.formData, { name: '', count: '', message: '' })
    assert.ok(h.state.wx.__state.toasts.some((t) => t.title === '祝福已持久保存'))
    // 宾客自动登记
    const guests = h.state.wx.getStorageSync('guest_list')
    assert.equal(guests.length, 1)
    assert.equal(guests[0].name, '张三')
    assert.equal(guests[0].count, 2)
    assert.equal(guests[0].status, 'confirmed')
  })

  it('云端可用时提交同步云数据库并登记宾客', async () => {
    h.openCloudFunctions()
    page = h.launchIndexPage()
    await h.sleep(60)
    page.onNameInput({ detail: { value: '李四' } })
    page.onMessageInput({ detail: { value: '百年好合' } })
    await page.submitBlessing()
    assert.equal(page.data.cloudTip, '已同步云数据库')
    const db = h.state.db
    const bless = await db.collection('blessings').get()
    assert.equal(bless.data.length, 1)
    assert.equal(bless.data[0].name, '李四')
    const guests = await db.collection('guests').get()
    assert.equal(guests.data.length, 1)
    assert.equal(guests.data[0].name, '李四')
    assert.ok(h.state.wx.__state.toasts.some((t) => t.title === '祝福已保存到云端'))
  })

  it('提交期间连点只生效一次（防重复提交）', async () => {
    page = h.launchIndexPage({ noCloud: true })
    await h.sleep(40)
    page.onNameInput({ detail: { value: '王五' } })
    page.onMessageInput({ detail: { value: '永结同心' } })
    // 不 await 首次提交，模拟快速连点：第二次进入时首次仍在进行
    const first = page.submitBlessing()
    const second = page.submitBlessing()
    await Promise.all([first, second])
    assert.equal(page.data.blessings.length, 1, '连点只应产生一条祝福')
    assert.equal(h.state.wx.getStorageSync('guest_list').length, 1, '宾客也只登记一次')
  })

  it('后台清空留言后回前台，留言展示区同步清空', async () => {
    h.openCloudFunctions()
    page = h.launchIndexPage()
    await h.sleep(60)
    const storage = require(h.ROOT + '/utils/storage.js')
    // 本机先前拉取过 2 条留言并在祝福墙展示
    storage.setBlessings([
      { id: 'c0000000000000000001', name: '甲', count: 1, message: 'a', time: 't' },
      { id: 'c0000000000000000002', name: '乙', count: 1, message: 'b', time: 't' }
    ])
    page.applyBlessings(storage.getBlessings())
    assert.equal(page.data.blessings.length, 2)
    // 后台（另一台设备）清空云端：云函数落 clearedAt 标记
    const cleared = await h.state.wx.__state.cloudFunctions.manageBlessings({ action: 'clear' })
    assert.ok(cleared.clearedAt > 0, 'clear 应返回 clearedAt')
    // 回前台 onShow 重拉：云端标记比本机新 → 本机缓存一并清掉，墙跟着变
    page.onShow()
    await h.waitFor(() => page.data.blessings.length === 0)
    assert.deepEqual(storage.getBlessings(), [], '本机留言缓存应同步清空')
    assert.equal(
      h.state.wx.getStorageSync('blessing_cloud_cleared'),
      cleared.clearedAt,
      '本机应记住云端清空时间，避免重复触发'
    )
  })

  it('祝福墙 3 条以内不循环，位移归零', async () => {
    page = h.launchIndexPage({ noCloud: true })
    await h.sleep(40)
    const list = [1, 2, 3].map((i) => ({ id: i, name: 'n' + i, message: 'm' }))
    page.applyBlessings(list)
    assert.equal(page.data.wallLoop, false)
    assert.equal(page.data.wallList.length, 3)
    assert.equal(page.data.wallShift, 0)
  })

  it('祝福墙超过 3 条翻倍循环且 key 唯一', async () => {
    page = h.launchIndexPage({ noCloud: true })
    await h.sleep(40)
    const list = [1, 2, 3, 4].map((i) => ({ id: i, name: 'n' + i, message: 'm' }))
    // exec 结果层级：[exec 次序][查询调用次序] —— selectAll 单调用返回 rect 数组
    page.__queryResults = [[[
      { top: 0 }, { top: 10 }, { top: 20 }, { top: 30 }, { top: 40 }, { top: 50 }
    ]]]
    page.applyBlessings(list)
    assert.equal(page.data.wallLoop, true)
    assert.equal(page.data.wallList.length, 8)
    const keys = page.data.wallList.map((w) => w._k)
    assert.equal(new Set(keys).size, 8, '翻倍后 key 仍应唯一')
    await h.sleep(120)
    assert.equal(page.data.wallShift, 30)
    assert.equal(page.data.wallDuration, 10, '位移 30px，时长应取下限 10s')
  })
})

describe('pages/index 黑盒：背景音乐与后台暗门', () => {
  let page
  beforeEach(() => {
    h.reset()
  })
  afterEach(() => {
    if (page && page.onUnload) page.onUnload()
    page = null
  })

  it('无音乐地址时点击提示上传', async () => {
    page = h.launchIndexPage({ noCloud: true })
    await h.sleep(40)
    page.setData({ wedding: Object.assign({}, page.data.wedding, { musicSrc: '' }) })
    page.onToggleMusic()
    assert.ok(h.state.wx.__state.toasts.some((t) => t.title === '请先上传背景音乐'))
  })

  it('点击开启音乐后按钮点亮', async () => {
    page = h.launchIndexPage({ noCloud: true })
    await h.sleep(40)
    page.setData({ musicOn: false })
    page.onToggleMusic()
    assert.equal(page.data.musicOn, true)
    const audio = h.state.wx.__state.audioInstances
    assert.ok(audio[0].calls.indexOf('play') >= 0)
  })

  it('播放中再点一次关闭并提示', async () => {
    page = h.launchIndexPage({ noCloud: true })
    await h.sleep(40)
    const audio = h.state.wx.__state.audioInstances[0]
    audio.emit('play') // 真机开始播放后 isPlaying = true
    page.onToggleMusic()
    assert.equal(page.data.musicOn, false)
    assert.ok(audio.calls.indexOf('pause') >= 0)
    assert.ok(h.state.wx.__state.toasts.some((t) => t.title === '已关闭音乐'))
  })

  it('【回归】音乐加载失败只回正按钮状态，不再弹失败提示', async () => {
    page = h.launchIndexPage({ noCloud: true })
    await h.sleep(40)
    page.setData({ musicOn: false })
    page.onToggleMusic() // 开启但音频从不真正 onPlay（模拟资源缺失/网络失败）
    assert.equal(page.data.musicOn, true)
    await h.sleep(880)
    assert.equal(page.data.musicOn, false, '未真正播放应回正为关')
    const failureToasts = h.state.wx.__state.toasts.filter((t) => String(t.title).indexOf('失败') >= 0)
    assert.equal(failureToasts.length, 0, '不应出现「加载失败」弹窗')
  })

  it('3 秒内连点 5 次进入管理后台', async () => {
    page = h.launchIndexPage({ noCloud: true })
    await h.sleep(40)
    for (let i = 0; i < 5; i++) page.onToggleMusic()
    assert.deepEqual(h.state.wx.__state.navigations, ['/pages/admin/home/home'])
  })

  it('连点不足 5 次不进后台', async () => {
    page = h.launchIndexPage({ noCloud: true })
    await h.sleep(40)
    for (let i = 0; i < 4; i++) page.onToggleMusic()
    assert.equal(h.state.wx.__state.navigations.length, 0)
  })

  it('冷启动被拦截后首次触摸补播音乐', async () => {
    page = h.launchIndexPage({ noCloud: true })
    await h.sleep(700) // 等 600ms 核查定时器把 _musicBlocked 置位
    const audio = h.state.wx.__state.audioInstances[0]
    assert.deepEqual(audio.calls, ['play'])
    page.onRootTouchStart()
    assert.deepEqual(audio.calls, ['play', 'play'], '首次触摸应补播')
    await h.sleep(880)
    assert.equal(page.data.musicOn, false, '补播仍失败则按钮回正')
  })
})

describe('pages/index 黑盒：翻页、手势与分享', () => {
  let page
  beforeEach(() => {
    h.reset()
  })
  afterEach(() => {
    if (page && page.onUnload) page.onUnload()
    page = null
  })

  it('goPage 越界与原地跳转被忽略', async () => {
    page = h.launchIndexPage({ noCloud: true })
    await h.sleep(40)
    page.goPage(-1)
    page.goPage(5)
    page.goPage(0)
    assert.equal(page.data.current, 0)
    page.goPage(3)
    assert.equal(page.data.current, 3)
  })

  it('翻页后 240ms 点亮当前页入场动画，离开相册页暂停胶片', async () => {
    page = h.launchIndexPage({ noCloud: true })
    await h.sleep(40)
    page.onPageChange({ detail: { current: 2 } })
    assert.equal(page.data.current, 2)
    assert.equal(page.data.filmAutoplay, true)
    assert.equal(page.data.revealed.photos, false)
    await h.sleep(280)
    assert.equal(page.data.revealed.photos, true)
    page.onPageChange({ detail: { current: 0 } })
    assert.equal(page.data.filmAutoplay, false)
    await h.sleep(280)
    assert.equal(page.data.revealed.hero, true)
    assert.equal(page.data.revealed.photos, false, '离开页面应复位入场动画')
  })

  it('胶片触摸暂停，3 秒无操作后恢复；翻页取消恢复', async () => {
    page = h.launchIndexPage({ noCloud: true })
    await h.sleep(40)
    page.onPageChange({ detail: { current: 2 } })
    page.onFilmTouchStart()
    assert.equal(page.data.filmAutoplay, false)
    page.onFilmTouchEnd()
    await h.sleep(3150)
    assert.equal(page.data.filmAutoplay, true, '3 秒后应恢复自动上滑')
    page.onFilmTouchStart()
    page.onFilmTouchEnd()
    page.onPageChange({ detail: { current: 0 } })
    await h.sleep(3150)
    assert.equal(page.data.filmAutoplay, false, '已翻页则不再恢复')
  }, 20000)

  it('页内滚动到底后继续上滑翻下一页', async () => {
    page = h.launchIndexPage({ noCloud: true })
    await h.sleep(40)
    page.setData({ current: 1 })
    page._edges.invitation = { top: true, bottom: true }
    const start = { touches: [{ clientY: 300, clientX: 100 }], currentTarget: { dataset: { view: 'invitation' } } }
    const end = { changedTouches: [{ clientY: 200 }], currentTarget: { dataset: { view: 'invitation' } } }
    page.onInnerTouchStart(start)
    page.onInnerTouchEnd(end)
    assert.equal(page.data.current, 2, '底部上滑应翻下一页')
    assert.equal(page._edges.invitation.bottom, false, '翻页后底部边界复位')
  })

  it('页内滚动到顶后下滑翻上一页', async () => {
    page = h.launchIndexPage({ noCloud: true })
    await h.sleep(40)
    page.setData({ current: 3 })
    page._edges.timeline = { top: true, bottom: false }
    page.onInnerTouchStart({ touches: [{ clientY: 200, clientX: 100 }], currentTarget: { dataset: { view: 'timeline' } } })
    page.onInnerTouchEnd({ changedTouches: [{ clientY: 320 }], currentTarget: { dataset: { view: 'timeline' } } })
    assert.equal(page.data.current, 2)
  })

  it('位移不足或横向滑动不触发翻页', async () => {
    page = h.launchIndexPage({ noCloud: true })
    await h.sleep(40)
    page.setData({ current: 1 })
    page._edges.invitation = { top: true, bottom: true }
    page.onInnerTouchStart({ touches: [{ clientY: 300, clientX: 100 }], currentTarget: { dataset: { view: 'invitation' } } })
    // 纵向位移不足
    page.onInnerTouchEnd({ changedTouches: [{ clientY: 280 }], currentTarget: { dataset: { view: 'invitation' } } })
    assert.equal(page.data.current, 1)
    // 横向滑动占主导
    page.onInnerTouchStart({ touches: [{ clientY: 300, clientX: 0 }], currentTarget: { dataset: { view: 'invitation' } } })
    page.onInnerTouchEnd({ changedTouches: [{ clientY: 200, clientX: 100 }], currentTarget: { dataset: { view: 'invitation' } } })
    assert.equal(page.data.current, 1)
  })

  it('syncEdges 内容不满一屏时上下边界放开', async () => {
    page = h.launchIndexPage({ noCloud: true })
    await h.sleep(40)
    page.__queryResults = [[{ top: 0, height: 200 }, { top: 0, height: 100 }]]
    page.syncEdges('invitation')
    await h.sleep(10)
    assert.deepEqual(page._edges.invitation, { top: true, bottom: true })
  })

  it('syncEdges 超一屏按滚动位置收紧边界', async () => {
    page = h.launchIndexPage({ noCloud: true })
    await h.sleep(40)
    page.__queryResults = [[{ top: 10, height: 400 }, { top: -100, height: 2000 }]]
    page.syncEdges('invitation')
    await h.sleep(10)
    assert.deepEqual(page._edges.invitation, { top: false, bottom: false })
  })

  it('转发与朋友圈分享携带新人姓名与封面', async () => {
    page = h.launchIndexPage({ noCloud: true })
    await h.sleep(40)
    const share = page.onShareAppMessage()
    assert.equal(share.title, '刘浩宇 & 张婧怡 的婚礼邀请函')
    assert.equal(share.path, '/pages/index/index')
    assert.equal(share.imageUrl, undefined)
    page.setData({ shareImage: 'https://tmp.example.com/cover.jpg' })
    const share2 = page.onShareAppMessage()
    assert.equal(share2.imageUrl, 'https://tmp.example.com/cover.jpg')
    const timeline = page.onShareTimeline()
    assert.equal(timeline.imageUrl, 'https://tmp.example.com/cover.jpg')
  })

  it('配置残留 cloud:// 地址时兜底换取临时链接', async () => {
    page = h.launchIndexPage({ noCloud: false })
    await h.sleep(40)
    await page.materializeCloudMedia({
      coverImage: 'cloud://no-slash-id',
      musicSrc: 'https://already.ok.mp3',
      photos: [{ src: 'cloud://env.123/images/p1.jpg', title: 'a' }]
    })
    const w = page.data.wedding
    assert.ok(w.coverImage.indexOf('https://tmp.example.com/') === 0, '封面应换成临时链接')
    assert.equal(w.musicSrc, 'https://already.ok.mp3', '非 cloud:// 地址不应改动')
    assert.equal(w.photos[0].src, 'https://tmp.example.com/cloud://env.123/images/p1.jpg')
    assert.equal(page.data.shareImage, w.coverImage)
  })
})

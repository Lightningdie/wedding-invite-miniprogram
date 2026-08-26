const storage = require('../../utils/storage.js')
const music = require('../../utils/music.js')

// 整页翻页：每页对应的入场动画开关名
const PAGE_KEYS = ['hero', 'invitation', 'photos', 'timeline', 'rsvp']
// 页内滚动区（与整页滑动手势衔接）：页码 -> scroll-view 标识
const PAGE_SCROLL_KEYS = { 1: 'invitation', 2: 'gallery', 3: 'timeline', 4: 'wall' }

Page({
  data: {
    days: '00',
    hours: '00',
    minutes: '00',
    seconds: '00',
    // 婚期已到：倒计时卡片切换为「今天我们结婚啦」
    isWeddingDay: false,
    formData: {
      name: '',
      count: '',
      message: ''
    },
    blessings: [],
    blessingsLoading: true,
    latestBlessingId: 0,
    wedding: {},
    musicOn: false,
    cloudTip: '',
    current: 0,
    // 竖向胶片：原生竖向 swiper 匀速连续上滑，触摸时暂停自动播放、松手后恢复
    filmAutoplay: false,
    // 翻到某页后点亮该页入场动画，离开时复位以便下次重放
    revealed: {
      hero: true,
      invitation: false,
      photos: false,
      timeline: false,
      rsvp: false
    }
  },

  countdownTimer: null,
  _revealTimer: null,
  _filmTimer: null,
  _edges: {},

  onLoad() {
    this.bootstrap()
    this.enableShare()
  },

  onShow() {
    this.loadWedding()
  },

  onUnload() {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer)
    }
    if (this._revealTimer) {
      clearTimeout(this._revealTimer)
    }
    if (this._filmTimer) {
      clearTimeout(this._filmTimer)
    }
  },

  async bootstrap() {
    await this.loadWedding()
    this.startCountdown()
    await this.loadBlessings()
  },

  async loadWedding() {
    const wedding = await storage.loadWeddingAsync()
    this.setData({ wedding })
  },

  // 翻页：先复位所有入场状态，滑入稳定后点亮当前页，内容按原有动画依次进入
  onPageChange(e) {
    const current = e.detail.current
    if (this._revealTimer) {
      clearTimeout(this._revealTimer)
    }
    const revealed = {}
    PAGE_KEYS.forEach((key) => {
      revealed[key] = false
    })
    this.setData({ current, revealed })
    // 离开相册页停住胶片自动播放，回到该页恢复
    if (current !== 2) {
      this.clearFilmTimer()
      if (this.data.filmAutoplay) {
        this.setData({ filmAutoplay: false })
      }
    } else if (!this.data.filmAutoplay) {
      this.setData({ filmAutoplay: true })
    }
    this._revealTimer = setTimeout(() => {
      this.setData({ ['revealed.' + PAGE_KEYS[current]]: true })
      this.syncEdges(PAGE_SCROLL_KEYS[current] || '')
    }, 240)
  },

  goPage(index) {
    if (index < 0 || index >= PAGE_KEYS.length || index === this.data.current) {
      return
    }
    this.setData({ current: index })
  },

  onTapDot(e) {
    this.goPage(Number(e.currentTarget.dataset.i))
  },

  // —— 胶片轮播：匀速爬行/手动拨动/压制外层翻页都由原生竖向 swiper 保证，这里只管触摸暂停 ——
  // 胶片区 catch 触摸事件用：内层 swiper 已消化手势，此处截断冒泡，阻止外层整页翻页
  noop() {},

  clearFilmTimer() {
    if (this._filmTimer) {
      clearTimeout(this._filmTimer)
      this._filmTimer = null
    }
  },

  onFilmTouchStart() {
    this.clearFilmTimer()
    if (this.data.filmAutoplay) {
      this.setData({ filmAutoplay: false })
    }
  },

  onFilmTouchEnd() {
    this.clearFilmTimer()
    this._filmTimer = setTimeout(() => {
      this._filmTimer = null
      if (this.data.current === 2) {
        this.setData({ filmAutoplay: true })
      }
    }, 3000)
  },

  // —— 页内滚动与整页翻页的手势衔接：滚到顶/底后再继续滑动即翻页 ——
  getEdges(view) {
    if (!this._edges[view]) {
      this._edges[view] = { top: true, bottom: false }
    }
    return this._edges[view]
  },

  // 进入某页时同步该页滚动区边界：内容不满一屏时上下都放开，整页滑动始终可用
  syncEdges(view) {
    if (!view) {
      return
    }
    const q = this.createSelectorQuery()
    q.select('#scroll-' + view).boundingClientRect()
    q.select('#body-' + view).boundingClientRect()
    q.exec((res) => {
      const box = res && res[0]
      const body = res && res[1]
      if (!box || !body) {
        return
      }
      const edges = this.getEdges(view)
      const scrollTop = Math.max(0, box.top - body.top)
      if (body.height <= box.height + 4) {
        edges.top = true
        edges.bottom = true
        return
      }
      edges.top = scrollTop <= 40
      edges.bottom = body.height - scrollTop <= box.height + 40
    })
  },

  onInnerScroll(e) {
    const edges = this.getEdges(e.currentTarget.dataset.view)
    if (e.detail.deltaY > 0) {
      edges.top = false
    }
    if (e.detail.deltaY < 0) {
      edges.bottom = false
    }
  },

  onInnerReachUpper(e) {
    this.getEdges(e.currentTarget.dataset.view).top = true
  },

  onInnerReachLower(e) {
    this.getEdges(e.currentTarget.dataset.view).bottom = true
  },

  onInnerTouchStart(e) {
    this._innerY = e.touches[0].clientY
    this._innerX = e.touches[0].clientX
  },

  onInnerTouchEnd(e) {
    const view = e.currentTarget.dataset.view
    const dy = (this._innerY || 0) - e.changedTouches[0].clientY
    const dx = Math.abs((this._innerX || 0) - e.changedTouches[0].clientX)
    if (dx > 60 || Math.abs(dy) < 45) {
      return
    }
    const edges = this._edges[view]
    if (!edges) {
      return
    }
    if (dy > 0 && edges.bottom) {
      edges.bottom = false
      this.goPage(this.data.current + 1)
    } else if (dy < 0 && edges.top) {
      edges.top = false
      this.goPage(this.data.current - 1)
    }
  },

  startCountdown() {
    this.updateCountdown()
    this.countdownTimer = setInterval(() => {
      this.updateCountdown()
    }, 1000)
  },

  updateCountdown() {
    const wedding = this.data.wedding
    if (!wedding.weddingDate) {
      return
    }
    const now = new Date().getTime()
    const target = new Date(wedding.weddingDate.replace(/-/g, '/')).getTime()
    const diff = target - now

    if (diff <= 0) {
      this.setData({
        days: '00',
        hours: '00',
        minutes: '00',
        seconds: '00',
        isWeddingDay: true
      })
      clearInterval(this.countdownTimer)
      return
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((diff % (1000 * 60)) / 1000)

    this.setData({
      days: storage.padZero(days),
      hours: storage.padZero(hours),
      minutes: storage.padZero(minutes),
      seconds: storage.padZero(seconds),
      isWeddingDay: false
    })
  },

  onNameInput(e) {
    this.setData({ 'formData.name': e.detail.value })
  },

  onCountInput(e) {
    this.setData({ 'formData.count': e.detail.value })
  },

  onMessageInput(e) {
    this.setData({ 'formData.message': e.detail.value })
  },

  async submitBlessing() {
    const { name, count, message } = this.data.formData
    if (!name.trim()) {
      wx.showToast({ title: '请输入您的姓名', icon: 'none' })
      return
    }
    if (!message.trim()) {
      wx.showToast({ title: '请写下您的祝福', icon: 'none' })
      return
    }

    const blessing = {
      id: Date.now(),
      name: name.trim(),
      count: count || '1',
      message: message.trim(),
      time: storage.formatTime(new Date())
    }

    const result = await storage.addBlessingAsync(blessing)
    this.setData({
      blessings: result.list,
      formData: { name: '', count: '', message: '' },
      latestBlessingId: blessing.id,
      cloudTip: result.cloud ? '已同步云数据库' : '已永久保存在本地（开通云开发后可同步）'
    })

    await storage.upsertGuestAsync({
      id: Date.now() + 1,
      name: blessing.name,
      count: Number(blessing.count) || 1,
      status: 'confirmed',
      message: blessing.message,
      time: blessing.time
    })

    wx.showToast({
      title: result.cloud ? '祝福已保存到云端' : '祝福已持久保存',
      icon: 'none',
      duration: 2000
    })
  },

  async loadBlessings() {
    const blessings = await storage.loadBlessingsAsync()
    this.setData({ blessings, blessingsLoading: false })
  },

  onToggleMusic() {
    // 后台入口暗门：3 秒内连点 5 次进入管理页，替代长按，避免宾客误触
    const now = Date.now()
    this._musicTaps = (this._musicTaps || []).filter((t) => now - t < 3000)
    this._musicTaps.push(now)
    if (this._musicTaps.length >= 5) {
      this._musicTaps = []
      this.goAdmin()
      return
    }

    const src = this.data.wedding.musicSrc
    if (!src) {
      wx.showToast({ title: '请先上传背景音乐', icon: 'none' })
      return
    }
    const on = music.toggleMusic(src)
    this.setData({ musicOn: on })

    if (!on) {
      wx.showToast({ title: '已关闭音乐', icon: 'none' })
      return
    }

    setTimeout(() => {
      if (!music.getPlaying()) {
        this.setData({ musicOn: false })
        wx.showToast({
          title: '请将 mp3 放到 assets/music/bgm.mp3',
          icon: 'none'
        })
      }
    }, 400)
  },

  goAdmin() {
    wx.navigateTo({ url: '/pages/admin/home/home' })
  },

  // 打开右上角菜单的「转发」与「分享到朋友圈」入口（朋友圈仅安卓基础库 2.11.3+ 支持）
  enableShare() {
    if (!wx.showShareMenu) {
      return
    }
    wx.showShareMenu({
      withShareTicket: false,
      menus: ['shareAppMessage', 'shareTimeline'],
      fail: () => {
        // 基础库过旧时静默忽略，转发入口仍由 onShareAppMessage 提供
      }
    })
  },

  // 转发给好友：button open-type="share" 与右上角菜单都会走到这里
  onShareAppMessage() {
    const w = this.data.wedding
    return {
      title: `${w.groom} & ${w.bride} 的婚礼邀请函`,
      path: '/pages/index/index',
      imageUrl: w.coverImage
    }
  },

  // 分享到朋友圈：从右上角「···」菜单进入（仅安卓支持），点开后以单页模式浏览
  onShareTimeline() {
    const w = this.data.wedding
    return {
      title: `${w.groom} & ${w.bride} 的婚礼邀请函`,
      imageUrl: w.coverImage
    }
  }
})

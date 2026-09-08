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
    wallList: [],
    wallLoop: false,
    wallPaused: false,
    wallShift: 0,
    wallDuration: 0,
    latestBlessingId: 0,
    wedding: {},
    shareImage: '',
    musicOn: false,
    // 音乐按钮 top 内联样式：与胶囊按钮对齐后由 JS 写入，px 精确适配刘海屏
    musicBtnStyle: '',
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
    this.alignMusicBtn()
    this.bootstrap()
    this.enableShare()
  },

  // 音乐按钮与右上角胶囊按钮垂直居中对齐：iPhone 刘海/灵动岛的 safe-area
  // 高度远大于安卓状态栏，纯 rpx + safe-area 定位会导致 iOS 上按钮明显偏低。
  // 胶囊位置全平台一致，以其为锚点两端视觉统一；拿不到胶囊时保留 wxss 兜底。
  alignMusicBtn() {
    const rect = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null
    if (!rect || !rect.height) {
      return
    }
    const win = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    // 按钮尺寸 64rpx，与 wxml/wxss 保持一致
    const btnPx = (64 / 750) * win.windowWidth
    const top = rect.top + (rect.height - btnPx) / 2
    this.setData({ musicBtnStyle: 'top: ' + Math.round(top) + 'px' })
  },

  onShow() {
    this.loadWedding()
    // 每次回前台都重拉留言：后台管理端清空/新增后，留言展示区跟着变化
    this.loadBlessings()
    // 从后台回前台：若正停在相册页，恢复胶片自动上滑
    if (this.data.current === 2 && !this.data.filmAutoplay) {
      this.setData({ filmAutoplay: true })
    }
    // 从后台回前台：音乐本应在播就接着播（用户手动关过则不打扰）
    if (this.data.musicOn) {
      music.playMusic(this.data.wedding.musicSrc)
    }
  },

  onHide() {
    // 切后台 / 聚焦其他应用 / 退出小程序：停住胶片自动滚动
    this.clearFilmTimer()
    if (this.data.filmAutoplay) {
      this.setData({ filmAutoplay: false })
    }
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
    // 打开即播背景音乐（个别机型拦截冷启动自动播放，见 onRootTouchStart 兜底）
    this.autoPlayMusic()
    // 留言加载统一走 onShow（冷启动也会触发 onShow），避免重复请求
  },

  async loadWedding() {
    const wedding = await storage.loadWeddingAsync()
    this.setData({ wedding })
    // 兜底：万一配置里仍残留 cloud:// 云存储地址，统一换成 https 临时链接
    // （正常情况媒体走静态托管公网地址，此处直接跳过）
    await this.materializeCloudMedia(wedding)
  },

  // 收集配置里的全部云存储文件，一次性换取 https 临时链接后回填页面数据（分享封面也依赖它）
  materializeCloudMedia(wedding) {
    const ids = []
    const push = (v) => {
      if (v && String(v).indexOf('cloud://') === 0 && ids.indexOf(v) < 0) {
        ids.push(v)
      }
    }
    push(wedding.coverImage)
    push(wedding.inviteImage)
    push(wedding.musicSrc)
    Object.keys(wedding.deco || {}).forEach((key) => push(wedding.deco[key]))
    ;(wedding.photos || []).forEach((p) => push(p && p.src))
    if (!ids.length) {
      return Promise.resolve()
    }
    return new Promise((resolve) => {
      wx.cloud.getTempFileURL({
        fileList: ids,
        success: (res) => {
          const urlMap = {}
          ;(res.fileList || []).forEach((f) => {
            if (f && f.tempFileURL) {
              urlMap[f.fileID] = f.tempFileURL
            } else if (f && f.status && f.status !== 0) {
              console.log('云存储文件获取链接失败，请确认已上传', f.fileID, f.errMsg)
            }
          })
          const pick = (v) => urlMap[v] || v
          this.setData({
            wedding: {
              ...wedding,
              coverImage: pick(wedding.coverImage),
              inviteImage: pick(wedding.inviteImage),
              musicSrc: pick(wedding.musicSrc),
              deco: Object.keys(wedding.deco || {}).reduce((acc, key) => {
                acc[key] = pick(wedding.deco[key])
                return acc
              }, {}),
              photos: (wedding.photos || []).map((p) => (p && p.src ? { ...p, src: pick(p.src) } : p))
            },
            shareImage: pick(wedding.coverImage)
          })
          resolve()
        },
        fail: (err) => {
          console.log('云存储临时链接获取失败', err)
          resolve()
        }
      })
    })
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
    // 循环滚动中：按下时暂停，方便手动查看
    if (e.currentTarget.dataset.view === 'wall' && this.data.wallLoop) {
      this.setData({ wallPaused: true })
    }
  },

  onInnerTouchEnd(e) {
    if (e.currentTarget.dataset.view === 'wall' && this.data.wallLoop) {
      this.setData({ wallPaused: false })
    }
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
    // 提交期间忽略连点，避免同一人重复提交祝福与宾客登记
    if (this._submitting) {
      return
    }
    this._submitting = true
    try {
      await this.doSubmitBlessing()
    } finally {
      this._submitting = false
    }
  },

  async doSubmitBlessing() {
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
      formData: { name: '', count: '', message: '' },
      latestBlessingId: blessing.id,
      cloudTip: result.cloud ? '已同步云数据库' : '已永久保存在本地（开通云开发后可同步）'
    })
    this.applyBlessings(result.list)

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
    // 上一次还没回来就不再发起（onShow 可能连续触发），返回中的那次会覆盖最新数据
    if (this._loadingBlessings) {
      return
    }
    this._loadingBlessings = true
    try {
      const blessings = await storage.loadBlessingsAsync()
      this.setData({ blessingsLoading: false })
      this.applyBlessings(blessings)
    } finally {
      this._loadingBlessings = false
    }
  },

  // 祝福墙：超过 3 条时固定高度并循环滚动，否则保持内容自适应
  applyBlessings(list) {
    const loop = list.length > 3
    // 循环时列表翻倍实现无缝衔接，_k 保证翻倍后 key 仍唯一
    const wallList = list
      .concat(loop ? list : [])
      .map((item, i) => Object.assign({}, item, { _k: i }))
    this.setData({
      blessings: list,
      wallList: wallList,
      wallLoop: loop
    }, () => {
      if (loop) {
        this.setupWallLoop()
      } else {
        this.setData({ wallShift: 0, wallDuration: 0 })
      }
    })
  },

  // 量取列表内容总高，计算循环位移与时长（墙高由 CSS 固定，不随内容变化）
  setupWallLoop() {
    setTimeout(() => {
      const q = this.createSelectorQuery()
      q.selectAll('#body-wall .blessing-item').boundingClientRect()
      q.exec((res) => {
        const rects = res && res[0]
        if (!rects || rects.length < 6) {
          return
        }
        const mid = rects[Math.floor(rects.length / 2)]
        if (!mid) {
          return
        }
        const shift = mid.top - rects[0].top
        this.setData({
          wallShift: shift,
          // 约 25px/s 匀速滚动，位移越大转得越久
          wallDuration: Math.max(10, Math.round(shift / 25))
        })
      })
    }, 80)
  },

  // —— 背景音乐：打开小程序默认自动播放 ——
  autoPlayMusic() {
    // musicSrc 默认指向静态托管公网地址，加载失败时音乐组件静默失败，不影响页面
    const src = this.data.wedding.musicSrc
    music.playMusic(src)
    this.setData({ musicOn: true })
    // 部分机型冷启动不允许自动出声：600ms 后核实，被拦则等首次触摸补播
    setTimeout(() => {
      if (!music.getPlaying()) {
        this._musicBlocked = true
      }
    }, 600)
  },

  // 首次触摸兜底：被系统拦下的自动播放在用户第一次触屏时补上
  onRootTouchStart() {
    if (!this._musicBlocked) {
      return
    }
    this._musicBlocked = false
    music.playMusic(this.data.wedding.musicSrc)
    setTimeout(() => {
      if (!music.getPlaying()) {
        this.setData({ musicOn: false })
      }
    }, 800)
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

    // 800ms 后仍没播起来（网络慢/资源缺失）只回正按钮状态，不弹失败提示打扰宾客
    setTimeout(() => {
      if (!music.getPlaying()) {
        this.setData({ musicOn: false })
      }
    }, 800)
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
    const share = {
      title: `${w.groom} & ${w.bride} 的婚礼邀请函`,
      path: '/pages/index/index'
    }
    if (this.data.shareImage) {
      share.imageUrl = this.data.shareImage
    }
    return share
  },

  // 分享到朋友圈：从右上角「···」菜单进入（仅安卓支持），点开后以单页模式浏览
  onShareTimeline() {
    const w = this.data.wedding
    const share = {
      title: `${w.groom} & ${w.bride} 的婚礼邀请函`
    }
    if (this.data.shareImage) {
      share.imageUrl = this.data.shareImage
    }
    return share
  }
})

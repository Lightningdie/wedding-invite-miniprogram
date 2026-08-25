const storage = require('../../utils/storage.js')
const music = require('../../utils/music.js')

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
    // 各区块滚入视口时点亮入场动画
    revealed: {
      hero: true,
      invitation: false,
      photos: false,
      timeline: false,
      rsvp: false
    }
  },

  countdownTimer: null,
  _observers: [],

  onLoad() {
    this.bootstrap()
  },

  onReady() {
    // 首帧渲染完成后挂载滚动监听，确保节点已存在
    this.setupReveal()
  },

  onShow() {
    this.loadWedding()
  },

  onUnload() {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer)
    }
    this.destroyObservers()
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

  setupReveal() {
    this.destroyObservers()
    const ids = ['invitation', 'photos', 'timeline', 'rsvp']
    this._observers = ids.map((id) => {
      const ob = this.createIntersectionObserver({ thresholds: [0.1] })
      ob.relativeToViewport().observe('#sec-' + id, (res) => {
        if (res.intersectionRatio > 0.1) {
          this.setData({ ['revealed.' + id]: true })
          ob.disconnect()
        }
      })
      return ob
    })
  },

  destroyObservers() {
    (this._observers || []).forEach((ob) => {
      try {
        ob.disconnect()
      } catch (e) {
        // ignore
      }
    })
    this._observers = []
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

  onShareAppMessage() {
    const w = this.data.wedding
    return {
      title: `${w.groom} & ${w.bride} 的婚礼邀请函`,
      path: '/pages/index/index',
      imageUrl: w.coverImage
    }
  },

  onShareTimeline() {
    const w = this.data.wedding
    return {
      title: `${w.groom} & ${w.bride} 的婚礼邀请函`,
      imageUrl: w.coverImage
    }
  }
})

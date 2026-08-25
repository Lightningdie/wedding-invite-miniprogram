const storage = require('../../../utils/storage.js')

Page({
  data: {
    form: {}
  },

  onLoad() {
    this.loadForm()
  },

  async loadForm() {
    const wedding = await storage.loadWeddingAsync()
    this.setData({
      form: {
        groom: wedding.groom,
        bride: wedding.bride,
        solarDate: wedding.solarDate,
        lunarDate: wedding.lunarDate,
        weekDay: wedding.weekDay,
        ceremonyTime: wedding.ceremonyTime,
        weddingDate: wedding.weddingDate,
        venueName: wedding.venueName,
        venueHall: wedding.venueHall,
        venueAddress: wedding.venueAddress,
        musicSrc: wedding.musicSrc
      }
    })
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({
      ['form.' + field]: e.detail.value
    })
  },

  async saveForm() {
    const form = this.data.form
    storage.setWedding({
      groom: form.groom,
      bride: form.bride,
      solarDate: form.solarDate,
      lunarDate: form.lunarDate,
      weekDay: form.weekDay,
      ceremonyTime: form.ceremonyTime,
      weddingDate: form.weddingDate,
      venueName: form.venueName,
      venueHall: form.venueHall,
      venueAddress: form.venueAddress,
      musicSrc: form.musicSrc
    })
    wx.showToast({
      title: storage.isCloudReady() ? '已同步云端' : '已持久保存到本地',
      icon: 'success'
    })
  },

  resetForm() {
    wx.showModal({
      title: '确认恢复默认？',
      success: (res) => {
        if (!res.confirm) {
          return
        }
        wx.removeStorageSync('wedding_config')
        this.loadForm()
        wx.showToast({ title: '已恢复默认', icon: 'none' })
      }
    })
  }
})

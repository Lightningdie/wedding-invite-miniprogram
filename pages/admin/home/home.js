const storage = require('../../../utils/storage.js')

Page({
  data: {
    wedding: {},
    guestCount: 0,
    guestTotal: 0,
    blessingCount: 0,
    cloudReady: false
  },

  onShow() {
    this.refresh()
  },

  async refresh() {
    const wedding = await storage.loadWeddingAsync()
    const guests = await storage.loadGuestsAsync()
    const blessings = await storage.loadBlessingsAsync()
    let guestTotal = 0
    guests.forEach((g) => {
      guestTotal += Number(g.count) || 1
    })
    this.setData({
      wedding,
      guestCount: guests.length,
      guestTotal,
      blessingCount: blessings.length,
      cloudReady: storage.isCloudReady()
    })
  },

  goInvite() {
    wx.navigateTo({ url: '/pages/index/index' })
  },

  goEdit() {
    wx.navigateTo({ url: '/pages/admin/edit/edit' })
  },

  goGuests() {
    wx.navigateTo({ url: '/pages/admin/guests/guests' })
  }
})

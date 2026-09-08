const storage = require('../../../utils/storage.js')

Page({
  data: {
    guests: [],
    totalCount: 0,
    showForm: false,
    editingId: 0,
    form: {
      name: '',
      count: '1',
      status: 'pending',
      message: ''
    },
    statusOptions: [
      { value: 'pending', label: '待确认' },
      { value: 'confirmed', label: '已确认' },
      { value: 'declined', label: '无法出席' }
    ],
    statusIndex: 0,
    statusText: {
      pending: '待确认',
      confirmed: '已确认',
      declined: '无法出席'
    }
  },

  onShow() {
    this.refresh()
  },

  async refresh() {
    const guests = await storage.loadGuestsAsync()
    let totalCount = 0
    guests.forEach((g) => {
      totalCount += Number(g.count) || 1
    })
    this.setData({ guests, totalCount })
  },

  openAdd() {
    this.setData({
      showForm: true,
      editingId: 0,
      statusIndex: 0,
      form: {
        name: '',
        count: '1',
        status: 'pending',
        message: ''
      }
    })
  },

  openEdit(e) {
    const id = e.currentTarget.dataset.id
    // id 统一按字符串比较：数字 id 经 dataset 传参在部分机型会变成字符串
    const guest = this.data.guests.find((g) => String(g.id) === String(id))
    if (!guest) {
      return
    }
    const statusIndex = this.data.statusOptions.findIndex((s) => s.value === guest.status)
    this.setData({
      showForm: true,
      editingId: id,
      statusIndex: statusIndex >= 0 ? statusIndex : 0,
      form: {
        name: guest.name,
        count: String(guest.count || 1),
        status: guest.status || 'pending',
        message: guest.message || ''
      }
    })
  },

  closeForm() {
    this.setData({ showForm: false })
  },

  onFormInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({
      ['form.' + field]: e.detail.value
    })
  },

  onStatusChange(e) {
    const statusIndex = Number(e.detail.value)
    this.setData({
      statusIndex,
      'form.status': this.data.statusOptions[statusIndex].value
    })
  },

  async saveGuest() {
    const form = this.data.form
    if (!form.name.trim()) {
      wx.showToast({ title: '请填写姓名', icon: 'none' })
      return
    }
    const guest = {
      id: this.data.editingId || Date.now(),
      name: form.name.trim(),
      count: Number(form.count) || 1,
      status: form.status,
      message: form.message.trim(),
      time: storage.formatTime(new Date())
    }
    // manage=true：管理页走云函数（云端权限），可改删所有宾客记录
    const result = await storage.upsertGuestAsync(guest, true)
    this.setData({ showForm: false, guests: result.list })
    this.refresh()
    wx.showToast({
      title: result.cloud ? '已同步云端' : '已持久保存',
      icon: 'success'
    })
  },

  // 清空全部宾客：云端 + 本地一并清，防止下次拉取时复活
  clearAll() {
    wx.showModal({
      title: '确认清空全部宾客？',
      content: '清空后云端和本地都会删除，不可恢复',
      success: async (res) => {
        if (!res.confirm) {
          return
        }
        const result = await storage.clearGuestsAsync()
        this.setData({ guests: result.list, totalCount: 0 })
        wx.showToast({
          title: result.cloud ? '已清空云端' : '仅本地清空（云函数未部署或权限受限）',
          icon: 'none',
          duration: 2000
        })
      }
    })
  },

  removeGuest(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '确认删除？',
      success: async (res) => {
        if (!res.confirm) {
          return
        }
        // 先用返回的本地列表立即刷新界面，再异步拉云端核对
        const result = await storage.removeGuestAsync(id)
        this.setData({ guests: result.list })
        this.refresh()
      }
    })
  }
})

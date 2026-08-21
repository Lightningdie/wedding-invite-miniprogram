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
    const guest = this.data.guests.find((g) => g.id === id)
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
    const result = await storage.upsertGuestAsync(guest)
    this.setData({ showForm: false, guests: result.list })
    this.refresh()
    wx.showToast({
      title: result.cloud ? '已同步云端' : '已持久保存',
      icon: 'success'
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
        await storage.removeGuestAsync(id)
        this.refresh()
      }
    })
  }
})

const storage = require('../../../utils/storage.js')

Page({
  data: {
    blessings: [],
    showForm: false,
    editingId: '',
    form: {
      name: '',
      count: '1',
      message: '',
      time: ''
    }
  },

  onShow() {
    this.refresh()
  },

  async refresh() {
    const blessings = await storage.loadBlessingsAsync()
    this.setData({ blessings })
  },

  openEdit(e) {
    const id = e.currentTarget.dataset.id
    // id 统一按字符串比较：数字 id 经 dataset 传参在部分机型会变成字符串
    const item = this.data.blessings.find((b) => String(b.id) === String(id))
    if (!item) {
      return
    }
    this.setData({
      showForm: true,
      // 弹层打开时记录编辑目标，保存时带上原留言的提交时间
      editingId: id,
      form: {
        name: item.name || '',
        count: String(item.count || 1),
        message: item.message || '',
        time: item.time || ''
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

  // 弹层「清空」：一键清空全部表单内容（姓名/人数/留言），
  // time 保留——保存时仍沿用原留言的提交时间
  clearForm() {
    this.setData({
      form: {
        name: '',
        count: '',
        message: '',
        time: this.data.form.time || ''
      }
    })
  },

  async saveBlessing() {
    const form = this.data.form
    // 姓名和留言内容必填
    if (!form.name.trim()) {
      wx.showToast({ title: '请填写姓名', icon: 'none' })
      return
    }
    if (!form.message.trim()) {
      wx.showToast({ title: '请填写留言内容', icon: 'none' })
      return
    }
    // 编辑只改内容，保留原留言的提交时间
    const blessing = {
      id: this.data.editingId,
      name: form.name.trim(),
      count: Number(form.count) || 1,
      message: form.message.trim(),
      time: form.time
    }
    // 管理端走 manageBlessings 云函数（云端权限），可改所有人的留言记录
    const result = await storage.updateBlessingAsync(blessing)
    this.setData({ showForm: false, blessings: result.list })
    this.refresh()
    wx.showToast({
      title: result.cloud ? '已同步云端' : '仅本地生效（云函数未部署或权限受限）',
      icon: result.cloud ? 'success' : 'none',
      duration: 2000
    })
  },

  removeBlessing(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '确认删除这条留言？',
      success: async (res) => {
        if (!res.confirm) {
          return
        }
        // 先用返回的本地列表立即刷新界面，再异步拉云端核对
        const result = await storage.removeBlessingAsync(id)
        this.setData({ blessings: result.list })
        this.refresh()
      }
    })
  },

  clearAll() {
    wx.showModal({
      title: '确认清空全部留言？',
      content: '清空后云端和本地都会删除，不可恢复',
      success: async (res) => {
        if (!res.confirm) {
          return
        }
        const result = await storage.clearBlessingsAsync()
        this.setData({ blessings: result.list })
        wx.showToast({
          title: result.cloud ? '已清空云端' : '仅本地清空（云函数未部署或权限受限）',
          icon: 'none',
          duration: 2000
        })
      }
    })
  }
})

App({
  onLaunch() {
    const storage = require('./utils/storage.js')
    this.globalData.cloudEnv = 'cloud1-d1gknvmit778344ba'
    // 版本变更时清理本地存档（旧配置不再盖住新版本内容），随后连云
    storage.initVersionedCache()
    const ok = storage.initCloud()
    this.globalData.cloudReady = ok
    console.log('婚礼邀请函启动', ok ? '云数据库 main 已连接' : '使用本地持久化')
    this.checkUpdate()
  },

  // 版本更新：微信静默下载完新版后弹窗询问是否立即重启，确保宾客打开的总是最新版
  checkUpdate() {
    if (!wx.getUpdateManager) {
      return
    }
    const mgr = wx.getUpdateManager()
    mgr.onUpdateReady(() => {
      wx.showModal({
        title: '版本更新',
        content: '发现新版本，是否立即重启小程序？',
        confirmText: '立即重启',
        cancelText: '稍后',
        success: (res) => {
          if (res.confirm) {
            mgr.applyUpdate()
          }
        }
      })
    })
    mgr.onUpdateFailed(() => {
      wx.showModal({
        title: '版本更新',
        content: '新版本下载失败，请检查网络后重新打开',
        showCancel: false
      })
    })
  },

  globalData: {
    cloudEnv: 'cloud1-d1gknvmit778344ba',
    cloudReady: false
  }
})

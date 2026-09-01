App({
  onLaunch() {
    const storage = require('./utils/storage.js')
    this.globalData.cloudEnv = 'cloud1-d1gknvmit778344ba'
    const ok = storage.initCloud()
    this.globalData.cloudReady = ok
    console.log('婚礼邀请函启动', ok ? '云数据库已连接' : '使用本地持久化')
  },
  globalData: {
    cloudEnv: 'cloud1-d1gknvmit778344ba',
    cloudReady: false
  }
})

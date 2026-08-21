App({
  onLaunch() {
    const storage = require('./utils/storage.js')
    // 开通云开发后，在此填写环境 ID，例如：'wedding-xxxx'
    this.globalData.cloudEnv = ''
    const ok = storage.initCloud()
    this.globalData.cloudReady = ok
    console.log('婚礼邀请函启动', ok ? '云数据库已连接' : '使用本地持久化')
  },
  globalData: {
    cloudEnv: '',
    cloudReady: false
  }
})

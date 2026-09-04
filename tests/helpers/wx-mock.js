/**
 * wx API 全量 mock：内存存储 / 音频上下文 / 云开发 / 界面反馈录制器。
 * createWxMock() 每次返回全新实例，配合 harness.reset() 做到测试间零串扰。
 */
class InnerAudioContextMock {
  constructor(state) {
    this.__state = state
    this.src = ''
    this.loop = false
    this.obeyMuteSwitch = true
    this.currentTime = 0
    this.calls = []
    this.handlers = {}
    this.destroyed = false
  }
  on(ev, cb) { this.handlers[ev] = cb }
  onError(cb) { this.on('error', cb) }
  onPlay(cb) { this.on('play', cb) }
  onPause(cb) { this.on('pause', cb) }
  onStop(cb) { this.on('stop', cb) }
  off() {}
  play() { this.calls.push('play') }
  pause() { this.calls.push('pause') }
  stop() { this.calls.push('stop') }
  destroy() { this.calls.push('destroy'); this.destroyed = true }
  emit(event, payload) {
    const h = this.handlers[event]
    if (h) h(payload)
  }
}

// ---------- 界面反馈录制器与开关 ----------
function makeUiState() {
  return {
    toasts: [],
    modals: [],
    navigations: [],
    shareMenuCalls: [],
    nextModalConfirm: false,
    failCloudInit: false,
    failGetTempFileURL: false
  }
}

// ---------- 云数据库 mock（客户端与云函数共用同一实例） ----------
class DbMock {
  constructor() {
    this.collections = {}
    this.autoId = 0
    this.seq = 0
    this.errors = {}
  }

  collection(name) {
    if (!this.collections[name]) this.collections[name] = []
    return new ColHandle(this, name)
  }

  serverDate() {
    this.seq += 1
    return { __serverDate: this.seq }
  }

  // 错误注入：下一次 collection(name) 上 op 类型调用抛出 err
  failNext(colName, op, err) {
    const key = colName + ':' + op
    if (!this.errors[key]) this.errors[key] = []
    this.errors[key].push(err)
  }

  __takeError(colName, op) {
    const q = this.errors[colName + ':' + op]
    return q && q.length ? q.shift() : null
  }

  __ids(colName) {
    return (this.collections[colName] || []).map((d) => d._id)
  }
}

// 集合句柄：链式 orderBy/limit，终端操作 add/get；doc() 返回文档句柄
class ColHandle {
  constructor(db, name) {
    this.__db = db
    this.__name = name
    this.__order = null
    this.__limit = Infinity
  }

  orderBy(field, order) {
    this.__order = { field, order: order || 'asc' }
    return this
  }

  limit(n) {
    this.__limit = n
    return this
  }

  __snapshot() {
    let docs = this.__db.collections[this.__name].slice()
    if (this.__order) {
      const f = this.__order.field
      const dir = this.__order.order === 'desc' ? -1 : 1
      docs.sort((a, b) => {
        const va = (a[f] && a[f].__serverDate) || 0
        const vb = (b[f] && b[f].__serverDate) || 0
        return (va - vb) * dir
      })
    }
    docs = docs.slice(0, this.__limit === Infinity ? docs.length : this.__limit)
    return JSON.parse(JSON.stringify(docs))
  }

  add(payload) {
    const db = this.__db
    const err = db.__takeError(this.__name, 'add')
    if (err) return Promise.reject(err)
    db.autoId += 1
    // 与真实云开发一致：_id 长度 >= 16，客户端据此区分「云端记录」与「纯本地记录」
    const id = 'cid' + String(db.autoId).padStart(20, '0')
    const doc = Object.assign({ _id: id }, payload.data)
    db.collections[this.__name].push(doc)
    return Promise.resolve({ _id: id })
  }

  get() {
    const err = this.__db.__takeError(this.__name, 'get')
    if (err) return Promise.reject(err)
    return Promise.resolve({ data: this.__snapshot() })
  }
}

// 文档句柄：doc(id).get/set/update/remove
class DocHandle {
  constructor(db, name, id) {
    this.__db = db
    this.__name = name
    this.__id = id
  }
  __find() {
    const docs = this.__db.collections[this.__name] || []
    return docs.find((d) => d._id === this.__id)
  }
  get() {
    const err = this.__db.__takeError(this.__name, 'doc.get')
    if (err) return Promise.reject(err)
    const doc = this.__find()
    if (!doc) return Promise.reject(new Error('document.get:fail document not exists'))
    return Promise.resolve({ data: JSON.parse(JSON.stringify(doc)) })
  }
  set(payload) {
    const docs = this.__db.collections[this.__name]
    const existing = this.__find()
    if (existing) {
      const kept = existing._id
      Object.keys(existing).forEach((k) => delete existing[k])
      Object.assign(existing, payload.data, { _id: kept })
    } else {
      docs.push(Object.assign({ _id: this.__id }, payload.data))
    }
    return Promise.resolve({ _id: this.__id })
  }
  update(payload) {
    const existing = this.__find()
    if (existing) Object.assign(existing, payload.data)
    return Promise.resolve({ stats: { updated: existing ? 1 : 0 } })
  }
  remove() {
    const err = this.__db.__takeError(this.__name, 'doc.remove')
    if (err) return Promise.reject(err)
    const docs = this.__db.collections[this.__name] || []
    const idx = docs.findIndex((d) => d._id === this.__id)
    if (idx >= 0) docs.splice(idx, 1)
    return Promise.resolve({})
  }
}

// ColHandle.doc() 挂到原型上（类定义顺序原因）
ColHandle.prototype.doc = function (id) {
  return new DocHandle(this.__db, this.__name, id)
}

// ---------- wx.cloud 客户端 mock ----------
function makeCloud(state, db) {
  return {
    init(opts) {
      if (state.failCloudInit) {
        throw new Error('init cloud:fail 环境不存在')
      }
      state.cloudInited = true
      state.cloudEnv = (opts && opts.env) || ''
    },
    database() {
      if (!state.cloudInited) throw new Error('cloud database 前未 init')
      return db
    },
    callFunction(opts) {
      const run = Promise.resolve().then(async () => {
        if (!state.cloudInited) throw new Error('cloud callFunction 前未 init')
        const fn = state.cloudFunctions[opts.name]
        if (!fn) throw new Error('Cloud function [' + opts.name + '] not found')
        const result = await fn(Object.assign({}, opts.data))
        return { result: result }
      })
      return opts && opts.success
        ? run.then((r) => opts.success(r), (e) => opts.fail && opts.fail(e))
        : run
    },
    getTempFileURL(opts) {
      const run = Promise.resolve().then(() => {
        if (state.failGetTempFileURL) {
          throw new Error('getTempFileURL:fail')
        }
        const fileList = (opts.fileList || []).map((id) => ({
          fileID: id,
          tempFileURL: 'https://tmp.example.com/' + id,
          status: 0
        }))
        return { fileList: fileList }
      })
      return opts && opts.success
        ? run.then((r) => opts.success(r), (e) => opts.fail && opts.fail(e))
        : run
    }
  }
}

// ---------- 组装全局 wx ----------
function createWxMock() {
  const state = Object.assign(makeUiState(), {
    cloudInited: false,
    cloudEnv: '',
    cloudFunctions: {},
    db: new DbMock()
  })
  const cloud = makeCloud(state, state.db)
  const wx = {
    __state: state,
    // 存储
    getStorageSync(key) {
      const v = state.store[key]
      return v === undefined ? '' : v
    },
    setStorageSync(key, value) {
      state.store[key] = value
    },
    removeStorageSync(key) {
      delete state.store[key]
    },
    // 音频
    createInnerAudioContext() {
      const ctx = new InnerAudioContextMock(state)
      state.audioInstances.push(ctx)
      return ctx
    },
    // 界面反馈
    showToast(opts) {
      state.toasts.push({ title: opts.title, icon: opts.icon, duration: opts.duration })
      if (opts.success) setTimeout(() => opts.success(), 0)
    },
    showModal(opts) {
      state.modals.push({ title: opts.title, content: opts.content })
      const confirm = state.nextModalConfirm
      state.nextModalConfirm = false
      setTimeout(() => opts.success && opts.success({ confirm: confirm }), 0)
    },
    navigateTo(opts) {
      state.navigations.push(opts.url)
    },
    showShareMenu(opts) {
      state.shareMenuCalls.push(opts)
    }
  }
  wx.__state = state
  wx.cloud = cloud
  state.audioInstances = []
  state.store = {}
  return wx
}

module.exports = { createWxMock, InnerAudioContextMock, DbMock, makeUiState }

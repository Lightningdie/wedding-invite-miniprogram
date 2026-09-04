/**
 * 测试沙盒：安装全局 wx/Page/App/getApp，加载真实项目模块并实例化页面。
 * harness.reset() 重建全部全局与 require 缓存，用例之间互不污染。
 */
const path = require('path')
const Module = require('module')
const { createWxMock } = require('./wx-mock.js')

const ROOT = path.resolve(__dirname, '..', '..')

const state = {
  openid: 'openid-owner',
  wx: null,
  db: null,
  pages: [],
  apps: [],
  app: null,
  DEFAULT: null
}

// wx-server-sdk 拦截：云函数模块 require 时返回共享同一 DbMock 的 mock
const ModuleLoad = Module._load
Module._load = function (request, parent, isMain) {
  if (request === 'wx-server-sdk') {
    const db = state.db
    return {
      init() {},
      DYNAMIC_CURRENT_ENV: '__DYNAMIC_CURRENT_ENV__',
      database() {
        return db
      },
      getWXContext() {
        return { OPENID: state.openid }
      }
    }
  }
  return ModuleLoad.apply(this, arguments)
}

function clearProjectCache() {
  Object.keys(require.cache).forEach((key) => {
    if (key.indexOf(ROOT + path.sep) === 0) {
      const rel = key.slice(ROOT.length + 1)
      const under = (p) => rel.indexOf(p) === 0
      if (
        under('pages' + path.sep) ||
        under('utils' + path.sep) ||
        under('data' + path.sep) ||
        under('cloudfunctions' + path.sep) ||
        rel === 'app.js'
      ) {
        delete require.cache[key]
      }
    }
  })
}

function reset() {
  global.wx = createWxMock()
  state.wx = global.wx
  state.db = global.wx.__state.db
  state.openid = 'openid-owner'
  state.pages = []
  state.apps = []
  state.app = null
  clearProjectCache()
  global.Page = (config) => {
    state.pages.push(config)
    return config
  }
  global.App = (config) => {
    state.apps.push(config)
    return config
  }
  global.getApp = () =>
    state.app || { globalData: { cloudEnv: 'test-env', cloudReady: false } }
  global.getCurrentPages = () => []
}

// ---------- 深克隆 / setData 路径写入 ----------
function cloneDeep(v) {
  if (v === null || typeof v !== 'object') return v
  if (Array.isArray(v)) return v.map(cloneDeep)
  const out = {}
  Object.keys(v).forEach((k) => (out[k] = cloneDeep(v[k])))
  return out
}

function setPath(obj, dotted, value) {
  const parts = dotted.split('.')
  let cur = obj
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null) {
      cur[parts[i]] = {}
    }
    cur = cur[parts[i]]
  }
  cur[parts[parts.length - 1]] = value
}

// ---------- 页面实例化（模拟小程序运行时） ----------
function instantiatePage(config) {
  const page = {}
  page.data = cloneDeep(config.data || {})
  page.__queryResults = [] // 每次 exec() 按序消费一组查询结果
  page.__setDataLog = []
  page.setData = function (patch, cb) {
    Object.keys(patch).forEach((k) => {
      if (k.indexOf('.') >= 0) {
        setPath(page.data, k, cloneDeep(patch[k]))
      } else {
        page.data[k] = cloneDeep(patch[k])
      }
    })
    page.__setDataLog.push(Object.keys(patch))
    if (cb) setTimeout(cb, 0)
  }
  page.createSelectorQuery = function () {
    let pending = []
    const chain = {
      select(sel) {
        pending.push({ kind: 'select', sel: sel })
        return chain
      },
      selectAll(sel) {
        pending.push({ kind: 'selectAll', sel: sel })
        return chain
      },
      boundingClientRect() {
        return chain
      },
      exec(cb) {
        const results = page.__queryResults.shift() || []
        setTimeout(() => cb(results), 0)
        return chain
      }
    }
    return chain
  }
  Object.keys(config).forEach((key) => {
    const v = config[key]
    if (key === 'data') return
    if (typeof v === 'function') {
      page[key] = v.bind(page)
    } else {
      page[key] = cloneDeep(v)
    }
  })
  return page
}

// ---------- 项目模块加载 ----------
function bootApp(opts) {
  opts = opts || {}
  if (opts.noCloud) delete global.wx.cloud
  require(path.join(ROOT, 'app.js'))
  const appConfig = state.apps[state.apps.length - 1]
  state.app = instantiatePage(appConfig)
  state.app.onLaunch()
  return state.app
}

function loadPage(rel) {
  require(path.join(ROOT, rel))
  const config = state.pages[state.pages.length - 1]
  return instantiatePage(config)
}

function loadCloudFunction(name) {
  return require(path.join(ROOT, 'cloudfunctions', name, 'index.js'))
}

function launchIndexPage(opts) {
  opts = opts || {}
  bootApp({ noCloud: opts.noCloud })
  const page = loadPage('pages/index/index.js')
  page.onLoad()
  return page
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// 轮询等待条件成立（浮动的异步刷新、弹层回调后重载等场景）
async function waitFor(fn, timeout) {
  const deadline = Date.now() + (timeout || 1500)
  for (;;) {
    if (fn()) return true
    if (Date.now() > deadline) return false
    await sleep(10)
  }
}

function openCloudFunctions() {
  // 注册真实云函数供 wx.cloud.callFunction 分发（模拟「云函数已部署」场景）
  global.wx.__state.cloudFunctions = {
    manageGuests: loadCloudFunction('manageGuests').main,
    manageBlessings: loadCloudFunction('manageBlessings').main,
    manageConfig: loadCloudFunction('manageConfig').main
  }
}

module.exports = {
  state,
  reset,
  waitFor,
  bootApp,
  loadPage,
  loadCloudFunction,
  launchIndexPage,
  openCloudFunctions,
  sleep,
  cloneDeep,
  ROOT
}

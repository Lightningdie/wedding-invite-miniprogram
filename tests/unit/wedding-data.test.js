const fs = require('fs')
const path = require('path')
const { describe, it, beforeEach, assert } = require('../run.js')
const h = require('../helpers/harness.js')

describe('data/wedding.js 默认配置校验（黑盒）', () => {
  let DEFAULT
  beforeEach(() => {
    h.reset()
    DEFAULT = require(h.ROOT + '/data/wedding.js').DEFAULT_WEDDING
  })

  it('新郎新娘与日期文案齐全', () => {
    assert.ok(DEFAULT.groom && DEFAULT.bride)
    assert.ok(DEFAULT.solarDate && DEFAULT.dateLong && DEFAULT.lunarDate && DEFAULT.weekDay)
    assert.ok(DEFAULT.venueName && DEFAULT.venueHall && DEFAULT.venueAddress)
  })

  it('weddingDate 可解析且尚未过去（今天 2026-09-04）', () => {
    const target = new Date(DEFAULT.weddingDate.replace(/-/g, '/')).getTime()
    assert.ok(!isNaN(target), 'weddingDate 应可解析: ' + DEFAULT.weddingDate)
    assert.ok(target > Date.now(), '婚期应晚于当前时间')
  })

  it('weekDay 与 weddingDate 一致', () => {
    const d = new Date(DEFAULT.weddingDate.replace(/-/g, '/'))
    const names = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
    assert.equal(DEFAULT.weekDay, names[d.getDay()])
  })

  it('全部媒体资源指向静态托管 https 地址', () => {
    const base = 'https://cloud1-d1gknvmit778344ba-1327805972.tcloudbaseapp.com/'
    const check = (v, label) => {
      assert.ok(typeof v === 'string' && v.indexOf(base) === 0, label + ' 应为静态托管地址: ' + v)
    }
    check(DEFAULT.musicSrc, 'musicSrc')
    check(DEFAULT.coverImage, 'coverImage')
    check(DEFAULT.inviteImage, 'inviteImage')
    Object.keys(DEFAULT.deco).forEach((k) => check(DEFAULT.deco[k], 'deco.' + k))
    DEFAULT.photos.forEach((p, i) => check(p.src, 'photos[' + i + '].src'))
  })

  it('照片 8 张且地址不重复', () => {
    assert.equal(DEFAULT.photos.length, 8)
    const srcs = DEFAULT.photos.map((p) => p.src)
    assert.equal(new Set(srcs).size, 8)
    DEFAULT.photos.forEach((p) => {
      assert.ok(p.title && p.desc)
    })
  })

  it('流程 timeline 4 项，图标文件真实存在', () => {
    assert.equal(DEFAULT.timeline.length, 4)
    DEFAULT.timeline.forEach((item) => {
      assert.ok(item.time && item.title && item.desc && item.en)
      const iconPath = path.join(h.ROOT, item.icon.replace(/^\//, ''))
      assert.ok(fs.existsSync(iconPath), '图标应存在: ' + item.icon)
    })
  })

  it('邀请文案与交通提示非空', () => {
    assert.ok(DEFAULT.inviteLines.length >= 5)
    assert.ok(DEFAULT.inviteFiller.length >= 3)
    assert.ok(DEFAULT.stories.length >= 3)
    assert.equal(DEFAULT.transportTips.length, 2)
  })
})

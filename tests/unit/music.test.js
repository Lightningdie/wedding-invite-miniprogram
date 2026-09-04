const { describe, it, beforeEach, assert } = require('../run.js')
const h = require('../helpers/harness.js')

describe('utils/music.js 白盒', () => {
  let music
  let audioState

  beforeEach(() => {
    h.reset()
    music = require(h.ROOT + '/utils/music.js')
    audioState = h.state.wx.__state
  })

  it('playMusic 懒创建音频上下文并开始播放', () => {
    const src = 'https://example.com/bgm.mp3'
    const ok = music.playMusic(src)
    assert.equal(ok, true)
    assert.equal(audioState.audioInstances.length, 1)
    const ctx = audioState.audioInstances[0]
    assert.equal(ctx.src, src)
    assert.equal(ctx.loop, true)
    assert.equal(ctx.obeyMuteSwitch, false)
    assert.deepEqual(ctx.calls, ['play'])
  })

  it('playMusic 无 src 时返回 false 且不播放', () => {
    const ok = music.playMusic('')
    assert.equal(ok, false)
    assert.equal(audioState.audioInstances[0].calls.length, 0)
  })

  it('onPlay/onPause/onStop/onError 正确维护 isPlaying 状态', () => {
    music.playMusic('https://example.com/a.mp3')
    const ctx = audioState.audioInstances[0]
    assert.equal(music.getPlaying(), false)
    ctx.emit('play')
    assert.equal(music.getPlaying(), true)
    ctx.emit('pause')
    assert.equal(music.getPlaying(), false)
    ctx.emit('play')
    ctx.emit('stop')
    assert.equal(music.getPlaying(), false)
    ctx.emit('play')
    ctx.emit('error', { errMsg: 'no audio file' })
    assert.equal(music.getPlaying(), false)
  })

  it('toggleMusic 播放中暂停返回 false，未播放时开启返回 true', () => {
    const src = 'https://example.com/bgm.mp3'
    assert.equal(music.toggleMusic(src), true)
    const ctx = audioState.audioInstances[0]
    ctx.emit('play')
    assert.equal(music.toggleMusic(src), false)
    assert.deepEqual(ctx.calls, ['play', 'pause'])
  })

  it('playMusic 换 src 时重设音频地址', () => {
    music.playMusic('https://example.com/a.mp3')
    music.playMusic('https://example.com/b.mp3')
    const ctx = audioState.audioInstances[0]
    assert.equal(ctx.src, 'https://example.com/b.mp3')
  })

  it('destroyMusic 销毁上下文，之后重播会重建新实例', () => {
    music.playMusic('https://example.com/a.mp3')
    const ctx1 = audioState.audioInstances[0]
    music.destroyMusic()
    assert.deepEqual(ctx1.calls, ['play', 'stop', 'destroy'])
    assert.equal(ctx1.destroyed, true)
    assert.equal(music.getPlaying(), false)
    music.playMusic('https://example.com/a.mp3')
    assert.equal(audioState.audioInstances.length, 2)
    assert.equal(audioState.audioInstances[1].calls[0], 'play')
  })
})

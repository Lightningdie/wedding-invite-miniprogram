/**
 * 全局背景音乐（静态托管 mp3，打开即播、循环播放）
 */
let audioCtx = null
let isPlaying = false
// 是否处于「想播」状态：onCanplay/onEnded 兜底续播只在想播时触发
let wantPlay = false
let pendingSrc = ''

function getAudio() {
  if (!audioCtx) {
    // iOS：与其他 App 后台音乐混播不抢焦点；静音键不拦截请柬 BGM
    if (wx.setInnerAudioOption) {
      wx.setInnerAudioOption({ mixWithOther: true, obeyMuteSwitch: false, fail: () => {} })
    }
    audioCtx = wx.createInnerAudioContext()
    audioCtx.loop = true
    audioCtx.obeyMuteSwitch = false
    audioCtx.onError((err) => {
      console.log('音乐播放失败，请确认静态托管已上传 music/bgm.mp3（node .ci/upload-static.js）', err)
      isPlaying = false
    })
    audioCtx.onPlay(() => {
      isPlaying = true
    })
    audioCtx.onPause(() => {
      isPlaying = false
    })
    audioCtx.onStop(() => {
      isPlaying = false
    })
    // 冷启动自动播放主修：iOS 上音频未缓冲就绪时调 play() 会被静默忽略，
    // 导致「打开不播、点一下屏幕才播」。缓冲完成后在此补播，无需触屏。
    audioCtx.onCanplay(() => {
      if (wantPlay && !isPlaying) {
        audioCtx.play()
      }
    })
    // iOS 循环兜底：部分 iOS 版本（如 iPhone 14 Pro 实测）loop=true 对网络音频
    // 失效，播完一遍就停。loop 正常时 onEnded 不会触发；走到这里说明循环失效，
    // 手动回开头续播。
    audioCtx.onEnded(() => {
      isPlaying = false
      if (wantPlay && pendingSrc) {
        audioCtx.seek(0)
        audioCtx.play()
      }
    })
  }
  return audioCtx
}

function playMusic(src) {
  const audio = getAudio()
  if (src && audio.src !== src) {
    pendingSrc = src
    audio.src = src
  }
  if (!audio.src) {
    return false
  }
  wantPlay = true
  audio.play()
  return true
}

function pauseMusic() {
  wantPlay = false
  if (audioCtx) {
    audioCtx.pause()
  }
}

function toggleMusic(src) {
  if (isPlaying) {
    pauseMusic()
    return false
  }
  return playMusic(src)
}

function getPlaying() {
  return isPlaying
}

function destroyMusic() {
  wantPlay = false
  pendingSrc = ''
  if (audioCtx) {
    audioCtx.stop()
    audioCtx.destroy()
    audioCtx = null
    isPlaying = false
  }
}

module.exports = {
  playMusic,
  pauseMusic,
  toggleMusic,
  getPlaying,
  destroyMusic
}

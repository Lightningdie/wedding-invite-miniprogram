/**
 * 全局背景音乐（预留 mp3，上传后即可播放）
 */
let audioCtx = null
let isPlaying = false

function getAudio() {
  if (!audioCtx) {
    audioCtx = wx.createInnerAudioContext()
    audioCtx.loop = true
    audioCtx.obeyMuteSwitch = false
    audioCtx.onError((err) => {
      console.log('音乐播放失败，请确认已上传 assets/music/bgm.mp3', err)
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
  }
  return audioCtx
}

function playMusic(src) {
  const audio = getAudio()
  if (src && audio.src !== src) {
    audio.src = src
  }
  if (!audio.src) {
    return false
  }
  audio.play()
  return true
}

function pauseMusic() {
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

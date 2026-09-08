/**
 * 婚礼默认配置（后台可覆盖）
 * 媒体资源（音乐/照片/装饰图/封面）走云开发「静态托管」，不占小程序包体积
 *
 * 静态托管默认域名公网可读，直接返回普通 https 链接：
 * 不依赖 getTempFileURL，不受云存储权限规则（STORAGE_EXCEED_AUTHORITY）影响
 *
 * 配置步骤：
 * 1. 把待发布文件按目标相对路径放进 .ci/staging/（images/、images/photoes/、music/）
 * 2. 运行 node .ci/upload-static.js 上传到静态托管
 * 3. 下方 STATIC_BASE 已固定为本环境默认域名，一般无需改动
 */
const STATIC_BASE = 'https://cloud1-d1gknvmit778344ba-1327805972.tcloudbaseapp.com'
const cdn = (path) => STATIC_BASE + '/' + path

const DEFAULT_WEDDING = {
  groom: '刘浩宇',
  bride: '张婧怡',
  solarDate: '2026.9.29',
  dateLong: '2026年9月29日',
  lunarDate: '八月十九',
  weekDay: '星期二',
  ceremonyTime: '8:30',
  weddingDate: '2026-09-29 08:30:00',
  venueName: '盐山县县宾馆',
  venueHall: '五楼宴会厅',
  venueAddress: '河北省沧州市盐山县振华北大街263号',
  musicSrc: cdn('music/bgm.mp3'),
  musicTitle: '婚礼背景音乐',
  closing: '愿这份喜悦，亦能与您常在。',
  coverImage: cdn('images/firstpage.jpg'),
  inviteImage: cdn('images/secondpage.jpg'),
  // 页面装饰图（wxml 中按 {{wedding.deco.xxx}} 绑定），文件名用 ASCII，避免中文编码差异
  deco: {
    rose: cdn('images/rose.png'),
    bouquet: cdn('images/2-removebg-preview.png'),
    cake: cdn('images/3-removebg-preview.png'),
    couple: cdn('images/4-removebg-preview.png'),
    book: cdn('images/5-removebg-preview.png'),
    propose: cdn('images/propose.png')
  },
  heroLatin: 'We got married',
  inviteHeadline: 'Come for the love, stay for the wedding',
  inviteLines: [
    '致我们最亲爱的家人与朋友：',
    '相遇，是命运最温柔的安排；',
    '相守，是余生最郑重的承诺。',
    '我们决定，携手走过余生的清晨与黄昏。',
    '谨定于佳期，诚挚邀请您莅临，',
    '与我们共同见证这一刻的喜悦。'
  ],
  inviteFiller: [
    'To our family and friends,',
    'Thank you for celebrating our special day,',
    'Supporting us and sharing our love.'
  ],
  timeline: [
    { time: '08:00', en: 'Guest Arrival', icon: '/assets/images/icons/icon-arrival.png', title: '迎宾签到', desc: '欢迎各位来宾莅临，签到留影' },
    { time: '08:30', en: 'Ceremony', icon: '/assets/images/icons/icon-ceremony.png', title: '婚礼典礼', desc: '新人入场，交换戒指，庄严宣誓' },
    { time: '09:30', en: 'Photos', icon: '/assets/images/icons/icon-photos.png', title: '合影留念', desc: '与新人合影，记录美好瞬间' },
    { time: '10:00', en: 'Banquet', icon: '/assets/images/icons/icon-banquet.png', title: '喜宴开席', desc: '美酒佳肴，共庆美好时刻' }
  ],
  photos: [
    { src: cdn('images/photoes/1.jpg'), title: '初次相遇', desc: '那一刻的心动，是故事的开始' },
    { src: cdn('images/photoes/2.jpg'), title: '甜蜜日常', desc: '平凡日子里的小确幸' },
    { src: cdn('images/photoes/3.jpg'), title: '携手同行', desc: '一路相伴，走过春夏秋冬' },
    { src: cdn('images/photoes/4.jpg'), title: '共度余生', desc: '从此刻起，执子之手与子偕老' },
    { src: cdn('images/photoes/5.jpg'), title: '约定一生', desc: '把最美的风景留给彼此' },
    { src: cdn('images/photoes/6.jpg'), title: '幸福将至', desc: '期待与你并肩走向礼堂' },
    { src: cdn('images/photoes/7.jpg'), title: '心动时刻', desc: '每个瞬间都值得珍藏' },
    { src: cdn('images/photoes/8.jpg'), title: '爱的旅程', desc: '往后余生，请多指教' },
    { src: cdn('images/photoes/9.jpg'), title: '佳偶天成', desc: '最美的祝福，是您的见证' },
    { src: cdn('images/photoes/10.jpg'), title: '喜结良缘', desc: '愿所有美好都如约而至' },
    { src: cdn('images/photoes/11.jpg'), title: '共赴喜宴', desc: '九月二十九，恭候您的光临' }
  ],
  stories: [
    {
      chapter: '第一章',
      title: '相遇',
      content: '那一年，命运悄然安排了一场相遇。从陌生到熟悉，从眼神交汇到心生欢喜——原来所有的等待，都是为了遇见对的人。'
    },
    {
      chapter: '第二章',
      title: '相知',
      content: '我们走过街角的四季，分享彼此的悲欢与梦想。有欢笑，有磨合，亦有坚定。爱情，是把一个人悄悄放进自己的未来里。'
    },
    {
      chapter: '第三章',
      title: '相守',
      content: '如今，我们决定牵手一生。并非浪漫永不落幕，而是愿与你共度柴米油盐与漫长岁月。谢谢你，成为我最终的答案。'
    }
  ],
  transportTips: [
    { icon: '🚗', text: '自驾：宾馆提供停车位，建议提前到达' },
    { icon: '🚕', text: '打车：导航至「盐山县县宾馆」即可' }
  ]
}

module.exports = {
  DEFAULT_WEDDING
}

/**
 * 婚礼默认配置（后台可覆盖）
 */
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
  latitude: 38.0725,
  longitude: 117.2365,
  musicSrc: '/assets/music/bgm.mp3',
  musicTitle: '婚礼背景音乐',
  closing: '愿这份喜悦，亦能与您常在。',
  coverImage: '/assets/images/firstpage.jpg',
  inviteImage: '/assets/images/secondpage.jpg',
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
    { time: '09:30', en: 'Banquet', icon: '/assets/images/icons/icon-banquet.png', title: '喜宴开席', desc: '美酒佳肴，共庆美好时刻' },
    { time: '11:00', en: 'Photos', icon: '/assets/images/icons/icon-photos.png', title: '合影留念', desc: '与新人合影，记录美好瞬间' }
  ],
  photos: [
    {
      src: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=600&q=80',
      title: '初次相遇',
      desc: '那一刻的心动，是故事的开始'
    },
    {
      src: 'https://images.unsplash.com/photo-1522673607200-164d1b6ce486?w=600&q=80',
      title: '甜蜜日常',
      desc: '平凡日子里的小确幸'
    },
    {
      src: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=600&q=80',
      title: '携手同行',
      desc: '一路相伴，走过春夏秋冬'
    },
    {
      src: 'https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?w=600&q=80',
      title: '共度余生',
      desc: '从此刻起，执子之手与子偕老'
    },
    {
      src: 'https://images.unsplash.com/photo-1529636798458-92182e662485?w=600&q=80',
      title: '约定一生',
      desc: '把最美的风景留给彼此'
    },
    {
      src: 'https://images.unsplash.com/photo-1519225421980-715cb0215aed?w=600&q=80',
      title: '幸福将至',
      desc: '期待与你并肩走向礼堂'
    }
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

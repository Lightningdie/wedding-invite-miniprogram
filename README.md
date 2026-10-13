# 💒 婚礼邀请函 · Amour・爱意佳期

> 刘浩宇 & 张婧怡 · 2026.09.29 · 微信小程序

<p align="center">
  <img src="./firstpage.jpg" width="32%" alt="邀请函封面"/>
&nbsp;
  <img src="./secondpage.jpg" width="32%" alt="邀请函内页"/>
</p>

一套完整的电子婚礼请柬解决方案:8 页横向翻书邀请函 + 婚礼后台管理系统,基于**微信原生小程序 + 微信云开发**构建,无需自建服务器。

## ✨ 功能特性

### 📖 邀请函(8 页横向翻书)

| 页面 | 内容 |
|:---:|---|
| 1 | **封面倒计时** — 距婚礼日期实时倒计时 |
| 2 | **诚挚邀请** — 邀请文案 |
| 3 | **婚礼信息** — 时间、地点一览 |
| 4 | **甜蜜相册** — 婚纱照专页 |
| 5 | **我们的故事** — 恋爱时间线 |
| 6 | **地点导航** — 一键唤起微信地图导航 |
| 7 | **婚礼流程** — 当日流程安排 |
| 8 | **祝福留言** — 宾客提交祝福,实时上墙 |

交互细节:

- 每 18 秒自动翻页,手动翻页后重新计时
- 关闭音乐 → 同时取消自动翻页;再次开启音乐可恢复
- 横向慢速翻书过渡(约 1.2s)+ 透明度渐变
- 页面组件从左/右/上/下四方向缓入,由虚到实
- 中文楷体/宋体按需子集化(829 字)内嵌,安卓机字体表现一致

### 🛠 婚礼后台

在邀请函右上角**长按音乐按钮**即可进入:

| 模块 | 功能 |
|---|---|
| 📊 数据看板 | 祝福数、宾客数、出席统计一目了然 |
| ✏️ 信息编辑 | 随时修改婚礼信息,实时同步邀请函 |
| 👥 名单管理 | 宾客名单维护与出席情况管理 |
| 💬 祝福管理 | 查看与管理宾客祝福留言 |

### ☁️ 云开发能力

- **云数据库双写** — 数据同时写入本地存储与云数据库:未开通云开发时本地兜底,开通后多端同步、换手机不丢数据
- **3 个云函数** — `manageConfig`(婚礼配置)/ `manageGuests`(宾客名单)/ `manageBlessings`(祝福留言)
- **静态托管 CDN** — 照片、音乐等大文件走腾讯云静态托管,不占用小程序 2M 包体积
- **后台入口隐藏** — 长按手势进入,宾客侧无感知

## 🔗 在线访问

| 资源 | 链接 |
|---|---|
| 📦 GitHub 仓库 | [github.com/Lightningdie/wedding-invite-miniprogram](https://github.com/Lightningdie/wedding-invite-miniprogram) |
| 🖼 相册资源(CDN 示例) | [cloud1-d1gknvmit778344ba-1327805972.tcloudbaseapp.com/images/photoes/1.jpg](https://cloud1-d1gknvmit778344ba-1327805972.tcloudbaseapp.com/images/photoes/1.jpg) |
| 🎵 背景音乐(CDN) | [cloud1-d1gknvmit778344ba-1327805972.tcloudbaseapp.com/music/bgm.mp3](https://cloud1-d1gknvmit778344ba-1327805972.tcloudbaseapp.com/music/bgm.mp3) |

> 小程序本体需在**微信客户端**中体验(开发者工具预览/真机调试);CDN 链接可直接在浏览器打开验证。

## 📁 项目结构

```text
wedding-invite-miniprogram/
├── pages/
│   ├── index/              # 邀请函主页(8 页翻书)
│   └── admin/
│       ├── home/           # 后台 · 数据看板
│       ├── edit/           # 后台 · 婚礼信息编辑
│       ├── guests/         # 后台 · 宾客名单管理
│       └── blessings/      # 后台 · 祝福留言管理
├── cloudfunctions/
│   ├── manageConfig/       # 云函数 · 婚礼配置读写
│   ├── manageGuests/       # 云函数 · 宾客名单读写
│   └── manageBlessings/    # 云函数 · 祝福留言读写
├── cloud/                  # 云数据库开通与集合设计说明
├── data/                   # 婚礼默认数据
├── utils/                  # 工具函数
├── assets/                 # 本地静态资源(图标等)
├── tests/                  # 单元测试
└── invite-card.html        # H5 版邀请卡片(设计稿)
```

## 🚀 快速开始

1. **克隆仓库**后用**微信开发者工具**导入项目(AppID 替换为自己的)
2. **开通云开发**:微信开发者工具 → 云开发 → 创建环境,将环境 ID 填入 `app.js` 的 `globalData.cloudEnv`
3. **创建云集合**:按 [cloud/README.md](./cloud/README.md) 创建 `wedding_config` / `blessings` / `guests` 三个集合
4. **部署云函数**:在开发者工具中右键 `cloudfunctions` 下三个目录 →「上传并部署」
5. **替换素材**:照片/音乐上传至云开发静态托管,字体可参考 `assets/` 内置子集方案;背景音乐放到 `assets/music/bgm.mp3`

> 💡 未开通云开发也能运行:所有数据自动降级为手机本地存储,功能完整可用。

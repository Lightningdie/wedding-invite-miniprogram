# 测试套件（零依赖）

## 运行

    node tests/run.js

自动发现 tests/ 下所有 *.test.js，顺序执行，结尾输出汇总；
全部通过退出码 0，否则 1。无需安装任何 npm 依赖，Node 18+ 即可。

## 结构

    tests/run.js               运行器 + 断言库（describe/it/beforeEach/afterEach/assert）
    tests/helpers/wx-mock.js   wx API mock：内存存储、InnerAudioContext、云开发
                               （DbMock 同时供客户端与云函数两侧使用）、toast/modal 录制器
    tests/helpers/harness.js   测试沙盒：安装全局 wx/Page/App/getApp、加载真实项目模块、
                               实例化页面（setData 点路径写入、createSelectorQuery 桩）、
                               加载云函数（拦截 wx-server-sdk）、waitFor 轮询
    tests/unit/                白盒：storage 合并与回退链、music 状态机、
                               manageGuests / manageBlessings 云函数、默认配置校验
    tests/page/                黑盒：首页（启动、倒计时、祝福提交、祝福墙、音乐、
                               手势翻页、分享）、管理页（home 聚合、edit 表单、
                               guests / blessings 增删改查）

## 说明

- 每个用例前 harness.reset() 重建全局与 require 缓存，用例间零串扰。
- 云端链路是集成式测试：客户端 storage.js 调 wx.cloud.callFunction 时，
  mock 会分发到真实云函数模块（共享同一 DbMock），完整覆盖
  「云函数 → 直连数据库 → 本地存储」三级回退。
- 名称带「已知问题存档」的用例记录的是当前实际行为（含缺陷），
  修复后应同步改断言。
- tests/ 已加入 project.config.json 的 packOptions.ignore，不会打进小程序包。

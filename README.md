# dsh-spend-trend

<img src="assets/icon-180.png" width="72" height="72" alt="dsh-spend-trend icon" align="right">

[中文](README.md) | [English](README.en.md)

DeepSeek Harness 侧边栏插件：**峰谷计费时段 + 账户余额 + 近 7 天人民币花费**。

[![npm](https://img.shields.io/npm/v/@apecube/dsh-spend-trend)](https://www.npmjs.com/package/@apecube/dsh-spend-trend)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

侧边栏底部、账户入口正上方的一个徽标：

- **当前计费时段**：`● 峰期` / `● 谷期`（官方峰谷定价），后面是距下一次切换的倒计时，最右是**账户余额**；
- 点击弹出面板：**最近 7 天花费（人民币）柱状图**、当前模型单价、今日花费、合计/日均、余额构成、峰谷时段表。

## 截图

![侧边栏徽标](https://raw.githubusercontent.com/wlerry/dsh-spend-trend/main/assets/screenshots/01-badge.png)

![展开面板](https://raw.githubusercontent.com/wlerry/dsh-spend-trend/main/assets/screenshots/02-panel.png)

## 平台支持

macOS、Windows、Linux 都能用：插件是纯 JavaScript，主机侧只用到 Node 的跨平台 API（`fs` / `os` / `path`），浏览器侧是普通 Web 组件，不含任何 shell 命令、原生依赖或平台判断。CI 在 Ubuntu、Windows、macOS 三个平台 × Node 20/22/24 上跑测试。

## 计费口径

DeepSeek 自 2026-08-17 起实行峰谷分时定价，本插件按**每次调用实际发生时刻**的档位计价（不是按天、也不是按当前时刻）：

| 模型 | 缓存命中（谷/峰） | 缓存未命中（谷/峰） | 输出（谷/峰） |
|---|---|---|---|
| deepseek-flash | ¥0.02 / ¥0.04 | ¥1 / ¥2 | ¥4 / ¥8 |
| deepseek-v4-pro | ¥0.15 / ¥0.30 | ¥4.5 / ¥9 | ¥13.5 / ¥27 |

单位：元 / 百万 tokens（[官方价目表](https://api-docs.deepseek.com/zh-cn/quick_start/pricing/)）。

- 高峰：**北京时间周一至周五 09:00–12:00、14:00–18:00**；其余时段、周末全天为谷时。
- 成本 = 未命中 × 未命中价 + （缓存读 + 缓存写）× 命中价 + 输出 × 输出价，价格取自该条 usage 发生时刻的档位。
- 未知模型按 deepseek-flash 计费。
- **中国法定节假日**默认不内置，通过 `$DSH_HOME/spend-trend-holidays.json` 配置（见下）。

## 法定节假日

官方口径里，中国法定节假日全天按谷时计价。默认没有内置节假日表（节假日前后的调休、调价都可能变），可以放一个文件让判定跟上：

```sh
# 路径：$DSH_HOME/spend-trend-holidays.json（默认 ~/.dsh/spend-trend-holidays.json）
["2026-10-01", "2026-10-02", "2026-10-03"]
```

文件不存在或格式不对时按“无节假日”处理，不影响启动。

## 峰谷提醒

面板底部可以开启切换提醒（默认关闭）：

| 设置 | 说明 |
|---|---|
| 开启提醒 | 总开关，首次开启时请求系统通知权限；拒绝则只响铃 |
| 提醒音 | 御姐音 / 萝莉音 / Ping / Chime / Bell / 静音，可试听 |
| 提前 2 分钟 | 默认关；开启后在切换前 2 分钟播一声轻提示 |

规则：**切到谷期**播你选的语音，**切到峰期**一律用 Ping；北京时间 **22:00–06:00 不播语音**，自动降级为 Ping。设置存在浏览器 `localStorage`（按设备生效），页面需要开着才会响；系统睡眠期间不会响，醒来后补一次。

## 数据来源

- **花费**：主机侧读取会话持久化日志，取 `assistant/message` 里模型上报的 `usage`，按事件时刻的峰谷档位折算成人民币，按 15 分钟切片归并成 7 天窗口。
- **余额**：复用账户插件的 `account.getBalance` 远端调用（充值 + 赠送合计）。

## 刷新方式

| 内容 | 方式 | 频率 |
|---|---|---|
| 花费 / 时段档位 | 轮询 `GET /plugin/dsh-spend-trend/daily` | 每 60 秒 |
| 余额 | 远端调用 `account.getBalance` | 每 180 秒 |
| 倒计时 | 纯本地计时 | 每秒，不发请求 |

页面切到后台时不额外请求，切回可见时补一次；倒计时归零（峰谷切换）时会立刻补拉一次，不等下一个 60 秒。

## 文件

| 文件 | 作用 |
|---|---|
| `index.js` | 插件入口：路由装配、节假日文件加载 |
| `lib/pricing.js` | 价目表、峰谷判定与按时刻计价 |
| `lib/usage.js` | 会话日志聚合 |
| `client.js` | 浏览器侧：`sidebar.footer.action` 槽位里的徽标与弹出面板 |
| `cordis.patch.yml` | 插入 `spend-trend` 插件行 |
| `locale/*.json` | 插件管理器中的标题与描述 |
| `icon.svg` | 插件列表图标（矢量：宝蓝底 + 紫色角部高光 + 折线 + 峰/谷两个色点） |
| `assets/icon-180.png` | 插件市场卡片用的 180×180 位图 |
| `assets/icon-source.png` | 图标设计原稿（1254×1254，不进 npm 包） |
| `assets/screenshots/*.png` | 市场详情页截图 |
| `screenshots.json` | 声明市场展示的截图顺序（市场从仓库读取） |
| `assets/sounds/*.m4a` | 峰谷提醒语音（御姐音 / 萝莉音） |

## 安装 / 卸载

从 npm 安装（重启 dsh web 或在桌面端刷新后生效）：

```sh
dsh plugin --profile <profile> add @apecube/dsh-spend-trend
```

直接从 GitHub 安装：

```sh
dsh plugin --profile <profile> add github:wlerry/dsh-spend-trend
```

在 DSH 桌面端也可以走 **设置 → 插件** 里的安装入口。卸载：

```sh
dsh plugin --profile <profile> remove @apecube/dsh-spend-trend
```

开发时可直接链接本地目录改动：`dsh plugin --profile <profile> add link:/path/to/dsh-spend-trend`。改动浏览器端代码后需要重新安装（或重启）才会加载新 bundle。

## 开发

```sh
node --test test/     # 11 个用例：峰谷边界、周末/节假日、两档计价、日窗口聚合、revision 缓存
```

代码分层：

| 文件 | 职责 |
|---|---|
| `lib/pricing.js` | 价目表、北京时间峰谷判定、按调用时刻计价（纯函数，无 I/O） |
| `lib/usage.js` | 会话日志折叠成 15 分钟桶、7 天窗口聚合 |
| `index.js` | 插件入口与路由装配 |
| `client.js` | 浏览器 bundle（手写，无需构建） |
| `test/` | 纯函数与聚合的单测 |

CI 在 Node 20 / 22 / 24 上跑语法检查、测试和 manifest 检查。

## 已知限制

- 价格表内置在 `lib/pricing.js`，官方调价后需同步更新（展示与计费共用同一份常量）。
- 只统计已持久化的会话日志，进程内最后一批事件可能有几十毫秒延迟。
- 路由只监听本机回环地址、不带鉴权，只暴露汇总数字，不含会话内容。

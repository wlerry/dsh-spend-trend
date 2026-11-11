# dsh-spend-trend

DeepSeek Harness 侧边栏插件：**峰谷计费时段 + 账户余额 + 近 7 天人民币花费**。

[![npm](https://img.shields.io/npm/v/dsh-spend-trend)](https://www.npmjs.com/package/dsh-spend-trend)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

侧边栏底部、账户入口正上方的一个徽标：

- **当前计费时段**：`● 峰期` / `● 谷期`（官方峰谷定价），后面是距下一次切换的倒计时，最右是**账户余额**；
- 点击弹出面板：**最近 7 天花费（人民币）柱状图**、当前模型单价、今日花费、合计/日均、余额构成、峰谷时段表。

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
- **中国法定节假日**目前未内置（官方按节假日不计峰），如需精确，可在 `index.js` 的 `HOLIDAYS` 集合里加日期。

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
| `index.js` | 主机侧：峰谷判定 + 按时刻计价 + 会话日志聚合 + HTTP 路由 |
| `client.js` | 浏览器侧：`sidebar.footer.action` 槽位里的徽标与弹出面板 |
| `cordis.patch.yml` | 插入 `spend-trend` 插件行 |
| `locale/*.json` | 插件管理器中的标题与描述 |
| `icon.svg` | 插件图标 |
| `assets/icon-180.png` | 插件市场卡片用的 180×180 位图 |

## 安装 / 卸载

从 npm 安装（重启 dsh web 或在桌面端刷新后生效）：

```sh
dsh plugin --profile <profile> add dsh-spend-trend
```

直接从 GitHub 安装：

```sh
dsh plugin --profile <profile> add github:fylz1125/dsh-spend-trend
```

在 DSH 桌面端也可以走 **设置 → 插件** 里的安装入口。卸载：

```sh
dsh plugin --profile <profile> remove dsh-spend-trend
```

开发时可直接链接本地目录改动：`dsh plugin --profile <profile> add link:/path/to/dsh-spend-trend`。改动浏览器端代码后需要重新安装（或重启）才会加载新 bundle。

## 已知限制

- 价格表内置，官方调价后需同步 `index.js` 的 `PRICING`（展示与计费同一份常量）。
- 只统计已持久化的会话日志，进程内最后一批事件可能有几十毫秒延迟。
- 路由只监听本机回环地址、不带鉴权，只暴露汇总数字，不含会话内容。

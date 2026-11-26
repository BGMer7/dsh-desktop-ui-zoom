# dsh-desktop-ui-zoom

[![Check](https://github.com/BGMer7/dsh-desktop-ui-zoom/actions/workflows/check.yml/badge.svg)](https://github.com/BGMer7/dsh-desktop-ui-zoom/actions/workflows/check.yml)

把桌面窗口里被取消的**整页缩放**补回来：用 CSS `zoom` 把应用根节点 `#root` 整体缩放，
文字、图标、间距、按钮一起变大，而不是只改字号。

[English](README.md) | [中文](README.zh.md)

## 为什么需要它

`0.2.2` 起桌面 runtime 把 `Cmd/Ctrl + =`、`Cmd/Ctrl + -` 注册成固定快捷键，只改
**正文 / 代码 / 终端**字号（见 `@deepseek-ai/dsh-client-ui-theme` 的
`installFontSizeShortcuts`：「Desktop 的固定快捷键……Web 保留浏览器的缩放快捷键」）；
同一个版本的新桌面壳的菜单只有 文件 / 编辑 / 窗口，没有「显示 → 放大」，
主进程里也从未调用过 `setZoomFactor`。所以窗口级缩放没有入口了 —— 这个插件补一个。

## 安装

在 DeepSeek Harness 中打开 **插件 → 添加**，输入以下任一安装源：

- npm 包（发布后）：`dsh-desktop-ui-zoom`
- GitHub 仓库：`github:BGMer7/dsh-desktop-ui-zoom`

安装后按 `Cmd + R` 刷新或重启应用生效。

## 快捷键

| 操作 | 键 |
| --- | --- |
| 放大一档 | `Cmd` + `Option` + `=` |
| 缩小一档 | `Cmd` + `Option` + `-` |
| 回到 100% | `Cmd` + `Option` + `0` |

档位：100% / 110% / 120% / 130% / 140% / 150% / 160% / 175% / 200%，默认 120%，
选择记在 `localStorage` 的 `dsh-desktop-ui-zoom.level`。这三条也会出现在快捷键参考里。

## 档位提示

每次按键在窗口顶部居中弹一条 `整体界面 130%`，1.2 秒后自动淡出：

- 到顶时显示 `整体界面 200%（已到最大）`；在 100% 再按缩小同样会提示一次，避免以为按键失灵。
- 页面加载时如果上次不是 100%，开场 0.4 秒后提示一次，顺带证明插件在工作。
- 提示挂在 `document.body` 上（不在 `#root` 缩放子树里），所以它本身永远是 13px、不会被
  自己的缩放放大，位置和菜单一样走视觉坐标。
- 颜色取自主题 token（`--dsw-alias-bg-overlay` / `label-primary` / `border-l2`），跟随浅色/深色。

原来的 `Cmd + =` / `Cmd + -` 仍然按官方设计改字号，两个快捷键可以叠用。

## 实现与取舍

- `#root { zoom: var(--dsh-desktop-ui-zoom, 1) }`：布局按缩放后的视口重排，右/下对齐的元素
  仍然贴边，`position: fixed` 的子元素照样贴底 —— 行为接近浏览器整页缩放。
- **frame 的 `getBoundingClientRect` 要换算回布局像素**。CSS `zoom` 只改视觉像素，
  zoom=1.2 时 frame 的 rect 仍报 1280，而 `offsetWidth` 只有 1067；`ui-layout` 拿
  rect 当 `viewportWidth`，于是右侧栏按 1280 算 45%（576 布局 px，视觉占 54%），
  拖动把手也按 1280 摆位置、落到面板内侧 —— 表现为「一点开就占半屏、还拖不动」。
  插件只给 frame 这一个元素打上 `data-dsh-desktop-ui-zoom-frame` 并除回 zoom，量到的宽度
  与实际布局一致，把手重新贴边。**只改这一个元素**：菜单等 portal 挂在
  `document.body`（不在缩放子树里），仍按视觉坐标定位，不受影响。
- frame 必须被缩放一次才会重新测量，所以标记后会做一次 0.5px 的瞬时内边距微扰，
  下一帧撤销。
- **全屏浮层单独缩放**：设置面板、插件管理器这类 modal 走 `createPortal(..., document.body)`，
  容器是 `position:fixed;inset:0`，不在 `#root` 缩放子树里。插件会在 `body` 直接子元素里识别
  「固定定位且铺满视口」的容器并单独 zoom（面板本身按 px 定尺寸，会等比放大；容器 inset:0
  自动铺满，不会溢出）。
- `100vh` / `100vw` 在 zoom 内不跟着缩放，少数用于 `max-height` 约束的浮层
  （dock 浮窗）可能略微超出窗口，属已知小瑕疵。
- 视口变窄是整页缩放的正常结果：缩放到 ≥1.3 时有效视口低于 1024px，DSH 会把左侧栏
  自动收成图标栏。

## 调默认值

改 `client.js` 里的 `DEFAULT_STEP`（索引，`2` = 1.2 倍）或 `STEPS` 数组。

## 卸载

插件管理里移除 `dsh-desktop-ui-zoom` 即可；根节点上的 `--dsh-desktop-ui-zoom` 变量和样式表会随插件
卸载一起清掉。

## 更新记录

See [CHANGELOG.md](CHANGELOG.md).

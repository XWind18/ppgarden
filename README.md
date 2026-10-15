# PPGarden · 云上花匠油猴脚本

正式脚本：[ppgarden-task-layout.user.js](ppgarden-task-layout.user.js)，当前版本 **1.8.4**。

仓库：<https://github.com/XWind18/ppgarden>。公开读取，写入由 GitHub 仓库权限控制。

## 安装与更新

**[安装／更新脚本](https://raw.githubusercontent.com/XWind18/ppgarden/main/ppgarden-task-layout.user.js)**

- 桌面：安装 Tampermonkey 等脚本管理器，再打开上面的链接安装，访问 <https://ppgarden.top/> 使用。
- iPhone／iPad：在 Safari 打开安装链接，再打开 Userscripts 扩展，按安装提示安装或更新。也可将 `.user.js` 文件保存到 Userscripts 的脚本目录。
- 已从本地文件安装的版本，先通过此链接覆盖更新一次，让脚本携带 GitHub 更新地址；避免同时启用两份同名脚本。
- Tampermonkey 按管理器的更新设置检查新版本，也可在管理器中手动检查更新。
- Userscripts 在扩展的「可用更新」中查看并应用新版本；未检测到时，可重新打开安装链接覆盖更新。安装及更新方式见 [Userscripts 官方说明](https://github.com/quoid/userscripts#usage)。

脚本使用 `@version` 检测版本，`@updateURL` 指向轻量的 `.meta.js`，`@downloadURL` 指向完整的 `.user.js`。安装时只需 `.user.js`；截图组件由脚本管理器按脚本声明加载。后续安装链接保持固定，无需部署服务器。

## 发布新版本

1. 修改正式脚本，将 `@version` 改为更高的版本，并更新本说明中的版本号。
2. 同步检测文件并检查语法：

   ```sh
   node scripts/sync-metadata.mjs
   node --check ppgarden-task-layout.user.js
   node --check ppgarden-task-layout.meta.js
   git diff --check
   ```

3. 查看并提交改动，推送到 `main`；发布脚本和 `.meta.js` 时使用同一次提交，保证版本一致：

   ```sh
   git add ppgarden-task-layout.user.js ppgarden-task-layout.meta.js README.md
   git diff --cached
   git commit -m "Release v1.8.5"
   git push origin main
   ```

提交信息中的版本号按实际版本调整。首次从终端推送需要配置该 GitHub 账号的 Git 身份验证。

## 文件存放

```text
ppgarden/
├── README.md                         # 使用说明和文件入口
├── .gitignore                        # 本地预览及导出文件不纳入版本控制
├── ppgarden-task-layout.user.js       # 唯一正式安装脚本
├── ppgarden-task-layout.meta.js       # 版本检测文件
├── scripts/                          # 元数据同步工具
├── tests/                            # 浏览器自检脚本
├── previews/                         # 本地界面与功能预览
└── exports/                          # 本地已生成的完整 PNG 长图
```

- 正式脚本始终保留在根目录，更新时直接修改同一个文件。
- 自检脚本放在 `tests/`，使用 `ppgarden-功能名.self-check.js` 命名。
- 界面截图、对比图、移动端预览放在 `previews/`。
- 导出或复制生成的完整长图放在 `exports/`。
- 历史预览和长图仅供参考，可能与当前版本的设置不同。
- 公共仓库包含正式脚本、版本检测文件、说明、同步工具和自检代码；`previews/` 与 `exports/` 是本地调试产物，不纳入版本控制。

## 使用要点

- 任务中心右下角提供「任务设置」和「复制长图」。
- 手机悬浮按钮自动避开网站底部菜单，菜单上方保留至少12px间距；状态提示、设置窗与页面底部留白同步调整。菜单隐藏后恢复原间距，窗口尺寸、滚动和可视视口变化时重新定位。
- 设置窗支持每行数量、卡片最大宽度、最小高度、信息显示和筛选；任务中心另有背景色开关。
- 任务中心的「任务样式」使用并排的「新版／经典版」双选按钮，直接点选即生效，选中项显示边框与勾选标记；支持手机触控、键盘和深浅色主题。新版为原有图文布局，经典版为2px密排小卡片、内容居中、积分在下方、倒计时／进度放在底部。升级脚本后保留已有设置，首次使用继续默认新版。
- 在「任务设置」点击「经典方案」，一键使用经典版、浅色截图、默认排序、3列、最大190px和最小60px，显示任务图片、编号、任务内容、积分、类型、接取／升级人、进度和倒计时。任务图片以24px小图居中显示在内容上方，默认隐藏培育状态、任务状态和预约提示，仍可逐项勾选；「截图方案」可恢复新版图文方案。
- 更新后继续沿用已保存的字段设置；旧经典方案未显示图片时，可重新点击「经典方案」，或直接勾选「任务图片」。图片可随时取消勾选，页面、导出和复制同步生效。
- 「他人升级」读取原页面的升级人姓名，直接显示为「昵称 升级」，合并重复的升级人提示，新版、经典版及长图同步生效。取消「接取／升级人」勾选或原页面未提供姓名时，保留「他人升级」；隐藏「任务类型」后仍可单独显示升级人，不会将接取人当成升级人。
- 经典版按任务状态配色：可接取浅绿、待刷新米黄、已接取浅粉，深色主题使用对应暗色；「显示背景色」开关控制配色。新版继续按升级前的原始分配色。页面、导出和复制使用同一份任务样式设置。
- 任务卡片默认每行 **3** 个、最大宽度 **190px**、最小高度 **60px**，默认勾选任务图片；「截图方案」也使用这组参数并显示图片。已保存的设置会继续沿用，点击「恢复默认」可应用新的默认值。
- 窄卡片缩小图片与间距，任务内容和接取人完整换行；每行按最高卡片自动撑高。手机设置窗提供至少44px触控区域和16px输入字号，打开时不会自动聚焦数字输入框。
- 任务中心支持导出 PNG 和复制长图，清晰度范围 **1–3 倍**，默认 **2 倍**，可输入小数。
- 截图主题独立于页面主题，默认浅色，可切换深色。
- 手机和 PC 的长图统一使用桌面布局，读取设置中的当前列数、最大宽度和最小高度。短任务文本单行显示，过长时自动换行并完整展示；最小高度是下限，内容较多时每行仍会自动撑高。
- 任务中心顶部提供三张独立时间卡片，依次显示「同步时间／下次任务刷新／当前时间」，长图第三张改为「截图时间」。标签与数值分行，数字使用等宽字体；截图中的三张时间卡片与任务卡片等宽，跟随当前列数排布。花圃保留原有时间行。
- 同步时间读取原页面已有字段；下次刷新时间取页面已加载的待刷新任务中最短的有效倒计时，换算为具体日期时间，支持跨天。脚本内隐藏倒计时或筛选任务不会影响读取；页面没有待刷新任务时显示「暂无待刷新任务」，无法读取倒计时时显示「未获取」。
- 花圃支持独立显示设置与筛选，导出和复制长图仅用于任务中心。

## 自检文件

| 文件 | 检查内容 |
| --- | --- |
| [任务布局](tests/ppgarden-task-layout.self-check.js) | 列数、尺寸、信息显隐、筛选、配色和设置保存 |
| [花圃布局](tests/ppgarden-land-layout.self-check.js) | 花圃尺寸、显示字段、筛选和独立设置 |
| [导出与复制](tests/ppgarden-export.self-check.js) | PNG、主题、剪贴板替身及异常处理 |
| [图片](tests/ppgarden-images.self-check.js) | 懒加载图片和长图像素 |
| [iOS 接口兼容](tests/ppgarden-ios.self-check.js) | 脚本管理器接口替身与复制调用时机 |
| [清晰度倍数](tests/ppgarden-scale.self-check.js) | 倍数范围、默认值、保存和输出尺寸 |
| [同步时间](tests/ppgarden-sync-time.self-check.js) | 同步字段变化、刷新倒计时解析、跨天、缺失恢复、三张时间卡片及截图等宽 |
| [手机布局](tests/ppgarden-mobile.self-check.js) | 长标题换行、倒计时、等高、触控尺寸、设置焦点、截图读取当前尺寸和长图复制 |
| [底部菜单避让](tests/ppgarden-navigation.self-check.js) | 菜单显隐、尺寸和位置变化、动态插入、按钮与设置窗间距及菜单点击区域 |
| [经典版](tests/ppgarden-classic.self-check.js) | 升级人姓名及显隐、动态更新、24px任务图片与PNG图片像素、样式切换、经典方案、状态配色、三时间等宽、字段与筛选、设置保存、花圃隔离、深浅色PNG及当前尺寸 |

这些自检脚本需要在对应的本地浏览器测试页中执行，测试页须包含页面快照、原站样式、所需测试夹具和脚本管理器接口替身。截图检查还需要加载脚本声明的 html2canvas-pro。`tests/` 中的文件不能直接作为 Node.js 测试运行，也不应注入正在使用的真实业务页面。

在本目录执行以下命令可检查 JavaScript 语法：

```sh
node --check ppgarden-task-layout.user.js
for file in tests/*.self-check.js; do
  node --check "$file" || exit 1
done
```

本地浏览器检查不代表真实网站安装或 iPhone 真机验证；实际剪贴板写入仍受浏览器权限限制。

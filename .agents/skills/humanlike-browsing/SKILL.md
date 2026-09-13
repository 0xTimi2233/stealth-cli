---
name: humanlike-browsing
description: 驱动无头浏览器执行拟人化交互；当需要穿透安全质询、维护持久登录态或并发隔离会话时使用
---
驱动无头浏览器完成会话隔离与拟人化交互，穿透安全质询并达成业务目标

## 流程

### 1. 会话筹备

声明独立任务会话名以隔离并发进程：

每次启动必须指定显式会话标识，例如 `--session worker-<task_id>`，底层默认分配独立随机硬件指纹与临时沙箱运行。若任务要求复用特定账号或维护登录态，按需查阅 [persistent-profiles.md](./references/persistent-profiles.md)

### 2. 访问页面

携带会话参数执行 `open <url>` 导航至目标路由，随后执行 `snapshot -i` 获取首屏可交互元素快照

### 3. 安全质询穿透

观察操作按钮状态与页面可用性：

- 操作按钮处于启用状态或已呈现目标业务视图：进入后续步骤
- 操作按钮处于禁用状态且存在安全质询：优先执行轻量复选框自愈；若遇字符扭曲验证码、滑块或复杂质询，按需查阅 [captcha-handling.md](./references/captcha-handling.md) 执行针对性处理与阻断判定

### 4. 业务交互

若任务仅需读取或提取页面数据，直接解析快照内容并进入释放环节；若需执行表单输入与提交：

- 文本输入：优先执行 `fill <input_ref> "<text>"` 原子填入；若页面有特殊按键监听，执行 `click <input_ref>` 聚焦后执行 `keyboard type "<text>"`
- 提交表单：执行 `press Enter` 或 `click <submit_ref>` 确认提交

### 5. 会话释放

操作结束后统一执行 `close` 释放当前浏览器会话进程

# 持久化环境管理与挂载

当任务要求使用指定账号、复用已登录 Cookie 或维护长期环境权重时，通过 `stealth-cli` 调度持久环境

## 操作流程

### 1. 环境确认

执行 `stealth-cli list` 检索已有环境列表；若目标环境不存在，执行 `stealth-cli create <name>` 创建新环境，底层自动分配专属种子与物理隔离目录

### 2. 会话挂载启动

通过前置声明 `PRISM_PROFILE` 或 `STEALTH_PROFILE` 环境变量将执行会话与目标持久环境绑定：
- 以环境名称挂载：`PRISM_PROFILE="<name>" agent-browser --session <id> open <url>`
- 指定特定引擎挂载：`STEALTH_ENGINE=cloak PRISM_PROFILE="<name>" agent-browser --session <id> open <url>`

### 3. 生命周期纪律

持久环境承载真实账号数据与登录凭据，操作结束后统一执行 `close` 释放当前会话进程，严禁执行删除操作，确保持久目录与 Cookie 留存

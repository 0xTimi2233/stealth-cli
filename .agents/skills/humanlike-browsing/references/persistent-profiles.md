# 持久化环境管理与挂载

当任务要求使用指定账号、复用已登录 Cookie 或维护长期环境权重时，通过 `stealth-cli` 创建持久环境

## 操作流程

### 1. 环境确认

执行 `stealth-cli list` 检索已有环境列表；若目标环境不存在，执行 `stealth-cli create <name>` 创建新环境，底层自动分配专属种子与物理隔离目录

### 2. 会话挂载启动

启动浏览器并挂载目标环境，必须显式指定任务会话标识以确保进程与通信隔离：

```bash
agent_browser --profile <name> --session worker-<task_id> open <url>
```

启动完成后，后续快照与交互动作统一携带该会话标识推进业务：

```bash
agent_browser --session worker-<task_id> snapshot -i
```

### 3. 生命周期纪律

持久环境承载真实账号数据与登录凭据，操作结束后统一执行对应会话的关闭释放，严禁执行删除操作，确保持久目录与 Cookie 留存：

```bash
agent_browser --session worker-<task_id> close
```

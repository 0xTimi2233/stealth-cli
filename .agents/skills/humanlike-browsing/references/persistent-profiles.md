# 持久化环境管理与挂载

当任务要求使用指定账号、复用已登录 Cookie 或维护长期环境权重时，通过 `stealth-cli` 创建持久环境

## 操作流程

### 1. 环境确认与创建

执行 `stealth-cli list` 检索已有环境列表；若目标环境不存在，执行 `stealth-cli create <name>` 创建新环境，底层自动分配专属种子与物理隔离目录

### 2. 会话挂载启动

所有命令必须始终携带 Profile 与 Session：

```bash
agent_browser --profile <name> --session <task_id> open <url>
```

Profile 内 session 可以并发，各并发任务根据需要分配独立会话标识，共享该 Profile 的持久登录态与固定指纹

### 3. 环境资产留存纪律

持久环境承载真实账号数据与登录凭据，操作结束后按常规流程关闭会话即可，严禁删除 Profile 实体，确保持久目录与 Cookie 留存

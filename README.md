# stealth-cli

通用隐形浏览器调度套件与自动化代理层，采用纯编排（Pure Orchestration）架构统一管理 Prism Browser（Chromium 144）与 CloakBrowser（Chromium 145/146）双隐形内核，负责浏览器环境 Profile 生命周期管理以及自动化测试框架的内核调度

## 核心架构

项目严格遵循 **DDD + 端口与适配器（六边形架构） + 业务垂直切片**：

- `src/domain/`：领域实体与类型定义（Profile、LaunchRequest、LaunchResult），以环境名称 `name` 为唯一主键
- `src/port/`：抽象出站端口契约（`EnginePort`、`ProfileStorePort`、`ConfigPort`）
- `src/adapter/`：各引擎独立目录隔离，内置 ACL 防腐层与统一软链解析（`kernel-resolver.ts`），正式集成 `cloakbrowser` 官方库并内聚 Prism 参数算法
- `src/features/`：端到端业务垂直切片（`profile/`、`launcher/`、`cli/`），切片自带单元测试
- `tests/`：双层 TDD 外层，集成测试与基于真实 `agent-browser` 驱动的确定性无头 E2E 测试

## 配置文件规范

全局配置文件位于 `~/.stealth/config.toml`：

```toml
# ~/.stealth/config.toml

# 当前激活引擎 (可选: "prism" | "cloak")
engine = "prism"

[engines.prism]
# Prism 内核真实原始绝对路径
binary_path = "/Applications/Prism Browser.app/Contents/Resources/kernels/current/Chromium.app"

[engines.cloak]
# Cloak 内核真实原始绝对路径
binary_path = "~/.cache/cloakbrowser/chromium-v145.0.7632.109.2/Chromium.app"

[defaults.fingerprint]
timezone = "Asia/Tokyo"
language = "en-US"
accept_languages = "en-US,en"
screen_width = 1440
screen_height = 900
```

## 物理存储与软链自愈规范

1. **按 Adapter 隔离存储**：
   - Prism 数据：`~/.stealth/vault/prism/profiles/<name>/user-data`
   - Cloak 数据：`~/.stealth/vault/cloak/profiles/<name>/user-data`
   隔离不同 Chromium 内核版本的用户数据目录，避免数据格式冲突。
2. **统一软链自愈**：
   系统启动或执行 `stealth-cli install [engine]` 时，自动根据配置的 `binary_path` 在 `~/.stealth/engines/<engine>/` 下建立并校验规范软链。

## 环境变量

| 变量名 | 默认值 | 说明 |
| :--- | :--- | :--- |
| `STEALTH_HOME` | `~/.stealth` | stealth-cli 根配置与存储目录 |
| `STEALTH_ENGINE` | 读 config.toml | 动态覆盖当前激活引擎（`prism` \| `cloak`） |
| `PROFILE` | - | Launcher 默认绑定的目标 Profile 名称 |
| `AGENT_BROWSER_EXECUTABLE_PATH` | - | 指定为 `/usr/local/bin/stealth-launcher` 供 agent-browser 挂载 |

## CLI 指令契约

所有 CLI 命令成功时通过 stdout 输出标准纯单行 JSON 字符串；异常时通过 stderr 输出错误信息并以状态码 1 退出，对 AI Agent 零上下文噪音

### 1. 列出环境配置

```bash
stealth-cli list
```

输出格式：
```json
[
  {
    "name": "worker-1",
    "seed": 264991,
    "timezone": "Asia/Tokyo",
    "language": "en-US",
    "acceptLanguages": "en-US,en",
    "screenWidth": 1440,
    "screenHeight": 900,
    "createdAt": "2026-08-29T14:14:27.838Z",
    "updatedAt": "2026-08-29T14:14:27.838Z"
  }
]
```

### 2. 创建环境配置

创建独立 Profile 及其对应的物理隔离数据目录：

```bash
stealth-cli create <name> [--timezone <tz>] [--language <lang>] [--proxy <url>]
```

输出格式：
```json
{
  "success": true,
  "name": "worker-1",
  "engine": "prism"
}
```

### 3. 删除环境配置

删除指定的 Profile 记录及其对应的数据目录：

```bash
stealth-cli delete <name>
```

输出格式：
```json
{
  "success": true
}
```

### 4. 获取官方启动参数

获取由当前选定引擎官方算法生成的完整指纹注入启动参数列表：

```bash
stealth-cli launch-args [--profile <name>]
```

输出格式：
```json
[
  "--user-data-dir=/Users/.../.stealth/vault/prism/profiles/worker-1/user-data",
  "--fingerprint=264991",
  "--fingerprint-platform=macos",
  "--lang=en-US",
  "--accept-lang=en-US,en",
  "--timezone=Asia/Tokyo",
  "--fingerprint-render-identity=v4"
]
```

### 5. 自动预装/就绪内核

自动检测、下载并自愈建立指定引擎的规范软链：

```bash
stealth-cli install [engine]
```

输出格式：
```json
{
  "success": true,
  "engine": "cloak",
  "kernelPath": "/Users/.../.stealth/engines/cloak/Chromium.app/Contents/MacOS/Chromium"
}
```

## 自动化框架与 agent-browser 集成

### 1. 与 agent-browser 集成（推荐）

在 `~/.zprofile` 中配置：
```bash
export AGENT_BROWSER_EXECUTABLE_PATH="/Users/sony/.local/bin/stealth-launcher"
```

在日常执行或 Agent 调度时：
```bash
# 挂载指定环境运行
PROFILE="worker-1" agent-browser open https://example.com
```

### 2. 与 Playwright 集成

直接将 Launcher 指定为可执行程序路径：

```typescript
import { chromium } from 'playwright'

const browser = await chromium.launch({
  executablePath: '/usr/local/bin/stealth-launcher',
  args: ['--profile=worker-1'],
})
```

## 安装与分发形式

Release 页面同时提供两种生产级分发产物，供不同场景按需选择：

### 模式 A：轻量单文件脚本（推荐，仅 ~127 KB）
适合本地开发机或已安装 Bun 的机器，零多余体积开销：
```bash
curl -L https://github.com/0xTimi2233/stealth-cli/releases/latest/download/stealth-cli.js -o /usr/local/bin/stealth-cli
chmod +x /usr/local/bin/stealth-cli
ln -sf /usr/local/bin/stealth-cli /usr/local/bin/stealth-launcher
```

### 模式 B：独立单文件二进制（~50 MB）
适合远程裸机或容器，无需目标机器安装 Node.js 或 Bun：
```bash
# Linux x64
curl -L https://github.com/0xTimi2233/stealth-cli/releases/latest/download/stealth-cli-linux-x64 -o /usr/local/bin/stealth-cli

# macOS (Apple Silicon)
curl -L https://github.com/0xTimi2233/stealth-cli/releases/latest/download/stealth-cli-darwin-arm64 -o /usr/local/bin/stealth-cli

chmod +x /usr/local/bin/stealth-cli
ln -sf /usr/local/bin/stealth-cli /usr/local/bin/stealth-launcher
```

## 工程验证

```bash
# 代码格式化与格式校验
bun run fmt
bun run fmt:check

# 代码规范与 TypeScript 严格编译
bun run check

# 执行双层测试套件
bun test

# 编译独立单文件二进制
bun run build
```

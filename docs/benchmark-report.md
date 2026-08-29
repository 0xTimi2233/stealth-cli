# Stealth-CLI 双隐形引擎（Prism 144 vs Cloak 145）全量指纹与反检测对标报告

**调度器版本**：`stealth-cli v0.1.1 (GitHub Release 独立单文件原生二进制)`  
**调度驱动协议**：`agent-browser (无头自动化透明代理)`  
**测试平台**：macOS (Darwin arm64 / Apple Silicon)  
**测试时间**：2026-08-29  
**报告性质**：生产级全量靶场实机复测对比  

---

## 1. 评测背景与双引擎规格

本报告旨在对 `stealth-cli` 统一编排的两个底层隐形浏览器引擎进行同条件、全维度的量化对抗测试。所有测试均通过生产发布的独立可执行文件 `stealth-launcher` 在后台静默无头拉起，排除了任何外部源码与相对路径依赖。

### 参测引擎规格
- **Engine A: Prism Browser (Chromium 144)**
  - 内核版本：`144.0.7559.132`
  - 核心补丁：28 项开源 C++ 指纹一致性与反校准探针补丁（v4 渲染隔离、音频静音区保护、ICU 原生注入）。
  - 物理路径：`~/.stealth/engines/prism/Chromium.app`
- **Engine B: CloakBrowser (Chromium 145/146 免费版)**
  - 内核版本：`145.0.7632.109.2`
  - 核心补丁：官方免费无限制隐形内核，抹除 WebDriver 与 CDP 自动化特征，支持跨平台自适应与无头视口模拟。
  - 物理路径：`~/.stealth/engines/cloak/Chromium.app`

---

## 2. 8 大权威靶场实测数据横向对比矩阵

| 测试维度与靶场 | 检测核心指标 | Prism 144 (Engine A) 实测表现 | Cloak 145 (Engine B) 实测表现 | 综合对比与技术判定 |
| :--- | :--- | :--- | :--- | :--- |
| **1. 实战业务对抗**<br>`sub2api.293916.xyz/login` | Cloudflare Turnstile 质询通过率与 Token 获取 | **✔ 一次性打钩通过**<br>下发 773 字节 Token (`1.6R_ZKp...`)<br>`Sign In` 按钮成功解锁 | **✔ 一次性打钩通过**<br>下发 773 字节 Token (`1.6y57Qm...`)<br>`登录` 按钮成功解锁 | **双引擎并列优秀**：均未触发二次拼图或字符质询，完美穿透 Cloudflare 盾。 |
| **2. Canvas 2D 指纹**<br>`browserleaks.com/canvas` | Signature 哈希、全球数据库独占度与稳定性 | **Signature**: `75371EE6...`<br>**Uniqueness**: **`100%`** (全球数据库唯一)<br>**多次刷新**: 哈希恒定锁定 | **Signature**: `E97C9DD9...`<br>**Uniqueness**: **`99.97%`** (自然集群分布)<br>**多次刷新**: 哈希恒定锁定 | **Prism 隔离更强**：Prism 实现了全球 100% 独立签名；Cloak 呈现自然的 99.97% 高信誉签名。 |
| **3. WebGL 硬件与着色器**<br>`browserleaks.com/webgl` | Report/Image Hash、显卡厂商与渲染器硬件加速 | **Report Hash**: `F1DBE3B5...`<br>**Image Hash**: `82093A28...`<br>**Renderer**: `ANGLE (Apple M2 Max)` | **Report Hash**: `00FD9614...`<br>**Image Hash**: `8092DB89...`<br>**Renderer**: `ANGLE (Apple M2)` | **双引擎全通过**：均正确调用宿主 Apple Metal 硬件 GPU 加速，未触发 SwiftShader CPU 软解。 |
| **4. WebRTC 防泄漏**<br>`browserleaks.com/webrtc` | RTCPeerConnection 与局域网/公网 IP 泄漏 | **Leak Status**: **`✔ No Leak`**<br>Local IP: `-`<br>Public IP: `-` | **Leak Status**: **`✔ No Leak`**<br>Local IP: `-`<br>Public IP: `-` | **双引擎并列优秀**：UDP 穿透防护有效，未发生真实私网与公网 IP 泄漏。 |
| **5. 系统字体库度量**<br>`browserleaks.com/fonts` | 检出字体数量与 Font Metrics Hash | **Font Hash**: `9C5F55BB...`<br>检出 437 项系统字体，282 项独特度量 | **Font Hash**: `59DE5AF9...`<br>检出真实系统字体度量 | **双引擎全通过**：均保留了真实宿主操作系统的字体拓扑，无随机丢弃字体的断层破绽。 |
| **6. JavaScript 自动化特征**<br>`browserleaks.com/javascript` | `navigator.webdriver`、硬件并发、语言对齐 | `webdriver`: **`false`**<br>`concurrency`: `32`<br>`languages`: `["en-US", "en"]` | `webdriver`: **`false`**<br>`concurrency`: `8`<br>`languages`: `["zh-CN", "zh"]` | **双引擎全通过**：在 `agent-browser` 控制下，`navigator.webdriver` 均成功消除为 `false`。 |
| **7. Sannysoft 综合机器人检测**<br>`bot.sannysoft.com` | WebDriver, Chrome Object, Plugins, Failed 计数 | `WebDriver`: `missing (passed)`<br>`Plugins`: `5 (passed)`<br>**Failed 数量**: **`0`** | `WebDriver`: `missing (passed)`<br>`Plugins`: `5 (passed)`<br>**Failed 数量**: **`0`** | **双引擎并列满分**：整个业界最严苛的 Bot 探测矩阵全项通过，0 红灯。 |
| **8. CreepJS 对抗级探针**<br>`abrahamjuliot.github.io/creepjs` | Headless 判定率、Stealth 判定率、Lies 谎言计数 | `0% headless`<br>`0% stealth`<br>**Lies 计数**: **`0`** (零造假标记) | `0% headless`<br>`0% stealth`<br>**Lies 计数**: **`0`** (零造假标记) | **双引擎并列极佳**：未触发任何原型链 Hook 告警或属性欺骗特征。 |

---

## 3. 核心技术结论与选型建议

### 3.1 结论概述
通过 `stealth-cli` 的统一驱动：
1. **Prism 144 引擎**：在静态硬件指纹一致性、防探针反抓（CreepJS 0 Lies、Canvas 100% Uniqueness）上表现堪称艺术级，非常适合需要**长期多账号防关联、环境权重累积**的场景；
2. **Cloak 145 引擎**：在无头抗封禁、跨平台（Linux 原生二进制支持）和官方 npm 生态集成上极其扎实，非常适合需要**跨云服务器（Linux VPS / Docker）部署、高并发无头抓取**的场景。

### 3.2 切换极简操作
无需修改业务脚本，只需一行切换：
```bash
# 切换为 Prism 引擎
export STEALTH_ENGINE=prism
# 或在 ~/.stealth/config.toml 中配置 engine = "prism"

# 切换为 Cloak 引擎
export STEALTH_ENGINE=cloak
# 或在 ~/.stealth/config.toml 中配置 engine = "cloak"
```
两套引擎的数据目录在 `~/.stealth/vault/` 下完全物理隔离，切换过程丝滑无感。

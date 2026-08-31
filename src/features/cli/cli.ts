#!/usr/bin/env bun
import { CloakAdapter } from '@/adapter/cloak/cloak.adapter'
import { TomlConfigAdapter } from '@/adapter/config/toml-config.adapter'
import { PrismAdapter } from '@/adapter/prism/prism.adapter'
import { FileStoreAdapter } from '@/adapter/store/file-store.adapter'
import type { StealthConfig } from '@/domain/config'
import type { EngineType } from '@/domain/launch'
import { createProfileEntity } from '@/domain/profile'
import { VERSION } from '@/domain/version'
import { launchProfile } from '@/features/launcher/launcher'
import { ProfileManager } from '@/features/profile/profile-manager'
import type { EnginePort } from '@/port/engine.port'
import type { ProfileStorePort } from '@/port/store.port'

export function getHelpText(): string {
  return `stealth-cli - 通用隐形浏览器调度套件与自动化代理层

用法:
  stealth-cli [命令] [选项]
  stealth-cli [选项] [...Chromium 参数]

可用命令:
  list                          列出所有已保存的环境配置
  create <name> [选项]          创建独立环境配置及其物理隔离数据目录
  delete <name>                 删除指定的环境配置及其对应的数据目录
  launch-args [选项]            获取当前选定引擎官方算法生成的指纹注入启动参数
  install [engine]              校验内核并自愈建立指定引擎的规范软链 (prism | cloak)
  launch [选项] [...参数]       启动指定环境或临时环境的隐形浏览器 (默认命令)

常用选项:
  -h, --help                    显示帮助说明
  -v, --version                 显示版本信息
  --profile <name>              指定目标环境名称
  --timezone <tz>               指定时区 (如 Asia/Tokyo)
  --language <lang>             指定语言 (如 en-US)
  --proxy <url>                 指定代理服务器地址

环境变量:
  STEALTH_ENGINE                动态覆盖当前激活引擎 (prism | cloak)
  STEALTH_HOME                  根配置与存储目录 (默认: ~/.stealth)`
}

export function parseOption(args: string[], flag: string): string | undefined {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === flag && i + 1 < args.length) {
      return args[i + 1]
    }
    if (arg.startsWith(`${flag}=`)) {
      return arg.slice(flag.length + 1)
    }
  }
  return undefined
}

export function extractPositionalArg(args: string[]): string | undefined {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg.startsWith('--')) {
      if (!arg.includes('=')) {
        i++ // 跳过当前 flag 对应的后续值
      }
      continue
    }
    return arg
  }
  return undefined
}

export function filterOutFlag(args: string[], flag: string): string[] {
  const result: string[] = []
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === flag) {
      i++ // 跳过值
      continue
    }
    if (arg.startsWith(`${flag}=`)) {
      continue
    }
    result.push(arg)
  }
  return result
}

export async function handleCliCommand(
  argv: string[],
  config: StealthConfig,
  store: ProfileStorePort,
  engines: Record<EngineType, EnginePort>,
): Promise<string> {
  const firstArg = argv[0]
  if (
    firstArg === 'help' ||
    firstArg === '--help' ||
    firstArg === '-h' ||
    argv.includes('--help') ||
    argv.includes('-h')
  ) {
    return getHelpText()
  }

  if (firstArg === 'version' || firstArg === '--version' || firstArg === '-v') {
    return `stealth-cli v${VERSION}`
  }

  const KNOWN_COMMANDS = new Set(['list', 'create', 'delete', 'launch-args', 'launch', 'install'])
  const command = argv[0] && KNOWN_COMMANDS.has(argv[0]) ? argv[0] : 'launch'
  const remainingArgs = KNOWN_COMMANDS.has(argv[0] ?? '') ? argv.slice(1) : argv

  const activeEngineType: EngineType = (process.env.STEALTH_ENGINE as EngineType) || config.engine
  const engine = engines[activeEngineType]
  if (!engine) {
    throw new Error(`Engine '${activeEngineType}' is not supported`)
  }

  const pm = new ProfileManager(store, activeEngineType, config.defaults)

  switch (command) {
    case 'list': {
      const profiles = await pm.list()
      return JSON.stringify(profiles)
    }

    case 'install': {
      const targetEngineType = (remainingArgs[0] as EngineType) || activeEngineType
      const targetEngine = engines[targetEngineType]
      if (!targetEngine) {
        throw new Error(`Engine '${targetEngineType}' is not supported`)
      }
      const kernelPath = await targetEngine.getKernelPath()
      return JSON.stringify({ success: true, engine: targetEngineType, kernelPath })
    }

    case 'create': {
      const name = extractPositionalArg(remainingArgs)
      if (!name) {
        throw new Error('Profile name is required for create')
      }
      const timezone = parseOption(remainingArgs, '--timezone')
      const language = parseOption(remainingArgs, '--language')
      const proxy = parseOption(remainingArgs, '--proxy')
      const result = await pm.create(name, { timezone, language, proxy })
      return JSON.stringify({
        success: true,
        name: result.name,
        engine: activeEngineType,
      })
    }

    case 'delete': {
      const name = extractPositionalArg(remainingArgs)
      if (!name) {
        throw new Error('Profile name is required for delete')
      }
      const success = await pm.delete(name)
      return JSON.stringify({ success })
    }

    case 'launch-args': {
      const name = parseOption(remainingArgs, '--profile')
      const profile = name ? await pm.get(name) : null
      if (name && !profile) {
        throw new Error(`Profile '${name}' not found for engine '${activeEngineType}'`)
      }
      const p =
        profile ||
        createProfileEntity('ephemeral', {
          timezone: config.defaults.timezone,
          language: config.defaults.language,
          acceptLanguages: config.defaults.acceptLanguages,
          screenWidth: config.defaults.screenWidth,
          screenHeight: config.defaults.screenHeight,
        })
      const userDataDir = store.resolveUserDataDir(p.name, activeEngineType)
      const args = await engine.buildArgs({
        profile: p,
        engine: activeEngineType,
        userDataDir,
        incomingArgs: filterOutFlag(remainingArgs, '--profile'),
      })
      return JSON.stringify(args)
    }

    case 'launch': {
      const profileOpt = parseOption(remainingArgs, '--profile')
      const extraArgs = filterOutFlag(remainingArgs, '--profile')
      const result = await launchProfile(profileOpt, extraArgs, engine, store, config.defaults)

      result.process.on('error', (err) => {
        console.error(`Error launching kernel: ${err.message}`)
        process.exit(1)
      })

      result.process.on('exit', (code) => {
        process.exit(code ?? 0)
      })

      // 转发进程终止信号至子进程
      const forwardSignal = (sig: NodeJS.Signals) => {
        if (!result.process.killed) {
          result.process.kill(sig)
        }
      }
      process.on('SIGINT', () => forwardSignal('SIGINT'))
      process.on('SIGTERM', () => forwardSignal('SIGTERM'))

      return ''
    }

    default: {
      throw new Error(`Unknown command '${command}'`)
    }
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  try {
    const configAdapter = new TomlConfigAdapter()
    const config = await configAdapter.load()
    const store = new FileStoreAdapter(config.vaultRoot)
    const engines: Record<EngineType, EnginePort> = {
      prism: new PrismAdapter(config.engines.prism.binaryPath),
      cloak: new CloakAdapter(config.engines.cloak.binaryPath),
    }

    const output = await handleCliCommand(argv, config, store, engines)
    if (output) {
      console.log(output)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`Error: ${message}`)
    process.exit(1)
  }
}

if (import.meta.main) {
  void main()
}

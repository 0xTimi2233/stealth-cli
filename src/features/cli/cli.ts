#!/usr/bin/env bun
import { CloakAdapter } from '@/adapter/cloak/cloak.adapter'
import { TomlConfigAdapter } from '@/adapter/config/toml-config.adapter'
import { PrismAdapter } from '@/adapter/prism/prism.adapter'
import { FileStoreAdapter } from '@/adapter/store/file-store.adapter'
import type { StealthConfig } from '@/domain/config'
import type { EngineType } from '@/domain/launch'
import { createProfileEntity } from '@/domain/profile'
import type { EnginePort } from '@/port/engine.port'
import type { ProfileStorePort } from '@/port/store.port'
import { launchProfile } from '../launcher/launcher'
import { ProfileManager } from '../profile/profile-manager'

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
  const KNOWN_COMMANDS = new Set(['list', 'create', 'delete', 'launch-args', 'launch'])
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
      let targetProfile = process.env.PRISM_PROFILE || process.env.STEALTH_PROFILE
      const profileOpt = parseOption(remainingArgs, '--profile')
      if (profileOpt) {
        targetProfile = profileOpt
      }

      const extraArgs = filterOutFlag(remainingArgs, '--profile')
      const result = await launchProfile(targetProfile, extraArgs, engine, store)

      result.process.on('error', (err) => {
        console.error(`Error launching kernel: ${err.message}`)
        process.exit(1)
      })

      result.process.on('exit', (code) => {
        process.exit(code ?? 0)
      })

      // 转发进程信号，彻底避免孤儿进程残留
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

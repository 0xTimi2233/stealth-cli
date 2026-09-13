import { spawn } from 'node:child_process'
import { accessSync, constants, existsSync, readFileSync, realpathSync } from 'node:fs'
import { join } from 'node:path'
import type { EngineType } from '@/domain/launch'
import type { ProfileStorePort } from '@/port/store.port'

export function parseShimOption(args: string[], flag: string): string | undefined {
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

export function replaceOptionValue(args: string[], flag: string, newValue: string): string[] {
  const result: string[] = []
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === flag && i + 1 < args.length) {
      result.push(flag, newValue)
      i++
      continue
    }
    if (arg.startsWith(`${flag}=`)) {
      result.push(`${flag}=${newValue}`)
      continue
    }
    result.push(arg)
  }
  return result
}

export async function rewriteShimArgs(
  argv: string[],
  store: ProfileStorePort,
  engine: EngineType,
  envSession?: string,
): Promise<string[]> {
  const explicitProfile = parseShimOption(argv, '--profile')

  if (explicitProfile) {
    if (explicitProfile.startsWith('/')) {
      return argv
    }
    const profile = await store.get(explicitProfile, engine)
    if (!profile) {
      throw new Error(`Profile '${explicitProfile}' not found for engine '${engine}'`)
    }
    const vaultDir = store.resolveUserDataDir(profile.name, engine)
    return replaceOptionValue(argv, '--profile', vaultDir)
  }

  const sessionName = parseShimOption(argv, '--session') || envSession || 'default'
  const matched = await store.get(sessionName, engine)

  if (matched) {
    const vaultDir = store.resolveUserDataDir(matched.name, engine)
    return ['--profile', vaultDir, ...argv]
  }

  return argv
}

export function resolveUpstreamBinary(
  specifiedUpstream?: string,
  envUpstream?: string,
  currentShimPath?: string,
): string {
  if (specifiedUpstream && existsSync(specifiedUpstream)) {
    return specifiedUpstream
  }

  const envTarget = envUpstream || process.env.STEALTH_REAL_AGENT_BROWSER
  if (envTarget && existsSync(envTarget)) {
    return envTarget
  }

  const currentRealShim = currentShimPath ? safeRealpath(currentShimPath) : null
  const pathDirs = (process.env.PATH || '').split(':').filter(Boolean)

  for (const dir of pathDirs) {
    const candidate = join(dir, 'agent-browser')
    if (!existsSync(candidate)) {
      continue
    }

    try {
      accessSync(candidate, constants.X_OK)
    } catch {
      continue
    }

    const candidateReal = safeRealpath(candidate)
    if (currentRealShim && candidateReal === currentRealShim) {
      continue
    }

    try {
      const head = readFileSync(candidate, { encoding: 'utf8', flag: 'r' }).slice(0, 500)
      if (head.includes('stealth-cli shim')) {
        continue
      }
    } catch {}

    return candidate
  }

  throw new Error(
    "Real upstream 'agent-browser' binary not found. Please install agent-browser or specify STEALTH_REAL_AGENT_BROWSER.",
  )
}

function safeRealpath(path: string): string {
  try {
    return realpathSync(path)
  } catch {
    return path
  }
}

export async function executeShim(
  argv: string[],
  store: ProfileStorePort,
  engine: EngineType,
  options?: {
    upstreamBinary?: string
    envSession?: string
    currentShimPath?: string
  },
): Promise<void> {
  const upstream = resolveUpstreamBinary(
    options?.upstreamBinary,
    process.env.STEALTH_REAL_AGENT_BROWSER,
    options?.currentShimPath,
  )

  const rewrittenArgs = await rewriteShimArgs(
    argv,
    store,
    engine,
    options?.envSession || process.env.AGENT_BROWSER_SESSION,
  )

  const proc = spawn(upstream, rewrittenArgs, {
    stdio: 'inherit',
    windowsHide: false,
  })

  proc.on('error', (err) => {
    console.error(`Error executing upstream agent-browser: ${err.message}`)
    process.exit(1)
  })

  proc.on('exit', (code) => {
    process.exit(code ?? 0)
  })

  const forwardSignal = (sig: NodeJS.Signals) => {
    if (!proc.killed) {
      proc.kill(sig)
    }
  }

  process.on('SIGINT', () => forwardSignal('SIGINT'))
  process.on('SIGTERM', () => forwardSignal('SIGTERM'))
}

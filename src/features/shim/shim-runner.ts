import { spawn } from 'node:child_process'
import {
  accessSync,
  constants,
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { delimiter, isAbsolute, join } from 'node:path'
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

function resolveSessionStoreDir(): string {
  const home = process.env.STEALTH_HOME || join(homedir(), '.stealth')
  return join(home, 'active-sessions')
}

export function recordSessionProfile(sessionName: string, profileName: string): void {
  const dir = resolveSessionStoreDir()
  try {
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, sessionName), profileName, 'utf8')
  } catch {}
}

export function getSessionProfile(sessionName: string): string | null {
  const dir = resolveSessionStoreDir()
  const p = join(dir, sessionName)
  try {
    if (existsSync(p)) {
      return readFileSync(p, 'utf8').trim()
    }
  } catch {}
  return null
}

export function clearSessionProfile(sessionName: string): void {
  const dir = resolveSessionStoreDir()
  const p = join(dir, sessionName)
  try {
    if (existsSync(p)) {
      rmSync(p, { force: true })
    }
  } catch {}
}

export async function rewriteShimArgs(
  argv: string[],
  store: ProfileStorePort,
  engine: EngineType,
): Promise<string[]> {
  const sessionName = parseShimOption(argv, '--session') || process.env.AGENT_BROWSER_SESSION
  const isCloseCommand = argv.includes('close')

  if (isCloseCommand && sessionName) {
    clearSessionProfile(sessionName)
  }

  const explicitProfile = parseShimOption(argv, '--profile')

  let targetProfileName = explicitProfile

  if (explicitProfile && sessionName) {
    recordSessionProfile(sessionName, explicitProfile)
  } else if (!explicitProfile && sessionName) {
    const remembered = getSessionProfile(sessionName)
    if (remembered) {
      targetProfileName = remembered
    }
  }

  if (!targetProfileName) {
    return argv
  }

  if (
    isAbsolute(targetProfileName) ||
    targetProfileName.startsWith('~') ||
    targetProfileName.startsWith('.')
  ) {
    return argv
  }

  const profile = await store.get(targetProfileName, engine)
  if (!profile) {
    if (explicitProfile) {
      throw new Error(`Profile '${explicitProfile}' not found for engine '${engine}'`)
    }
    return argv
  }

  const vaultDir = store.resolveUserDataDir(profile.name, engine)

  if (explicitProfile) {
    return replaceOptionValue(argv, '--profile', vaultDir)
  }

  return ['--profile', vaultDir, ...argv]
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
  const pathDirs = (process.env.PATH || '').split(delimiter).filter(Boolean)

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
    currentShimPath?: string
  },
): Promise<void> {
  const upstream = resolveUpstreamBinary(
    options?.upstreamBinary,
    process.env.STEALTH_REAL_AGENT_BROWSER,
    options?.currentShimPath,
  )

  const rewrittenArgs = await rewriteShimArgs(argv, store, engine)

  const proc = spawn(upstream, rewrittenArgs, {
    stdio: 'inherit',
    windowsHide: false,
    shell: process.platform === 'win32',
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

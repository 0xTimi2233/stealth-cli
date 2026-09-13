import { chmodSync, mkdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { resolveUpstreamBinary } from './shim-runner'

export interface ShimInstallOptions {
  dir?: string
}

export interface ShimInstallResult {
  success: boolean
  shimPath: string
  upstream?: string
}

export function installShim(options?: ShimInstallOptions): ShimInstallResult {
  const targetDir = options?.dir || join(homedir(), '.local', 'bin')
  mkdirSync(targetDir, { recursive: true })

  const shimPath = join(targetDir, 'agent-browser')

  let upstream: string | undefined
  try {
    upstream = resolveUpstreamBinary(undefined, undefined, shimPath)
  } catch {}

  const scriptContent = upstream
    ? `#!/bin/sh
exec stealth-cli shim --upstream "${upstream}" "$@"
`
    : `#!/bin/sh
STEALTH_SHIM_PATH="$0" exec stealth-cli shim "$@"
`

  writeFileSync(shimPath, scriptContent, { mode: 0o755, encoding: 'utf8' })
  chmodSync(shimPath, 0o755)

  return {
    success: true,
    shimPath,
    upstream,
  }
}

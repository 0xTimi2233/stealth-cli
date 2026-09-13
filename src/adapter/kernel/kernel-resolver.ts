import { homedir } from 'node:os'
import { join } from 'node:path'

export function resolveEngineExecutable(binaryPathOrEngine: string, binaryPath?: string): string {
  const rawPath = binaryPath ?? binaryPathOrEngine
  const expanded = rawPath.startsWith('~/') ? join(homedir(), rawPath.slice(2)) : rawPath

  const lastAppIndex = expanded.lastIndexOf('.app')
  const realBundlePath = lastAppIndex >= 0 ? expanded.slice(0, lastAppIndex + 4) : expanded

  return realBundlePath.endsWith('.app')
    ? join(realBundlePath, 'Contents/MacOS/Chromium')
    : realBundlePath
}

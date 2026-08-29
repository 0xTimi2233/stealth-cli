import { mkdir, readlink, rm, symlink } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'
import type { EngineType } from '../domain/launch'

export function expandHome(path: string): string {
  if (path.startsWith('~')) {
    return path.replace('~', homedir())
  }
  return path
}

export async function ensureEngineSymlink(
  engine: EngineType,
  rawSourcePath: string,
  customStealthHome?: string,
): Promise<string> {
  const stealthHome =
    customStealthHome || process.env.STEALTH_HOME || join(homedir(), '.stealth')
  const engineDir = join(stealthHome, 'engines', engine)
  await mkdir(engineDir, { recursive: true })

  const realTarget = expandHome(rawSourcePath)

  if (process.platform === 'darwin') {
    // macOS bundle 必须整体软链 .app，确保内部 @executable_path 正常索引 Frameworks
    const lastAppIndex = realTarget.lastIndexOf('.app')
    const realAppPath =
      lastAppIndex >= 0 ? realTarget.slice(0, lastAppIndex + 4) : realTarget
    const linkPath = join(engineDir, 'Chromium.app')

    let needsLink = true
    try {
      const currentTarget = await readlink(linkPath)
      if (currentTarget === realAppPath) {
        needsLink = false
      }
    } catch {
      needsLink = true
    }

    if (needsLink) {
      await rm(linkPath, { recursive: true, force: true }).catch(() => {})
      await symlink(realAppPath, linkPath)
    }

    return join(linkPath, 'Contents/MacOS/Chromium')
  }

  // Linux / Windows 直接软链可执行二进制
  const binaryName = basename(realTarget) || 'chrome'
  const linkPath = join(engineDir, binaryName)

  let needsLink = true
  try {
    const currentTarget = await readlink(linkPath)
    if (currentTarget === realTarget) {
      needsLink = false
    }
  } catch {
    needsLink = true
  }

  if (needsLink) {
    await rm(linkPath, { force: true }).catch(() => {})
    await symlink(realTarget, linkPath)
  }

  return linkPath
}

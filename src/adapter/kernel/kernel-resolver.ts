import { mkdir, readlink, rm, symlink } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'
import type { EngineType } from '@/domain/launch'

export async function resolveEngineExecutable(
  engine: EngineType,
  binaryPath: string,
  customStealthHome?: string,
): Promise<string> {
  const home = customStealthHome || process.env.STEALTH_HOME || join(homedir(), '.stealth')
  const engineDir = join(home, 'engines', engine)
  await mkdir(engineDir, { recursive: true })

  const lastAppIndex = binaryPath.lastIndexOf('.app')
  const realBundlePath = lastAppIndex >= 0 ? binaryPath.slice(0, lastAppIndex + 4) : binaryPath
  const linkName = basename(realBundlePath)
  const linkPath = join(engineDir, linkName)

  // 防止自引用产生死循环 (ELOOP)
  if (linkPath !== realBundlePath) {
    let needsLink = true
    try {
      if ((await readlink(linkPath)) === realBundlePath) {
        needsLink = false
      }
    } catch {
      needsLink = true
    }

    if (needsLink) {
      await rm(linkPath, { recursive: true, force: true }).catch(() => {})
      await symlink(realBundlePath, linkPath)
    }
  }

  return linkName.endsWith('.app') ? join(linkPath, 'Contents/MacOS/Chromium') : linkPath
}

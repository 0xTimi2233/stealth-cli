import { mkdir, readlink, rm, symlink } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'
import type { EngineType } from '@/domain/launch'

export async function ensureEngineSymlink(
  engine: EngineType,
  binaryPath: string,
  customStealthHome?: string,
): Promise<string> {
  const home =
    customStealthHome || process.env.STEALTH_HOME || join(homedir(), '.stealth')
  const engineDir = join(home, 'engines', engine)
  await mkdir(engineDir, { recursive: true })

  const linkName = basename(binaryPath)
  const linkPath = join(engineDir, linkName)

  try {
    const currentTarget = await readlink(linkPath)
    if (currentTarget !== binaryPath) {
      await rm(linkPath, { recursive: true, force: true }).catch(() => {})
      await symlink(binaryPath, linkPath)
    }
  } catch {
    await rm(linkPath, { recursive: true, force: true }).catch(() => {})
    await symlink(binaryPath, linkPath)
  }

  return process.platform === 'darwin' && linkName.endsWith('.app')
    ? join(linkPath, 'Contents/MacOS/Chromium')
    : linkPath
}

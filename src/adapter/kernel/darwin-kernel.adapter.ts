import { mkdir, readlink, rm, symlink } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'
import type { EngineType } from '@/domain/launch'
import type { KernelResolverPort } from '@/port/kernel-resolver.port'

export class DarwinKernelAdapter implements KernelResolverPort {
  constructor(private readonly stealthHome?: string) {}

  private getHome(): string {
    return (
      this.stealthHome ||
      process.env.STEALTH_HOME ||
      join(homedir(), '.stealth')
    )
  }

  async resolveExecutable(
    engine: EngineType,
    binaryPath: string,
  ): Promise<string> {
    const engineDir = join(this.getHome(), 'engines', engine)
    await mkdir(engineDir, { recursive: true })

    const linkName = basename(binaryPath)
    const linkPath = join(engineDir, linkName)

    if (linkPath !== binaryPath) {
      let needsLink = true
      try {
        const currentTarget = await readlink(linkPath)
        if (currentTarget === binaryPath) {
          needsLink = false
        }
      } catch {
        needsLink = true
      }

      if (needsLink) {
        await rm(linkPath, { recursive: true, force: true }).catch(() => {})
        await symlink(binaryPath, linkPath)
      }
    }

    return linkName.endsWith('.app')
      ? join(linkPath, 'Contents/MacOS/Chromium')
      : linkPath
  }
}

import { mkdir, readlink, rm, symlink } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'
import type { EngineType } from '@/domain/launch'
import type { KernelResolverPort } from '@/port/kernel-resolver.port'

export class LinuxKernelAdapter implements KernelResolverPort {
  constructor(private readonly stealthHome?: string) {}

  private getHome(): string {
    return this.stealthHome || process.env.STEALTH_HOME || join(homedir(), '.stealth')
  }

  async resolveExecutable(engine: EngineType, binaryPath: string): Promise<string> {
    const engineDir = join(this.getHome(), 'engines', engine)
    await mkdir(engineDir, { recursive: true })

    const binaryName = basename(binaryPath) || 'chrome'
    const linkPath = join(engineDir, binaryName)

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
        await rm(linkPath, { force: true }).catch(() => {})
        await symlink(binaryPath, linkPath)
      }
    }

    return linkPath
  }
}

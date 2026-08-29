import { spawn } from 'node:child_process'
import { buildArgs as buildCloakOfficialArgs } from '@cloak/args'
import { createPlatformKernelResolver } from '@/adapter/kernel/kernel-resolver.factory'
import type { EngineType, LaunchRequest, LaunchResult } from '@/domain/launch'
import type { EnginePort } from '@/port/engine.port'
import type { KernelResolverPort } from '@/port/kernel-resolver.port'
import { toCloakLaunchOptions } from './cloak.mapper'

export class CloakAdapter implements EnginePort {
  readonly name: EngineType = 'cloak'

  private readonly kernelResolver: KernelResolverPort

  constructor(
    private readonly rawKernelPath: string,
    kernelResolver?: KernelResolverPort,
  ) {
    this.kernelResolver = kernelResolver || createPlatformKernelResolver()
  }

  async getKernelPath(): Promise<string> {
    return this.kernelResolver.resolveExecutable(this.name, this.rawKernelPath)
  }

  async buildArgs(request: LaunchRequest): Promise<string[]> {
    const cloakOptions = toCloakLaunchOptions(request)
    return buildCloakOfficialArgs(cloakOptions)
  }

  async launch(request: LaunchRequest): Promise<LaunchResult> {
    const kernelPath = await this.getKernelPath()
    const effectiveArgs = await this.buildArgs(request)
    const proc = spawn(kernelPath, effectiveArgs, {
      stdio: 'inherit',
      windowsHide: false,
    })

    return {
      engine: this.name,
      process: proc,
      pid: proc.pid ?? -1,
      userDataDir: request.userDataDir,
      effectiveArgs,
    }
  }
}

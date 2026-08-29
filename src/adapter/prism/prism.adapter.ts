import { spawn } from 'node:child_process'
import { hostHardwareSnapshot } from '@prism/main/host-hardware'
import { buildLaunchArgs } from '@prism/main/launch-args'
import { createPlatformKernelResolver } from '@/adapter/kernel/kernel-resolver.factory'
import type { EngineType, LaunchRequest, LaunchResult } from '@/domain/launch'
import type { EnginePort } from '@/port/engine.port'
import type { KernelResolverPort } from '@/port/kernel-resolver.port'
import { toPrismBrowserProfile } from './prism.mapper'

export class PrismAdapter implements EnginePort {
  readonly name: EngineType = 'prism'

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
    const hostHw = hostHardwareSnapshot()
    const prismProfile = toPrismBrowserProfile(request.profile)

    const officialArgs = buildLaunchArgs(prismProfile, {
      userDataDir: request.userDataDir,
      proxyUrl: request.profile.proxy,
      fingerprintKernel: true,
      hostHardwareConcurrency: hostHw.hardwareConcurrency,
      hostPlatformVersion: hostHw.platformVersion,
    })

    const officialFlagKeys = new Set(officialArgs.map((a) => a.split('=')[0]))
    const extraArgs = request.incomingArgs.filter((arg) => {
      const key = arg.split('=')[0]
      return (
        !officialFlagKeys.has(key) &&
        !arg.includes('--enable-unsafe-swiftshader')
      )
    })

    return [...officialArgs, ...extraArgs]
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

import { spawn } from 'node:child_process'
import { resolveEngineExecutable } from '@/adapter/kernel/kernel-resolver'
import type { EngineType, LaunchRequest, LaunchResult } from '@/domain/launch'
import type { EnginePort } from '@/port/engine.port'
import { buildPrismOfficialArgs } from './prism-launch-args'

export class PrismAdapter implements EnginePort {
  readonly name: EngineType = 'prism'

  constructor(private readonly rawKernelPath: string) {}

  async getKernelPath(): Promise<string> {
    return resolveEngineExecutable(this.name, this.rawKernelPath)
  }

  async buildArgs(request: LaunchRequest): Promise<string[]> {
    return buildPrismOfficialArgs(request.profile, {
      userDataDir: request.userDataDir,
      proxyUrl: request.profile.proxy,
      incomingArgs: request.incomingArgs,
    })
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

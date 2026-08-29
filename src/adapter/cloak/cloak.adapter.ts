import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { buildLaunchOptions, ensureBinary } from 'cloakbrowser'
import { resolveEngineExecutable } from '@/adapter/kernel/kernel-resolver'
import type { EngineType, LaunchRequest, LaunchResult } from '@/domain/launch'
import type { EnginePort } from '@/port/engine.port'

export class CloakAdapter implements EnginePort {
  readonly name: EngineType = 'cloak'

  constructor(private readonly rawKernelPath: string) {}

  async getKernelPath(): Promise<string> {
    try {
      if (existsSync(this.rawKernelPath)) {
        return await resolveEngineExecutable(this.name, this.rawKernelPath)
      }
    } catch {
      // 路径未就绪时向下由官方自动寻址/下载
    }

    // 官方自动下载与缓存寻址：若本地未安装，自动拉取对应平台的最新内核
    const officialBinary = await ensureBinary()
    return resolveEngineExecutable(this.name, officialBinary)
  }

  async buildArgs(request: LaunchRequest): Promise<string[]> {
    const sanitizedIncoming = request.incomingArgs.filter(
      (arg) => !arg.includes('--enable-automation') && !arg.includes('--enable-unsafe-swiftshader'),
    )

    const launchOpts = await buildLaunchOptions({
      timezone: request.profile.timezone,
      locale: request.profile.language,
      args: [
        `--user-data-dir=${request.userDataDir}`,
        `--fingerprint=${request.profile.seed}`,
        `--accept-lang=${request.profile.acceptLanguages}`,
        `--window-size=${request.profile.screenWidth},${request.profile.screenHeight}`,
        ...(request.profile.proxy ? [`--proxy-server=${request.profile.proxy}`] : []),
        ...sanitizedIncoming,
      ],
    })

    return (launchOpts.args as string[]) || []
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

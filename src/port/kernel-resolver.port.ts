import type { EngineType } from '@/domain/launch'

export interface KernelResolverPort {
  resolveExecutable(engine: EngineType, binaryPath: string): Promise<string>
}

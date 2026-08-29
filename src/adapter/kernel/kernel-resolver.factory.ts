import type { KernelResolverPort } from '@/port/kernel-resolver.port'
import { DarwinKernelAdapter } from './darwin-kernel.adapter'
import { LinuxKernelAdapter } from './linux-kernel.adapter'

export function createPlatformKernelResolver(
  stealthHome?: string,
): KernelResolverPort {
  if (process.platform === 'darwin') {
    return new DarwinKernelAdapter(stealthHome)
  }
  // Linux, Windows (WSL / native) 走平台适配器
  return new LinuxKernelAdapter(stealthHome)
}

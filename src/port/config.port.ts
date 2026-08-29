import type { StealthConfig } from '@/domain/config'

export interface ConfigPort {
  load(): Promise<StealthConfig>
}

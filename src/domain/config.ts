import type { EngineType } from './launch'

export interface StealthEngineConfig {
  binaryPath: string
}

export interface StealthDefaultsConfig {
  timezone: string
  language: string
  acceptLanguages: string
  screenWidth: number
  screenHeight: number
}

export interface StealthConfig {
  engine: EngineType
  vaultRoot: string
  engines: Record<EngineType, StealthEngineConfig>
  defaults: StealthDefaultsConfig
}

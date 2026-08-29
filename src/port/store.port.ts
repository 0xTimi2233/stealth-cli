import type { EngineType } from '@/domain/launch'
import type { Profile } from '@/domain/profile'

export interface ProfileStorePort {
  resolveUserDataDir(name: string, engine: EngineType): string
  list(engine: EngineType): Promise<Profile[]>
  get(name: string, engine: EngineType): Promise<Profile | null>
  save(profile: Profile, engine: EngineType): Promise<void>
  delete(name: string, engine: EngineType): Promise<boolean>
}

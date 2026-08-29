import type { StealthDefaultsConfig } from '@/domain/config'
import type { EngineType } from '@/domain/launch'
import { createProfileEntity, type Profile, type ProfileDraftOptions } from '@/domain/profile'
import type { ProfileStorePort } from '@/port/store.port'

export class ProfileManager {
  constructor(
    private readonly store: ProfileStorePort,
    private readonly engine: EngineType,
    private readonly defaults: StealthDefaultsConfig,
  ) {}

  async list(): Promise<Profile[]> {
    return this.store.list(this.engine)
  }

  async get(name: string): Promise<Profile | null> {
    return this.store.get(name, this.engine)
  }

  async create(name: string, options: ProfileDraftOptions = {}): Promise<Profile> {
    const existing = await this.get(name)
    if (existing) {
      throw new Error(`Profile '${name}' already exists in engine '${this.engine}'`)
    }

    const profile = createProfileEntity(name, {
      timezone: options.timezone ?? this.defaults.timezone,
      language: options.language ?? this.defaults.language,
      acceptLanguages: options.acceptLanguages ?? this.defaults.acceptLanguages,
      screenWidth: options.screenWidth ?? this.defaults.screenWidth,
      screenHeight: options.screenHeight ?? this.defaults.screenHeight,
      proxy: options.proxy,
      seed: options.seed,
    })

    await this.store.save(profile, this.engine)
    return profile
  }

  async delete(name: string): Promise<boolean> {
    return this.store.delete(name, this.engine)
  }
}

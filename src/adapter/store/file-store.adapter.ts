import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { EngineType } from '@/domain/launch'
import type { Profile } from '@/domain/profile'
import type { ProfileStorePort } from '@/port/store.port'

interface StoreFilePayload {
  version: number
  profiles: Profile[]
}

export class FileStoreAdapter implements ProfileStorePort {
  constructor(private readonly vaultRoot: string) {}

  private adapterVault(engine: EngineType): string {
    return join(this.vaultRoot, engine)
  }

  private storeFilePath(engine: EngineType): string {
    return join(this.adapterVault(engine), 'profiles.json')
  }

  resolveUserDataDir(name: string, engine: EngineType): string {
    return join(this.adapterVault(engine), 'profiles', name, 'user-data')
  }

  private async loadPayload(engine: EngineType): Promise<StoreFilePayload> {
    try {
      const raw = await readFile(this.storeFilePath(engine), 'utf8')
      return JSON.parse(raw) as StoreFilePayload
    } catch {
      return { version: 1, profiles: [] }
    }
  }

  private async writePayload(
    engine: EngineType,
    payload: StoreFilePayload,
  ): Promise<void> {
    const dir = this.adapterVault(engine)
    await mkdir(dir, { recursive: true })
    await writeFile(
      this.storeFilePath(engine),
      JSON.stringify(payload, null, 2),
      'utf8',
    )
  }

  async list(engine: EngineType): Promise<Profile[]> {
    const payload = await this.loadPayload(engine)
    return payload.profiles
  }

  async get(name: string, engine: EngineType): Promise<Profile | null> {
    const profiles = await this.list(engine)
    return profiles.find((p) => p.name === name) ?? null
  }

  async save(profile: Profile, engine: EngineType): Promise<void> {
    const payload = await this.loadPayload(engine)
    const index = payload.profiles.findIndex((p) => p.name === profile.name)
    if (index >= 0) {
      payload.profiles[index] = profile
    } else {
      payload.profiles.push(profile)
    }
    await this.writePayload(engine, payload)
  }

  async delete(name: string, engine: EngineType): Promise<boolean> {
    const payload = await this.loadPayload(engine)
    const index = payload.profiles.findIndex((p) => p.name === name)
    if (index < 0) return false

    payload.profiles.splice(index, 1)
    await this.writePayload(engine, payload)

    const userDir = join(this.adapterVault(engine), 'profiles', name)
    await rm(userDir, { recursive: true, force: true }).catch(() => {})
    return true
  }
}

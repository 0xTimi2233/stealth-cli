import { randomInt } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { StealthDefaultsConfig } from '@/domain/config'
import type { LaunchRequest, LaunchResult } from '@/domain/launch'
import { createProfileEntity } from '@/domain/profile'
import type { EnginePort } from '@/port/engine.port'
import type { ProfileStorePort } from '@/port/store.port'

export async function launchProfile(
  name: string | undefined,
  incomingArgs: string[],
  engine: EnginePort,
  store: ProfileStorePort,
  defaults?: StealthDefaultsConfig,
): Promise<LaunchResult> {
  const incomingUserData = incomingArgs.find((a) => a.startsWith('--user-data-dir='))?.split('=')[1]
  const sessionName = incomingUserData
    ? incomingUserData.split('/').filter(Boolean).pop()
    : undefined
  const targetName = name || sessionName

  let profile = targetName ? await store.get(targetName, engine.name) : null

  if (name && !profile) {
    throw new Error(`Profile '${name}' not found for engine '${engine.name}'`)
  }

  const profileName = profile?.name || targetName || 'ephemeral'
  if (!profile) {
    profile = createProfileEntity(profileName, defaults)
  }

  const userDataDir =
    incomingUserData ||
    (name
      ? store.resolveUserDataDir(profileName, engine.name)
      : join(tmpdir(), `stealth-ephemeral-${Date.now()}-${randomInt(1000, 9999)}`))

  const request: LaunchRequest = {
    profile,
    engine: engine.name,
    userDataDir,
    incomingArgs,
  }

  return engine.launch(request)
}

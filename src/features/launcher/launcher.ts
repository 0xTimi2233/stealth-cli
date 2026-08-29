import { randomInt } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { LaunchRequest, LaunchResult } from '@/domain/launch'
import { createProfileEntity } from '@/domain/profile'
import type { EnginePort } from '@/port/engine.port'
import type { ProfileStorePort } from '@/port/store.port'

export async function launchProfile(
  name: string | undefined,
  incomingArgs: string[],
  engine: EnginePort,
  store: ProfileStorePort,
): Promise<LaunchResult> {
  const profileName = name || 'ephemeral'
  let profile = name ? await store.get(name, engine.name) : null

  if (name && !profile) {
    throw new Error(`Profile '${name}' not found for engine '${engine.name}'`)
  }

  if (!profile) {
    profile = createProfileEntity(profileName)
  }

  const incomingUserData = incomingArgs
    .find((a) => a.startsWith('--user-data-dir='))
    ?.split('=')[1]

  const userDataDir =
    incomingUserData ||
    (name
      ? store.resolveUserDataDir(profileName, engine.name)
      : join(
          tmpdir(),
          `stealth-ephemeral-${Date.now()}-${randomInt(1000, 9999)}`,
        ))

  const request: LaunchRequest = {
    profile,
    engine: engine.name,
    userDataDir,
    incomingArgs,
  }

  return engine.launch(request)
}

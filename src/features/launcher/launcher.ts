import { randomInt } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { StealthDefaultsConfig } from '@/domain/config'
import type { LaunchRequest, LaunchResult } from '@/domain/launch'
import { createProfileEntity } from '@/domain/profile'
import type { EnginePort } from '@/port/engine.port'
import type { ProfileStorePort } from '@/port/store.port'

export async function launchProfile(
  profileName: string | undefined,
  sessionName: string | undefined,
  incomingArgs: string[],
  engine: EnginePort,
  store: ProfileStorePort,
  defaults?: StealthDefaultsConfig,
): Promise<LaunchResult> {
  const targetName = profileName || sessionName

  let profile = targetName ? await store.get(targetName, engine.name) : null

  if (profileName && !profile) {
    throw new Error(`Profile '${profileName}' not found for engine '${engine.name}'`)
  }

  const isManagedProfile = Boolean(profile)
  const resolvedName = profile?.name || 'ephemeral'

  if (!profile) {
    profile = createProfileEntity(resolvedName, defaults)
  }

  const prefix = '--user-data-dir='
  const matched = incomingArgs.find((a) => a.startsWith(prefix))
  const incomingUserData = matched ? matched.slice(prefix.length) : undefined

  const userDataDir =
    incomingUserData ||
    (isManagedProfile
      ? store.resolveUserDataDir(profile.name, engine.name)
      : join(tmpdir(), `stealth-ephemeral-${Date.now()}-${randomInt(1000, 9999)}`))

  const sanitizedIncomingArgs = incomingArgs.filter((arg) => !arg.startsWith(prefix))

  const request: LaunchRequest = {
    profile,
    engine: engine.name,
    userDataDir,
    incomingArgs: sanitizedIncomingArgs,
  }

  return engine.launch(request)
}

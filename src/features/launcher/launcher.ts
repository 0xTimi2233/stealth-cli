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
  const sessionFromEnv = process.env.AGENT_BROWSER_SESSION
  const targetName = name || sessionFromEnv

  let profile = targetName ? await store.get(targetName, engine.name) : null

  if (name && !profile) {
    throw new Error(`Profile '${name}' not found for engine '${engine.name}'`)
  }

  const isManagedProfile = Boolean(profile)
  const profileName = profile?.name || 'ephemeral'

  if (!profile) {
    profile = createProfileEntity(profileName, defaults)
  }

  const incomingUserData = incomingArgs.find((a) => a.startsWith('--user-data-dir='))?.split('=')[1]

  const userDataDir = isManagedProfile
    ? store.resolveUserDataDir(profile.name, engine.name)
    : incomingUserData || join(tmpdir(), `stealth-ephemeral-${Date.now()}-${randomInt(1000, 9999)}`)

  const sanitizedIncomingArgs = isManagedProfile
    ? incomingArgs.filter((arg) => !arg.startsWith('--user-data-dir='))
    : incomingArgs

  const request: LaunchRequest = {
    profile,
    engine: engine.name,
    userDataDir,
    incomingArgs: sanitizedIncomingArgs,
  }

  return engine.launch(request)
}

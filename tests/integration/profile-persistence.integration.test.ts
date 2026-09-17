import { describe, expect, it } from 'bun:test'
import { rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { TomlConfigAdapter } from '@/adapter/config/toml-config.adapter'
import { FileStoreAdapter } from '@/adapter/store/file-store.adapter'
import type { LaunchRequest, LaunchResult } from '@/domain/launch'
import { launchProfile } from '@/features/launcher/launcher'
import { ProfileManager } from '@/features/profile/profile-manager'
import type { EnginePort } from '@/port/engine.port'

describe('Acceptance: Profile Persistence & Managed Authority', () => {
  const testVault = join(tmpdir(), `stealth-acceptance-${Date.now()}`)

  it('enforces vault user-data-dir when explicit profileName is provided, rejecting upstream temp dir', async () => {
    const configAdapter = new TomlConfigAdapter('/tmp/non-existent.toml')
    const config = await configAdapter.load()
    const store = new FileStoreAdapter(testVault)
    const pm = new ProfileManager(store, 'prism', config.defaults)

    await pm.create('managed-user', { timezone: 'Asia/Tokyo' })
    const expectedVaultDir = store.resolveUserDataDir('managed-user', 'prism')

    let capturedRequest: LaunchRequest | null = null
    const fakeEngine: EnginePort = {
      name: 'prism',
      getKernelPath: async () => '/bin/fake-kernel',
      buildArgs: async () => [],
      launch: async (req: LaunchRequest): Promise<LaunchResult> => {
        capturedRequest = req
        return {
          engine: 'prism',
          process: {} as never,
          pid: 9999,
          userDataDir: req.userDataDir,
          effectiveArgs: [],
        }
      },
    }

    const upstreamTempDir = '/var/folders/temp/agent-browser-chrome-xyz'

    try {
      await launchProfile(
        'managed-user',
        undefined,
        [`--user-data-dir=${upstreamTempDir}`, '--remote-debugging-port=0'],
        fakeEngine,
        store,
        config.defaults,
      )

      expect(capturedRequest).not.toBeNull()
      expect((capturedRequest as unknown as LaunchRequest).userDataDir).toBe(expectedVaultDir)
      expect((capturedRequest as unknown as LaunchRequest).incomingArgs).not.toContain(
        `--user-data-dir=${upstreamTempDir}`,
      )
    } finally {
      rmSync(testVault, { recursive: true, force: true })
    }
  })

  it('infers profile from incoming vault user-data-dir and locks persistent identity', async () => {
    const configAdapter = new TomlConfigAdapter('/tmp/non-existent.toml')
    const config = await configAdapter.load()
    const store = new FileStoreAdapter(testVault)
    const pm = new ProfileManager(store, 'prism', config.defaults)

    await pm.create('inferred-user', { timezone: 'Europe/London' })
    const expectedVaultDir = store.resolveUserDataDir('inferred-user', 'prism')

    let capturedRequest: LaunchRequest | null = null
    const fakeEngine: EnginePort = {
      name: 'prism',
      getKernelPath: async () => '/bin/fake-kernel',
      buildArgs: async () => [],
      launch: async (req: LaunchRequest): Promise<LaunchResult> => {
        capturedRequest = req
        return {
          engine: 'prism',
          process: {} as never,
          pid: 8888,
          userDataDir: req.userDataDir,
          effectiveArgs: [],
        }
      },
    }

    try {
      await launchProfile(
        undefined,
        undefined,
        [`--user-data-dir=${expectedVaultDir}`, '--remote-debugging-port=0'],
        fakeEngine,
        store,
        config.defaults,
      )

      expect(capturedRequest).not.toBeNull()
      expect((capturedRequest as unknown as LaunchRequest).userDataDir).toBe(expectedVaultDir)
      expect((capturedRequest as unknown as LaunchRequest).profile.name).toBe('inferred-user')
    } finally {
      rmSync(testVault, { recursive: true, force: true })
    }
  })
})

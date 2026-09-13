import { describe, expect, it } from 'bun:test'
import type { LaunchRequest } from '@/domain/launch'
import { createProfileEntity } from '@/domain/profile'
import type { EnginePort } from '@/port/engine.port'
import type { ProfileStorePort } from '@/port/store.port'
import { launchProfile } from './launcher'

describe('Feature: Launcher', () => {
  it('throws error if specified profile does not exist', async () => {
    const mockStore: ProfileStorePort = {
      resolveUserDataDir: () => '',
      get: async () => null,
      list: async () => [],
      save: async () => {},
      delete: async () => true,
    }

    const mockEngine: EnginePort = {
      name: 'prism',
      getKernelPath: async () => '',
      buildArgs: async () => [],
      launch: async () => ({}) as never,
    }

    expect(launchProfile('non-existent', [], mockEngine, mockStore)).rejects.toThrow(
      "Profile 'non-existent' not found for engine 'prism'",
    )
  })

  it('launches existing profile with correct parameters and resolved user-data-dir', async () => {
    const testProfile = createProfileEntity('test-account')

    const mockStore: ProfileStorePort = {
      resolveUserDataDir: (name, engine) => `/vault/${engine}/profiles/${name}/user-data`,
      get: async (name) => (name === 'test-account' ? testProfile : null),
      list: async () => [testProfile],
      save: async () => {},
      delete: async () => true,
    }

    let capturedRequest: LaunchRequest | null = null

    const mockEngine: EnginePort = {
      name: 'prism',
      getKernelPath: async () => '/bin/fake-kernel',
      buildArgs: async (req) => [`--user-data-dir=${req.userDataDir}`, ...req.incomingArgs],
      launch: async (req) => {
        capturedRequest = req
        return {
          engine: 'prism',
          process: {} as never,
          pid: 1234,
          userDataDir: req.userDataDir,
          effectiveArgs: [`--user-data-dir=${req.userDataDir}`, ...req.incomingArgs],
        }
      },
    }

    const result = await launchProfile(
      'test-account',
      ['--remote-debugging-pipe'],
      mockEngine,
      mockStore,
    )

    expect(result.pid).toBe(1234)
    expect((capturedRequest as LaunchRequest | null)?.profile.name).toBe('test-account')
    expect((capturedRequest as LaunchRequest | null)?.userDataDir).toBe(
      '/vault/prism/profiles/test-account/user-data',
    )
    expect(result.effectiveArgs).toContain('--remote-debugging-pipe')
  })

  it('automatically resolves and binds existing profile from AGENT_BROWSER_SESSION env', async () => {
    const googleProfile = createProfileEntity('google-main', { timezone: 'America/New_York' })

    const mockStore: ProfileStorePort = {
      resolveUserDataDir: (name, engine) => `/vault/${engine}/profiles/${name}/user-data`,
      get: async (name) => (name === 'google-main' ? googleProfile : null),
      list: async () => [googleProfile],
      save: async () => {},
      delete: async () => true,
    }

    let capturedRequest: LaunchRequest | null = null

    const mockEngine: EnginePort = {
      name: 'cloak',
      getKernelPath: async () => '/bin/fake-kernel',
      buildArgs: async (req) => req.incomingArgs,
      launch: async (req) => {
        capturedRequest = req
        return {
          engine: 'cloak',
          process: {} as never,
          pid: 5678,
          userDataDir: req.userDataDir,
          effectiveArgs: req.incomingArgs,
        }
      },
    }

    const originalEnv = process.env.AGENT_BROWSER_SESSION
    process.env.AGENT_BROWSER_SESSION = 'google-main'

    try {
      await launchProfile(
        undefined,
        ['--user-data-dir=/tmp/agent-browser-chrome-random-uuid'],
        mockEngine,
        mockStore,
      )

      expect((capturedRequest as LaunchRequest | null)?.profile.name).toBe('google-main')
      expect((capturedRequest as LaunchRequest | null)?.profile.timezone).toBe('America/New_York')
      expect((capturedRequest as LaunchRequest | null)?.userDataDir).toBe(
        '/vault/cloak/profiles/google-main/user-data',
      )
      expect((capturedRequest as LaunchRequest | null)?.incomingArgs).not.toContain(
        '--user-data-dir=/tmp/agent-browser-chrome-random-uuid',
      )
    } finally {
      process.env.AGENT_BROWSER_SESSION = originalEnv
    }
  })

  it('falls back gracefully to ephemeral profile for unmanaged session', async () => {
    const mockStore: ProfileStorePort = {
      resolveUserDataDir: (name, engine) => `/vault/${engine}/profiles/${name}/user-data`,
      get: async () => null,
      list: async () => [],
      save: async () => {},
      delete: async () => true,
    }

    let capturedRequest: LaunchRequest | null = null

    const mockEngine: EnginePort = {
      name: 'cloak',
      getKernelPath: async () => '/bin/fake-kernel',
      buildArgs: async (req) => req.incomingArgs,
      launch: async (req) => {
        capturedRequest = req
        return {
          engine: 'cloak',
          process: {} as never,
          pid: 9999,
          userDataDir: req.userDataDir,
          effectiveArgs: req.incomingArgs,
        }
      },
    }

    await launchProfile(
      undefined,
      ['--user-data-dir=/tmp/agent-browser/sessions/temp-worker-99'],
      mockEngine,
      mockStore,
    )

    expect((capturedRequest as LaunchRequest | null)?.profile.name).toBe('ephemeral')
    expect((capturedRequest as LaunchRequest | null)?.userDataDir).toBe(
      '/tmp/agent-browser/sessions/temp-worker-99',
    )
  })
})

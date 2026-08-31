import { describe, expect, it } from 'bun:test'
import type { LaunchRequest } from '@/domain/launch'
import { createProfileEntity } from '@/domain/profile'
import { launchProfile } from '@/features/launcher/launcher'
import type { EnginePort } from '@/port/engine.port'
import type { ProfileStorePort } from '@/port/store.port'

describe('Feature: Launcher', () => {
  it('coordinates store and engine port to build request and launch process', async () => {
    const fakeProfile = createProfileEntity('test-account')

    const mockStore: ProfileStorePort = {
      resolveUserDataDir: (name, engine) => `/vault/${engine}/profiles/${name}/user-data`,
      get: async (name) => (name === 'test-account' ? fakeProfile : null),
      list: async () => [fakeProfile],
      save: async () => {},
      delete: async () => true,
    }

    let capturedRequest: LaunchRequest | null = null

    const mockEngine: EnginePort = {
      name: 'prism',
      getKernelPath: async () => '/bin/fake-kernel',
      buildArgs: async (req) => {
        capturedRequest = req
        return ['--fake-arg', ...req.incomingArgs]
      },
      launch: async (req) => {
        capturedRequest = req
        return {
          engine: 'prism',
          process: {} as never,
          pid: 1234,
          userDataDir: req.userDataDir,
          effectiveArgs: ['--fake-arg', ...req.incomingArgs],
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
    expect(result.engine).toBe('prism')
    expect((capturedRequest as LaunchRequest | null)?.userDataDir).toBe(
      '/vault/prism/profiles/test-account/user-data',
    )
    expect(result.effectiveArgs).toContain('--remote-debugging-pipe')
  })

  it('automatically resolves and binds existing profile from session user-data-dir', async () => {
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

    await launchProfile(
      undefined,
      ['--user-data-dir=/tmp/agent-browser/sessions/google-main'],
      mockEngine,
      mockStore,
    )

    expect((capturedRequest as LaunchRequest | null)?.profile.name).toBe('google-main')
    expect((capturedRequest as LaunchRequest | null)?.profile.timezone).toBe('America/New_York')
    expect((capturedRequest as LaunchRequest | null)?.userDataDir).toBe(
      '/tmp/agent-browser/sessions/google-main',
    )
  })

  it('falls back gracefully to ephemeral profile for unmanaged session user-data-dir', async () => {
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

    expect((capturedRequest as LaunchRequest | null)?.profile.name).toBe('temp-worker-99')
    expect((capturedRequest as LaunchRequest | null)?.userDataDir).toBe(
      '/tmp/agent-browser/sessions/temp-worker-99',
    )
  })
})

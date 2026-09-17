import { describe, expect, it } from 'bun:test'
import type { LaunchRequest } from '@/domain/launch'
import { createProfileEntity } from '@/domain/profile'
import type { EnginePort } from '@/port/engine.port'
import type { ProfileStorePort } from '@/port/store.port'
import { launchProfile } from './launcher'

describe('Feature: Launcher', () => {
  it('throws error if specified profileName does not exist', async () => {
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

    expect(launchProfile('non-existent', undefined, [], mockEngine, mockStore)).rejects.toThrow(
      "Profile 'non-existent' not found for engine 'prism'",
    )
  })

  it('uses vault userDataDir when explicit profileName is supplied', async () => {
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

    const upstreamDir = '/upstream/specified/dir'
    const result = await launchProfile(
      'test-account',
      undefined,
      [`--user-data-dir=${upstreamDir}`, '--remote-debugging-pipe'],
      mockEngine,
      mockStore,
    )

    expect(result.pid).toBe(1234)
    expect((capturedRequest as LaunchRequest | null)?.profile.name).toBe('test-account')
    expect((capturedRequest as LaunchRequest | null)?.userDataDir).toBe(
      '/vault/prism/profiles/test-account/user-data',
    )
  })

  it('infers profile from incoming --user-data-dir when it points to vault directory', async () => {
    const testProfile = createProfileEntity('inferred-account')

    const mockStore: ProfileStorePort = {
      resolveUserDataDir: (name, engine) => `/vault/${engine}/profiles/${name}/user-data`,
      get: async (name) => (name === 'inferred-account' ? testProfile : null),
      list: async () => [testProfile],
      save: async () => {},
      delete: async () => true,
    }

    let capturedRequest: LaunchRequest | null = null

    const mockEngine: EnginePort = {
      name: 'prism',
      getKernelPath: async () => '/bin/fake-kernel',
      buildArgs: async (req) => req.incomingArgs,
      launch: async (req) => {
        capturedRequest = req
        return {
          engine: 'prism',
          process: {} as never,
          pid: 2222,
          userDataDir: req.userDataDir,
          effectiveArgs: req.incomingArgs,
        }
      },
    }

    const vaultDir = '/vault/prism/profiles/inferred-account/user-data'
    await launchProfile(
      undefined,
      undefined,
      [`--user-data-dir=${vaultDir}`, '--remote-debugging-pipe'],
      mockEngine,
      mockStore,
    )

    expect((capturedRequest as LaunchRequest | null)?.profile.name).toBe('inferred-account')
    expect((capturedRequest as LaunchRequest | null)?.userDataDir).toBe(vaultDir)
  })

  it('infers profile from Windows-style backslash incoming --user-data-dir', async () => {
    const testProfile = createProfileEntity('win-account')

    const mockStore: ProfileStorePort = {
      resolveUserDataDir: (name, engine) => `C:\\vault\\${engine}\\profiles\\${name}\\user-data`,
      get: async (name) => (name === 'win-account' ? testProfile : null),
      list: async () => [testProfile],
      save: async () => {},
      delete: async () => true,
    }

    let capturedRequest: LaunchRequest | null = null

    const mockEngine: EnginePort = {
      name: 'prism',
      getKernelPath: async () => 'C:\\bin\\fake-kernel.exe',
      buildArgs: async (req) => req.incomingArgs,
      launch: async (req) => {
        capturedRequest = req
        return {
          engine: 'prism',
          process: {} as never,
          pid: 3333,
          userDataDir: req.userDataDir,
          effectiveArgs: req.incomingArgs,
        }
      },
    }

    const winVaultDir = 'C:\\vault\\prism\\profiles\\win-account\\user-data'
    await launchProfile(
      undefined,
      undefined,
      [`--user-data-dir=${winVaultDir}`, '--remote-debugging-pipe'],
      mockEngine,
      mockStore,
    )

    expect((capturedRequest as LaunchRequest | null)?.profile.name).toBe('win-account')
    expect((capturedRequest as LaunchRequest | null)?.userDataDir).toBe(
      'C:\\vault\\prism\\profiles\\win-account\\user-data',
    )
  })

  it('respects incoming --user-data-dir for unmanaged ephemeral sessions even if session matches a profile', async () => {
    const testProfile = createProfileEntity('unmanaged-session')

    const mockStore: ProfileStorePort = {
      resolveUserDataDir: (name, engine) => `/vault/${engine}/profiles/${name}/user-data`,
      get: async (name) => (name === 'unmanaged-session' ? testProfile : null),
      list: async () => [testProfile],
      save: async () => {},
      delete: async () => true,
    }

    let capturedRequest: LaunchRequest | null = null

    const mockEngine: EnginePort = {
      name: 'prism',
      getKernelPath: async () => '/bin/fake-kernel',
      buildArgs: async (req) => req.incomingArgs,
      launch: async (req) => {
        capturedRequest = req
        return {
          engine: 'prism',
          process: {} as never,
          pid: 4321,
          userDataDir: req.userDataDir,
          effectiveArgs: req.incomingArgs,
        }
      },
    }

    const customEphemeralDir = '/tmp/custom-ephemeral-dir'
    await launchProfile(
      undefined,
      'unmanaged-session',
      [`--user-data-dir=${customEphemeralDir}`, '--remote-debugging-pipe'],
      mockEngine,
      mockStore,
    )

    expect((capturedRequest as LaunchRequest | null)?.profile.name).toBe('ephemeral')
    expect((capturedRequest as LaunchRequest | null)?.userDataDir).toBe(customEphemeralDir)
    expect((capturedRequest as LaunchRequest | null)?.incomingArgs).not.toContain(
      `--user-data-dir=${customEphemeralDir}`,
    )
  })

  it('correctly slices incoming --user-data-dir even if path contains equals signs (D5)', async () => {
    const mockStore: ProfileStorePort = {
      resolveUserDataDir: () => '',
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
          pid: 5678,
          userDataDir: req.userDataDir,
          effectiveArgs: req.incomingArgs,
        }
      },
    }

    const pathWithEquals = '/tmp/dir=with=equals/profile'
    await launchProfile(
      undefined,
      undefined,
      [`--user-data-dir=${pathWithEquals}`],
      mockEngine,
      mockStore,
    )

    expect((capturedRequest as LaunchRequest | null)?.userDataDir).toBe(pathWithEquals)
  })

  it('falls back to vault userDataDir when incoming --user-data-dir is absent and profile matches', async () => {
    const testProfile = createProfileEntity('managed-account')

    const mockStore: ProfileStorePort = {
      resolveUserDataDir: (name, engine) => `/vault/${engine}/profiles/${name}/user-data`,
      get: async (name) => (name === 'managed-account' ? testProfile : null),
      list: async () => [testProfile],
      save: async () => {},
      delete: async () => true,
    }

    let capturedRequest: LaunchRequest | null = null

    const mockEngine: EnginePort = {
      name: 'prism',
      getKernelPath: async () => '/bin/fake-kernel',
      buildArgs: async (req) => req.incomingArgs,
      launch: async (req) => {
        capturedRequest = req
        return {
          engine: 'prism',
          process: {} as never,
          pid: 1111,
          userDataDir: req.userDataDir,
          effectiveArgs: req.incomingArgs,
        }
      },
    }

    await launchProfile('managed-account', undefined, [], mockEngine, mockStore)

    expect((capturedRequest as LaunchRequest | null)?.userDataDir).toBe(
      '/vault/prism/profiles/managed-account/user-data',
    )
    expect((capturedRequest as LaunchRequest | null)?.profile.name).toBe('managed-account')
  })

  it('falls back to ephemeral temporary directory when incoming --user-data-dir is absent and profile does not match', async () => {
    const mockStore: ProfileStorePort = {
      resolveUserDataDir: () => '',
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

    await launchProfile(undefined, undefined, [], mockEngine, mockStore)

    expect((capturedRequest as LaunchRequest | null)?.userDataDir).toMatch(/stealth-ephemeral-/)
    expect((capturedRequest as LaunchRequest | null)?.profile.name).toBe('ephemeral')
  })
})

import { describe, expect, it } from 'bun:test'
import { createProfileEntity } from '@/domain/profile'
import type { ProfileStorePort } from '@/port/store.port'
import { rewriteShimArgs } from './shim-runner'

describe('Feature: Shim Runner', () => {
  const testProfile = createProfileEntity('worker-1')

  const mockStore: ProfileStorePort = {
    resolveUserDataDir: (name, engine) => `/vault/${engine}/profiles/${name}/user-data`,
    get: async (name) => (name === 'worker-1' ? testProfile : null),
    list: async () => [testProfile],
    save: async () => {},
    delete: async () => true,
  }

  it('prepends --profile with vault dir when session matches store', async () => {
    const originalArgs = ['--session', 'worker-1', 'open', 'https://example.com']
    const rewritten = await rewriteShimArgs(originalArgs, mockStore, 'prism')

    expect(rewritten).toEqual([
      '--profile',
      '/vault/prism/profiles/worker-1/user-data',
      '--session',
      'worker-1',
      'open',
      'https://example.com',
    ])
  })

  it('handles --session=value syntax and prepends --profile before subcommand', async () => {
    const originalArgs = ['--session=worker-1', 'eval', 'document.title']
    const rewritten = await rewriteShimArgs(originalArgs, mockStore, 'cloak')

    expect(rewritten).toEqual([
      '--profile',
      '/vault/cloak/profiles/worker-1/user-data',
      '--session=worker-1',
      'eval',
      'document.title',
    ])
  })

  it('leaves args unchanged when session does not match store', async () => {
    const originalArgs = ['--session', 'unknown-temp', 'open', 'https://example.com']
    const rewritten = await rewriteShimArgs(originalArgs, mockStore, 'prism')

    expect(rewritten).toEqual(originalArgs)
  })

  it('falls back to environment variable for session resolution', async () => {
    const originalArgs = ['open', 'https://example.com']
    const rewritten = await rewriteShimArgs(originalArgs, mockStore, 'prism', 'worker-1')

    expect(rewritten).toEqual([
      '--profile',
      '/vault/prism/profiles/worker-1/user-data',
      'open',
      'https://example.com',
    ])
  })

  it('preserves explicit absolute --profile path without touching store', async () => {
    const originalArgs = [
      '--profile',
      '/custom/absolute/path',
      '--session',
      'worker-1',
      'open',
      'https://example.com',
    ]
    const rewritten = await rewriteShimArgs(originalArgs, mockStore, 'prism')

    expect(rewritten).toEqual(originalArgs)
  })

  it('replaces explicit named --profile with vault path when it matches store', async () => {
    const originalArgs = ['--profile', 'worker-1', 'open', 'https://example.com']
    const rewritten = await rewriteShimArgs(originalArgs, mockStore, 'prism')

    expect(rewritten).toEqual([
      '--profile',
      '/vault/prism/profiles/worker-1/user-data',
      'open',
      'https://example.com',
    ])
  })

  it('throws error when explicit named --profile does not exist in store', async () => {
    const originalArgs = ['--profile', 'non-existent', 'open', 'https://example.com']

    expect(rewriteShimArgs(originalArgs, mockStore, 'prism')).rejects.toThrow(
      "Profile 'non-existent' not found for engine 'prism'",
    )
  })
})

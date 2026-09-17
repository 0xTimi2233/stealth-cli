import { describe, expect, it } from 'bun:test'
import { createProfileEntity } from '@/domain/profile'
import type { ProfileStorePort } from '@/port/store.port'
import { rewriteShimArgs } from './shim-runner'

describe('Feature: Shim Runner (Pure Whitelist)', () => {
  const testProfile = createProfileEntity('worker-1')

  const mockStore: ProfileStorePort = {
    resolveUserDataDir: (name, engine) => `/vault/${engine}/profiles/${name}/user-data`,
    get: async (name) => (name === 'worker-1' ? testProfile : null),
    list: async () => [testProfile],
    save: async () => {},
    delete: async () => true,
  }

  it('leaves args untouched when no --profile is specified, even if --session matches a profile name', async () => {
    const originalArgs = ['--session', 'worker-1', 'open', 'https://example.com']
    const rewritten = await rewriteShimArgs(originalArgs, mockStore, 'prism')

    expect(rewritten).toEqual(originalArgs)
  })

  it('leaves args untouched when no --profile is specified and session uses equals syntax', async () => {
    const originalArgs = ['--session=worker-1', 'eval', 'document.title']
    const rewritten = await rewriteShimArgs(originalArgs, mockStore, 'cloak')

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

  it('replaces --profile=name syntax with vault path when it matches store', async () => {
    const originalArgs = ['--profile=worker-1', 'open', 'https://example.com']
    const rewritten = await rewriteShimArgs(originalArgs, mockStore, 'cloak')

    expect(rewritten).toEqual([
      '--profile=/vault/cloak/profiles/worker-1/user-data',
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

  it('preserves tilde-prefixed --profile path without touching store', async () => {
    const originalArgs = ['--profile', '~/.custom/path', 'open', 'https://example.com']
    const rewritten = await rewriteShimArgs(originalArgs, mockStore, 'prism')

    expect(rewritten).toEqual(originalArgs)
  })

  it('throws error when explicit named --profile does not exist in store', async () => {
    const originalArgs = ['--profile', 'non-existent', 'open', 'https://example.com']

    expect(rewriteShimArgs(originalArgs, mockStore, 'prism')).rejects.toThrow(
      "Profile 'non-existent' not found for engine 'prism'",
    )
  })

  it('automatically preserves session profile binding across follow-up commands without explicit profile', async () => {
    const step1Args = [
      '--profile',
      'worker-1',
      '--session',
      'persisted-session',
      'open',
      'https://example.com',
    ]
    const step1Rewritten = await rewriteShimArgs(step1Args, mockStore, 'prism')
    expect(step1Rewritten).toEqual([
      '--profile',
      '/vault/prism/profiles/worker-1/user-data',
      '--session',
      'persisted-session',
      'open',
      'https://example.com',
    ])

    const step2Args = ['--session', 'persisted-session', 'snapshot', '-i']
    const step2Rewritten = await rewriteShimArgs(step2Args, mockStore, 'prism')
    expect(step2Rewritten).toEqual([
      '--profile',
      '/vault/prism/profiles/worker-1/user-data',
      '--session',
      'persisted-session',
      'snapshot',
      '-i',
    ])

    const step3Args = ['--session', 'persisted-session', 'close']
    await rewriteShimArgs(step3Args, mockStore, 'prism')

    const step4Args = ['--session', 'persisted-session', 'snapshot', '-i']
    const step4Rewritten = await rewriteShimArgs(step4Args, mockStore, 'prism')
    expect(step4Rewritten).toEqual(step4Args)
  })

  it('preserves all other flags and commands untouched', async () => {
    const originalArgs = ['--help', '-h', '--version', '-v', 'doctor', 'install']
    const rewritten = await rewriteShimArgs(originalArgs, mockStore, 'prism')

    expect(rewritten).toEqual(originalArgs)
  })
})

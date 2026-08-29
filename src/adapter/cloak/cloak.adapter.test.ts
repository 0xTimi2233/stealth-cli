import { describe, expect, it } from 'bun:test'
import { createProfileEntity } from '@/domain/profile'
import { CloakAdapter } from './cloak.adapter'

describe('Adapter: CloakAdapter', () => {
  it('generates official Cloak launch arguments with timezone, seed and automation filtering', async () => {
    const adapter = new CloakAdapter('/tmp/fake-cloak-kernel')
    const profile = createProfileEntity('cloak-account', {
      timezone: 'America/New_York',
      language: 'en-US',
      seed: 9966,
    })

    const args = await adapter.buildArgs({
      profile,
      engine: 'cloak',
      userDataDir: '/tmp/fake-vault/cloak/profiles/cloak-account/user-data',
      incomingArgs: ['--enable-automation', '--remote-debugging-pipe'],
    })

    expect(args).toBeArray()
    expect(args.some((a) => a === '--fingerprint=9966')).toBe(true)
    expect(
      args.some((a) => a === '--fingerprint-timezone=America/New_York'),
    ).toBe(true)
    expect(args.some((a) => a === '--fingerprint-locale=en-US')).toBe(true)
    expect(args.some((a) => a === '--lang=en-US')).toBe(true)
    // 必须确保排除了自动化特征
    expect(args.some((a) => a.includes('--enable-automation'))).toBe(false)
    expect(args.some((a) => a === '--remote-debugging-pipe')).toBe(true)
  })
})

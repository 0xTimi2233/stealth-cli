import { describe, expect, it } from 'bun:test'
import { createProfileEntity } from '@/domain/profile'
import { PrismAdapter } from './prism.adapter'

describe('Adapter: PrismAdapter', () => {
  it('generates official Prism launch arguments with correct flags', async () => {
    const adapter = new PrismAdapter('/tmp/fake-prism-kernel')
    const profile = createProfileEntity('prism-account', {
      timezone: 'Asia/Tokyo',
      language: 'en-US',
      seed: 8848,
    })

    const args = await adapter.buildArgs({
      profile,
      engine: 'prism',
      userDataDir: '/tmp/fake-vault/prism/profiles/prism-account/user-data',
      incomingArgs: ['--remote-debugging-pipe', '--headless'],
    })

    expect(args).toBeArray()
    expect(args.some((a) => a.startsWith('--fingerprint='))).toBe(true)
    expect(args.some((a) => a === '--timezone=Asia/Tokyo')).toBe(true)
    expect(args.some((a) => a === '--lang=en-US')).toBe(true)
    expect(args.some((a) => a === '--fingerprint-render-identity=v4')).toBe(
      true,
    )
    expect(args.some((a) => a === '--remote-debugging-pipe')).toBe(true)
  })
})

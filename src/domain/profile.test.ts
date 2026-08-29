import { describe, expect, it } from 'bun:test'
import { createProfileEntity, validateProfileName } from './profile'

describe('Domain: Profile', () => {
  it('validates profile names', () => {
    expect(validateProfileName('work-1')).toBe(true)
    expect(validateProfileName('twitter_account')).toBe(true)
    expect(validateProfileName('')).toBe(false)
    expect(validateProfileName('bad/name')).toBe(false)
  })

  it('creates profile with deterministic seed generation and default values', () => {
    const p1 = createProfileEntity('account-a', {
      timezone: 'Asia/Tokyo',
      language: 'en-US',
    })
    expect(p1.name).toBe('account-a')
    expect(p1.timezone).toBe('Asia/Tokyo')
    expect(p1.language).toBe('en-US')
    expect(typeof p1.seed).toBe('number')
    expect(p1.seed).toBeGreaterThan(0)
    expect(p1.screenWidth).toBe(1440)
    expect(p1.screenHeight).toBe(900)
  })
})

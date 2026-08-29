import { describe, expect, it } from 'bun:test'
import { resolveAppConfig } from './config'

describe('Feature: Config Slice', () => {
  it('resolves active engine and default configurations', async () => {
    const config = await resolveAppConfig('/tmp/fake-config-path.toml')
    expect(config.engine).toBe('prism')
    expect(config.defaults.timezone).toBe('Asia/Tokyo')
  })
})

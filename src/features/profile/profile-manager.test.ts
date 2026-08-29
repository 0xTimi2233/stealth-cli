import { describe, expect, it } from 'bun:test'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { FileStoreAdapter } from '@/adapter/store/file-store.adapter'
import { ProfileManager } from './profile-manager'

const VAULT_DIR = join(
  '/tmp/stealth-pm-test',
  Math.random().toString(36).slice(2),
)

describe('Feature: ProfileManager', () => {
  it('creates, lists and deletes profiles using the configured engine', async () => {
    const store = new FileStoreAdapter(VAULT_DIR)
    const manager = new ProfileManager(store, 'prism', {
      timezone: 'Asia/Tokyo',
      language: 'en-US',
      acceptLanguages: 'en-US,en',
      screenWidth: 1440,
      screenHeight: 900,
    })

    const created = await manager.create('test-work', {
      timezone: 'Asia/Shanghai',
    })
    expect(created.name).toBe('test-work')
    expect(created.timezone).toBe('Asia/Shanghai')
    expect(created.language).toBe('en-US')

    const list = await manager.list()
    expect(list.length).toBe(1)
    expect(list[0]?.name).toBe('test-work')

    const deleted = await manager.delete('test-work')
    expect(deleted).toBe(true)
    expect((await manager.list()).length).toBe(0)

    await rm(VAULT_DIR, { recursive: true, force: true }).catch(() => {})
  })
})

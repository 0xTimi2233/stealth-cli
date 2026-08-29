import { describe, expect, it } from 'bun:test'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { createProfileEntity } from '@/domain/profile'
import { FileStoreAdapter } from './file-store.adapter'

const TEST_VAULT = join('/tmp/stealth-store-test', Math.random().toString(36).slice(2))

describe('Adapter: FileStoreAdapter', () => {
  it('isolates profiles and user-data by adapter', async () => {
    const store = new FileStoreAdapter(TEST_VAULT)

    const prismUserDir = store.resolveUserDataDir('alpha', 'prism')
    const cloakUserDir = store.resolveUserDataDir('alpha', 'cloak')

    expect(prismUserDir).toBe(join(TEST_VAULT, 'prism/profiles/alpha/user-data'))
    expect(cloakUserDir).toBe(join(TEST_VAULT, 'cloak/profiles/alpha/user-data'))

    const profilePrism = createProfileEntity('alpha', {
      timezone: 'Asia/Tokyo',
    })
    await store.save(profilePrism, 'prism')

    const loadedPrism = await store.get('alpha', 'prism')
    const loadedCloak = await store.get('alpha', 'cloak')

    expect(loadedPrism?.name).toBe('alpha')
    expect(loadedCloak).toBeNull()

    const listPrism = await store.list('prism')
    expect(listPrism.length).toBe(1)

    const deleted = await store.delete('alpha', 'prism')
    expect(deleted).toBe(true)
    expect(await store.get('alpha', 'prism')).toBeNull()

    await rm(TEST_VAULT, { recursive: true, force: true }).catch(() => {})
  })
})

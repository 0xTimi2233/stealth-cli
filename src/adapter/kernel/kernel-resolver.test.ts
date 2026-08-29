import { describe, expect, it } from 'bun:test'
import { lstat, mkdir, readlink, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { resolveEngineExecutable } from './kernel-resolver'

const TEST_DIR = join('/tmp/stealth-kernel-resolver-test', Math.random().toString(36).slice(2))

describe('Adapter: Unified Kernel Resolver', () => {
  it('creates unified symlink and resolves executable for app bundles and binary files', async () => {
    const fakeApp = join(TEST_DIR, 'downloads/Chromium.app')
    await mkdir(fakeApp, { recursive: true })

    const execPath = await resolveEngineExecutable('cloak', fakeApp, TEST_DIR)

    const linkPath = join(TEST_DIR, 'engines/cloak/Chromium.app')
    const linkStat = await lstat(linkPath)
    expect(linkStat.isSymbolicLink()).toBe(true)

    const target = await readlink(linkPath)
    expect(target).toBe(fakeApp)
    expect(execPath).toContain('Contents/MacOS/Chromium')

    await rm(TEST_DIR, { recursive: true, force: true }).catch(() => {})
  })
})

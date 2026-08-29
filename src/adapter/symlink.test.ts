import { describe, expect, it } from 'bun:test'
import { lstat, mkdir, readlink, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { ensureEngineSymlink } from './symlink'

const TEST_DIR = join(
  '/tmp/stealth-symlink-test',
  Math.random().toString(36).slice(2),
)

describe('Adapter: Symlink Self-Healing', () => {
  it('automatically creates unified symlink pointing to real kernel binary_path', async () => {
    const fakeRealKernel = join(
      TEST_DIR,
      'downloads/chromium-v145/Chromium.app',
    )
    await mkdir(fakeRealKernel, { recursive: true })

    const resolvedExecutable = await ensureEngineSymlink(
      'cloak',
      fakeRealKernel,
      TEST_DIR,
    )

    const linkPath = join(TEST_DIR, 'engines/cloak/Chromium.app')
    const linkStat = await lstat(linkPath)
    expect(linkStat.isSymbolicLink()).toBe(true)

    const target = await readlink(linkPath)
    expect(target).toBe(fakeRealKernel)
    expect(resolvedExecutable).toBe(join(linkPath, 'Contents/MacOS/Chromium'))

    await rm(TEST_DIR, { recursive: true, force: true }).catch(() => {})
  })
})

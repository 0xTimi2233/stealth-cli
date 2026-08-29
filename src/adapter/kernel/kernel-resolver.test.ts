import { describe, expect, it } from 'bun:test'
import { lstat, mkdir, readlink } from 'node:fs/promises'
import { join } from 'node:path'
import { DarwinKernelAdapter } from './darwin-kernel.adapter'
import { LinuxKernelAdapter } from './linux-kernel.adapter'

const TEST_DIR = join('/tmp/stealth-kernel-adapter-test', Math.random().toString(36).slice(2))

describe('Adapter: KernelResolverPort Implementations', () => {
  it('DarwinKernelAdapter resolves .app bundles to inner Chromium executable', async () => {
    const fakeRealKernel = join(TEST_DIR, 'downloads/chromium-v145/Chromium.app')
    await mkdir(fakeRealKernel, { recursive: true })

    const adapter = new DarwinKernelAdapter(TEST_DIR)
    const executable = await adapter.resolveExecutable('cloak', fakeRealKernel)

    const linkPath = join(TEST_DIR, 'engines/cloak/Chromium.app')
    const linkStat = await lstat(linkPath)
    expect(linkStat.isSymbolicLink()).toBe(true)

    const target = await readlink(linkPath)
    expect(target).toBe(fakeRealKernel)
    expect(executable).toBe(join(linkPath, 'Contents/MacOS/Chromium'))
  })

  it('LinuxKernelAdapter resolves direct binary files cleanly', async () => {
    const fakeRealBinary = join(TEST_DIR, 'downloads/chromium/chrome')
    await mkdir(join(TEST_DIR, 'downloads/chromium'), { recursive: true })

    const adapter = new LinuxKernelAdapter(TEST_DIR)
    const executable = await adapter.resolveExecutable('prism', fakeRealBinary)

    const linkPath = join(TEST_DIR, 'engines/prism/chrome')
    const linkStat = await lstat(linkPath)
    expect(linkStat.isSymbolicLink()).toBe(true)

    const target = await readlink(linkPath)
    expect(target).toBe(fakeRealBinary)
    expect(executable).toBe(linkPath)
  })
})

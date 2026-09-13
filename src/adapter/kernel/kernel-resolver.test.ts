import { describe, expect, it } from 'bun:test'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { resolveEngineExecutable } from './kernel-resolver'

describe('Adapter: Unified Kernel Resolver', () => {
  it('resolves app bundles directly to Contents/MacOS/Chromium without creating symlinks', () => {
    const fakeApp = '/Applications/Prism Browser.app'
    const execPath = resolveEngineExecutable(fakeApp)

    expect(execPath).toBe('/Applications/Prism Browser.app/Contents/MacOS/Chromium')
  })

  it('expands tilde paths correctly', () => {
    const tildePath = '~/.cache/cloakbrowser/chromium/Chromium.app'
    const execPath = resolveEngineExecutable(tildePath)

    const expected = join(
      homedir(),
      '.cache/cloakbrowser/chromium/Chromium.app/Contents/MacOS/Chromium',
    )
    expect(execPath).toBe(expected)
  })

  it('returns non-app binary paths directly', () => {
    const binaryPath = '/usr/bin/chromium'
    const execPath = resolveEngineExecutable(binaryPath)

    expect(execPath).toBe('/usr/bin/chromium')
  })
})

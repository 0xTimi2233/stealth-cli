import { describe, expect, it } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const AGENT_BROWSER_BIN = process.env.AGENT_BROWSER_BIN || join(homedir(), '.bun/bin/agent-browser')
const STEALTH_LAUNCHER_PATH = join(import.meta.dir, '../../src/features/cli/cli.ts')
const hasAgentBrowser = existsSync(AGENT_BROWSER_BIN)

function execAgentBrowser(
  session: string,
  args: string[],
  env: Record<string, string> = {},
): string {
  const proc = spawnSync(AGENT_BROWSER_BIN, ['--session', session, ...args], {
    encoding: 'utf8',
    env: {
      ...process.env,
      AGENT_BROWSER_EXECUTABLE_PATH: STEALTH_LAUNCHER_PATH,
      ...env,
    },
  })
  if (proc.status !== 0) {
    throw new Error(`agent-browser failed (${proc.status}): ${proc.stderr || proc.stdout}`)
  }
  return proc.stdout.trim()
}

describe.skipIf(!hasAgentBrowser)('Real Browser E2E Runner (Deterministic & Non-semantic)', () => {
  it('launches real Chromium via Prism engine, executes DOM eval and closes cleanly', () => {
    const session = `e2e-prism-${Date.now()}`
    try {
      const openOut = execAgentBrowser(session, ['open', 'https://example.com'], {
        STEALTH_ENGINE: 'prism',
      })
      expect(openOut).toContain('Example Domain')

      const titleOut = execAgentBrowser(session, ['eval', 'document.title'], {
        STEALTH_ENGINE: 'prism',
      })
      expect(titleOut).toContain('Example Domain')

      const gpuOut = execAgentBrowser(
        session,
        [
          'eval',
          `(() => {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl');
            const ext = gl ? gl.getExtension('WEBGL_debug_renderer_info') : null;
            return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'none';
          })()`,
        ],
        { STEALTH_ENGINE: 'prism' },
      )
      expect(gpuOut.toLowerCase()).not.toContain('swiftshader')
    } finally {
      try {
        execAgentBrowser(session, ['close'])
      } catch {
        // cleanup suppression
      }
    }
  })

  it('launches real Chromium via Cloak engine, executes DOM eval and closes cleanly', () => {
    const session = `e2e-cloak-${Date.now()}`
    try {
      const openOut = execAgentBrowser(session, ['open', 'https://example.com'], {
        STEALTH_ENGINE: 'cloak',
      })
      expect(openOut).toContain('Example Domain')

      const titleOut = execAgentBrowser(session, ['eval', 'document.title'], {
        STEALTH_ENGINE: 'cloak',
      })
      expect(titleOut).toContain('Example Domain')
    } finally {
      try {
        execAgentBrowser(session, ['close'])
      } catch {
        // cleanup suppression
      }
    }
  })
})

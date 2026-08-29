import { describe, expect, it } from 'bun:test'
import { spawnSync } from 'node:child_process'

const AGENT_BROWSER_BIN = '/Users/sony/.bun/bin/agent-browser'

function execAgentBrowser(
  session: string,
  args: string[],
  env: Record<string, string> = {},
): string {
  const proc = spawnSync(AGENT_BROWSER_BIN, ['--session', session, ...args], {
    encoding: 'utf8',
    env: {
      ...process.env,
      ...env,
    },
  })
  if (proc.status !== 0) {
    throw new Error(
      `agent-browser failed (${proc.status}): ${proc.stderr || proc.stdout}`,
    )
  }
  return proc.stdout.trim()
}

describe('Real Browser E2E Runner (Deterministic & Non-semantic)', () => {
  it('launches real Chromium via Prism engine, executes DOM eval and closes cleanly', () => {
    const session = `e2e-prism-${Date.now()}`
    try {
      const openOut = execAgentBrowser(
        session,
        ['open', 'https://example.com'],
        {
          STEALTH_ENGINE: 'prism',
        },
      )
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
      execAgentBrowser(session, ['close']).catch?.(() => {})
    }
  })

  it('launches real Chromium via Cloak engine, executes DOM eval and closes cleanly', () => {
    const session = `e2e-cloak-${Date.now()}`
    try {
      const openOut = execAgentBrowser(
        session,
        ['open', 'https://example.com'],
        {
          STEALTH_ENGINE: 'cloak',
        },
      )
      expect(openOut).toContain('Example Domain')

      const titleOut = execAgentBrowser(session, ['eval', 'document.title'], {
        STEALTH_ENGINE: 'cloak',
      })
      expect(titleOut).toContain('Example Domain')
    } finally {
      execAgentBrowser(session, ['close']).catch?.(() => {})
    }
  })
})

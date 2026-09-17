import { describe, expect, it } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
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
      } catch {}
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
      } catch {}
    }
  })

  it('binds persistent profile to vault user-data-dir and passes DevToolsActivePort handshake without timeout', () => {
    const testDir = join(tmpdir(), `stealth-e2e-${Date.now()}`)
    const shimDir = join(testDir, 'bin')
    const configPath = join(testDir, 'config.toml')
    const session = `e2e-persist-${Date.now()}`

    try {
      mkdirSync(testDir, { recursive: true })
      copyFileSync(join(homedir(), '.stealth/config.toml'), configPath)

      const createProc = spawnSync('bun', [STEALTH_LAUNCHER_PATH, 'create', session], {
        encoding: 'utf8',
        env: { ...process.env, STEALTH_HOME: testDir, STEALTH_ENGINE: 'prism' },
      })
      expect(createProc.status).toBe(0)

      const installProc = spawnSync(
        'bun',
        [STEALTH_LAUNCHER_PATH, 'shim', '--install', '--dir', shimDir],
        {
          encoding: 'utf8',
          env: { ...process.env, STEALTH_HOME: testDir },
        },
      )
      expect(installProc.status).toBe(0)

      // 在 shimDir 中提供指向当前源码 CLI 的 stealth-cli 脚本，确保 shim 脚本调用时命中当前最新代码
      const stealthCliShim = join(shimDir, 'stealth-cli')
      writeFileSync(stealthCliShim, `#!/bin/sh\nexec bun "${STEALTH_LAUNCHER_PATH}" "$@"\n`, {
        mode: 0o755,
      })

      const shimBin = join(shimDir, 'agent-browser')
      const openProc = spawnSync(
        shimBin,
        ['--profile', session, '--session', session, 'open', 'https://example.com'],
        {
          encoding: 'utf8',
          env: {
            ...process.env,
            PATH: `${shimDir}:${process.env.PATH}`,
            STEALTH_HOME: testDir,
            STEALTH_ENGINE: 'prism',
            AGENT_BROWSER_EXECUTABLE_PATH: STEALTH_LAUNCHER_PATH,
          },
        },
      )
      expect(openProc.status).toBe(0)
      expect(openProc.stdout).toContain('Example Domain')

      const portFile = join(
        testDir,
        'vault/prism/profiles',
        session,
        'user-data/DevToolsActivePort',
      )
      expect(existsSync(portFile)).toBe(true)

      spawnSync(shimBin, ['--session', session, 'close'], {
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: `${shimDir}:${process.env.PATH}`,
          STEALTH_HOME: testDir,
          STEALTH_ENGINE: 'prism',
          AGENT_BROWSER_EXECUTABLE_PATH: STEALTH_LAUNCHER_PATH,
        },
      })
    } finally {
      rmSync(testDir, { recursive: true, force: true })
    }
  })
})

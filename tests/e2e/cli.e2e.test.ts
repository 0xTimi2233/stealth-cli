import { afterAll, describe, expect, it } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { chmodSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const CLI_PATH = join(import.meta.dir, '../../src/features/cli/cli.ts')
const TEST_STEALTH_HOME = resolve(tmpdir(), 'stealth-test-e2e')

function runCli(...args: string[]): {
  status: number
  stdout: string
  stderr: string
} {
  const proc = spawnSync('bun', ['run', CLI_PATH, ...args], {
    encoding: 'utf8',
    env: {
      ...process.env,
      STEALTH_HOME: TEST_STEALTH_HOME,
    },
  })
  return {
    status: proc.status ?? 1,
    stdout: proc.stdout.trim(),
    stderr: proc.stderr.trim(),
  }
}

function createMockUpstream(name: string, contentUnix: string, contentWin: string): string {
  if (process.platform === 'win32') {
    const p = join(TEST_STEALTH_HOME, `${name}.cmd`)
    writeFileSync(p, contentWin)
    return p
  }
  const p = join(TEST_STEALTH_HOME, `${name}.sh`)
  writeFileSync(p, contentUnix, { mode: 0o755 })
  chmodSync(p, 0o755)
  return p
}

describe('CLI E2E', () => {
  afterAll(() => {
    try {
      rmSync(TEST_STEALTH_HOME, { recursive: true, force: true })
    } catch {}
  })
  it('executes list command and outputs clean JSON array', () => {
    const res = runCli('list')
    expect(res.status).toBe(0)
    const json = JSON.parse(res.stdout)
    expect(Array.isArray(json)).toBe(true)
  })

  it('creates, inspects launch-args, and deletes a profile via clean JSON output', () => {
    const createRes = runCli('create', 'e2e-account', '--timezone', 'Asia/Tokyo')
    expect(createRes.status).toBe(0)
    const created = JSON.parse(createRes.stdout)
    expect(created.success).toBe(true)
    expect(created.name).toBe('e2e-account')

    const argsRes = runCli('launch-args', '--profile', 'e2e-account')
    expect(argsRes.status).toBe(0)
    const args = JSON.parse(argsRes.stdout)
    expect(Array.isArray(args)).toBe(true)
    expect(args.some((a: string) => a.includes('e2e-account'))).toBe(true)

    const delRes = runCli('delete', 'e2e-account')
    expect(delRes.status).toBe(0)
    const deleted = JSON.parse(delRes.stdout)
    expect(deleted.success).toBe(true)
  })

  it('outputs help text without launching browser or hanging for --help and -h', () => {
    const longHelp = runCli('--help')
    expect(longHelp.status).toBe(0)
    expect(longHelp.stdout).toContain('stealth-cli - 通用隐形浏览器环境管理套件与自动化代理层')
    expect(longHelp.stdout).toContain('可用命令:')
    expect(longHelp.stdout).not.toContain('launch-args')
    expect(longHelp.stdout).not.toMatch(/\blaunch\b.*启动指定环境/)
    expect(longHelp.stderr).toBe('')

    const shortHelp = runCli('-h')
    expect(shortHelp.status).toBe(0)
    expect(shortHelp.stdout).toBe(longHelp.stdout)
  })

  it('outputs version string for --version and -v', () => {
    const longVer = runCli('--version')
    expect(longVer.status).toBe(0)
    expect(longVer.stdout).toMatch(/^stealth-cli v\d+\.\d+\.\d+$/)
    expect(longVer.stderr).toBe('')

    const shortVer = runCli('-v')
    expect(shortVer.status).toBe(0)
    expect(shortVer.stdout).toBe(longVer.stdout)
  })

  it('forwards --help to upstream when invoking via shim without intercepting with stealth-cli help', () => {
    const mockUpstreamPath = createMockUpstream(
      'mock-upstream-help',
      '#!/bin/sh\necho "agent-browser v0.5.0 upstream official help"\nexit 0\n',
      '@echo off\r\necho agent-browser v0.5.0 upstream official help\r\nexit /b 0\r\n',
    )

    const res = runCli('shim', '--upstream', mockUpstreamPath, '--help')
    expect(res.status).toBe(0)
    expect(res.stdout).toContain('agent-browser v0.5.0 upstream official help')
    expect(res.stdout).not.toContain('stealth-cli - 通用隐形浏览器')
  })

  it('translates --profile <name> to vault path in shim, keeping --session and commands untouched', () => {
    runCli('create', 'shim-target-account')

    const mockUpstreamPath = createMockUpstream(
      'mock-upstream-args',
      '#!/bin/sh\nprintf "%s\\n" "$@"\nexit 0\n',
      '@echo off\r\n:loop\r\nif "%~1"=="" goto end\r\necho %~1\r\nshift\r\ngoto loop\r\n:end\r\nexit /b 0\r\n',
    )

    const res = runCli(
      'shim',
      '--upstream',
      mockUpstreamPath,
      '--profile',
      'shim-target-account',
      '--session',
      'my-task-session',
      'open',
      'https://example.com',
    )
    expect(res.status).toBe(0)
    const lines = res.stdout.split(/\r?\n/)
    const profileIdx = lines.indexOf('--profile')
    expect(profileIdx).toBeGreaterThanOrEqual(0)
    expect(lines[profileIdx + 1]).toMatch(
      /[/\\]vault[/\\]prism[/\\]profiles[/\\]shim-target-account[/\\]user-data/,
    )

    const sessionIdx = lines.indexOf('--session')
    expect(sessionIdx).toBeGreaterThanOrEqual(0)
    expect(lines[sessionIdx + 1]).toBe('my-task-session')

    expect(lines).toContain('open')
    expect(lines).toContain('https://example.com')

    runCli('delete', 'shim-target-account')
  })

  it('passes arguments pure and untouched without injecting --profile when no --profile is specified', () => {
    runCli('create', 'ephemeral-named-session')

    const mockUpstreamPath = createMockUpstream(
      'mock-upstream-pure',
      '#!/bin/sh\nprintf "%s\\n" "$@"\nexit 0\n',
      '@echo off\r\n:loop\r\nif "%~1"=="" goto end\r\necho %~1\r\nshift\r\ngoto loop\r\n:end\r\nexit /b 0\r\n',
    )

    const res = runCli(
      'shim',
      '--upstream',
      mockUpstreamPath,
      '--session',
      'ephemeral-named-session',
      'open',
      'https://example.com',
    )
    expect(res.status).toBe(0)
    const lines = res.stdout.split(/\r?\n/)
    expect(lines).not.toContain('--profile')
    expect(lines).toContain('--session')
    expect(lines).toContain('ephemeral-named-session')

    runCli('delete', 'ephemeral-named-session')
  })
})

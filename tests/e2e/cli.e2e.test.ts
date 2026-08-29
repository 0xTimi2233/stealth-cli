import { describe, expect, it } from 'bun:test'
import { spawnSync } from 'node:child_process'
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

describe('CLI E2E', () => {
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
})

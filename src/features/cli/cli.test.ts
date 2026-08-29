import { describe, expect, it } from 'bun:test'
import { CloakAdapter } from '@/adapter/cloak/cloak.adapter'
import { TomlConfigAdapter } from '@/adapter/config/toml-config.adapter'
import { PrismAdapter } from '@/adapter/prism/prism.adapter'
import { FileStoreAdapter } from '@/adapter/store/file-store.adapter'
import { handleCliCommand } from './cli'

const TEST_VAULT = `/tmp/stealth-cli-test-${Math.random().toString(36).slice(2)}`

describe('Feature: CLI Handler', () => {
  it('handles list, create, launch-args and delete commands returning clean JSON strings', async () => {
    const store = new FileStoreAdapter(TEST_VAULT)
    const configAdapter = new TomlConfigAdapter('/tmp/non-existent.toml')
    const config = await configAdapter.load()

    const engines = {
      prism: new PrismAdapter('/tmp/fake-prism'),
      cloak: new CloakAdapter('/tmp/fake-cloak'),
    }

    const createdOut = await handleCliCommand(
      ['create', 'cli-test', '--timezone', 'Asia/Tokyo'],
      config,
      store,
      engines,
    )
    const createdJson = JSON.parse(createdOut)
    expect(createdJson.success).toBe(true)
    expect(createdJson.name).toBe('cli-test')

    const listOut = await handleCliCommand(['list'], config, store, engines)
    const listJson = JSON.parse(listOut)
    expect(Array.isArray(listJson)).toBe(true)
    expect(listJson[0]?.name).toBe('cli-test')

    const argsOut = await handleCliCommand(
      ['launch-args', '--profile', 'cli-test'],
      config,
      store,
      engines,
    )
    const argsJson = JSON.parse(argsOut)
    expect(Array.isArray(argsJson)).toBe(true)
    expect(argsJson.some((a: string) => a.includes('cli-test'))).toBe(true)

    const delOut = await handleCliCommand(['delete', 'cli-test'], config, store, engines)
    expect(JSON.parse(delOut).success).toBe(true)

    const installOut = await handleCliCommand(['install', 'prism'], config, store, engines)
    expect(JSON.parse(installOut).success).toBe(true)
  })
})

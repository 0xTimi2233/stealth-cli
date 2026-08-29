import { describe, expect, it } from 'bun:test'
import { CloakAdapter } from '@/adapter/cloak/cloak.adapter'
import { TomlConfigAdapter } from '@/adapter/config/toml-config.adapter'
import { PrismAdapter } from '@/adapter/prism/prism.adapter'
import { FileStoreAdapter } from '@/adapter/store/file-store.adapter'
import { ProfileManager } from '@/features/profile/profile-manager'

const VAULT_ROOT = `/tmp/stealth-pipeline-test-${Math.random().toString(36).slice(2)}`

describe('Integration: Dual Engine Pipeline', () => {
  it('generates completely coherent args for both Prism and Cloak engines independently', async () => {
    const configAdapter = new TomlConfigAdapter('/tmp/non-existent.toml')
    const config = await configAdapter.load()
    const store = new FileStoreAdapter(VAULT_ROOT)

    const prismAdapter = new PrismAdapter(config.engines.prism.binaryPath)
    const cloakAdapter = new CloakAdapter(config.engines.cloak.binaryPath)

    // 1. 在 Prism 引擎下创建环境
    const pmPrism = new ProfileManager(store, 'prism', config.defaults)
    const pPrism = await pmPrism.create('worker-tokyo', {
      timezone: 'Asia/Tokyo',
    })

    const prismArgs = await prismAdapter.buildArgs({
      profile: pPrism,
      engine: 'prism',
      userDataDir: store.resolveUserDataDir('worker-tokyo', 'prism'),
      incomingArgs: ['--remote-debugging-pipe'],
    })

    expect(prismArgs.some((a) => a === '--timezone=Asia/Tokyo')).toBe(true)
    expect(
      prismArgs.some((a) =>
        a.includes('/prism/profiles/worker-tokyo/user-data'),
      ),
    ).toBe(true)

    // 2. 在 Cloak 引擎下创建同名环境 (物理数据隔离)
    const pmCloak = new ProfileManager(store, 'cloak', config.defaults)
    const pCloak = await pmCloak.create('worker-tokyo', {
      timezone: 'America/New_York',
    })

    const cloakArgs = await cloakAdapter.buildArgs({
      profile: pCloak,
      engine: 'cloak',
      userDataDir: store.resolveUserDataDir('worker-tokyo', 'cloak'),
      incomingArgs: ['--enable-automation', '--remote-debugging-pipe'],
    })

    expect(
      cloakArgs.some((a) => a === '--fingerprint-timezone=America/New_York'),
    ).toBe(true)
    expect(
      cloakArgs.some((a) =>
        a.includes('/cloak/profiles/worker-tokyo/user-data'),
      ),
    ).toBe(true)
    expect(cloakArgs.some((a) => a.includes('--enable-automation'))).toBe(false)
  })
})

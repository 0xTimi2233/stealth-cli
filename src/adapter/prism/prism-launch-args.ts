import type { Profile } from '@/domain/profile'

export interface PrismLaunchOptions {
  userDataDir: string
  proxyUrl?: string
  incomingArgs?: string[]
}

export function buildPrismOfficialArgs(profile: Profile, options: PrismLaunchOptions): string[] {
  const platform = process.platform === 'darwin' ? 'macos' : 'windows'
  const args = [
    `--user-data-dir=${options.userDataDir}`,
    `--fingerprint=${profile.seed}`,
    `--fingerprint-platform=${platform}`,
    '--fingerprint-brand=Chrome',
    `--fingerprint-hardware-concurrency=8`,
    `--fingerprint-screen-width=${profile.screenWidth}`,
    `--fingerprint-screen-height=${profile.screenHeight}`,
    `--fingerprint-language=${profile.language}`,
    `--lang=${profile.language}`,
    `--accept-lang=${profile.acceptLanguages}`,
    `--timezone=${profile.timezone}`,
    `--window-size=${profile.screenWidth},${profile.screenHeight}`,
    `--window-name=[0] ${profile.name}`,
    `--prism-profile-serial=0`,
    `--prism-profile-id=${profile.name}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-mode',
    '--disable-background-networking',
    '--disable-component-update',
    '--fingerprint-platform-version=15.0.0',
    '--fingerprint-render-identity=v4',
    '--disable-non-proxied-udp',
    '--webrtc-ip-handling-policy=disable_non_proxied_udp',
  ]

  if (options.proxyUrl) {
    args.push(
      '--disable-quic',
      '--dns-prefetch-disable',
      '--no-pings',
      `--proxy-server=${options.proxyUrl}`,
      '--proxy-bypass-list=localhost;127.0.0.1',
    )
  }

  const officialKeys = new Set(args.map((a) => a.split('=')[0]))
  const sanitizedExtra = (options.incomingArgs || []).filter((arg) => {
    const key = arg.split('=')[0]
    return !officialKeys.has(key) && !arg.includes('--enable-unsafe-swiftshader')
  })

  return [...args, ...sanitizedExtra]
}

import { defaultProfileDraft } from '@prism/shared/defaults'
import type { BrowserProfile } from '@prism/shared/types'
import type { Profile } from '../../domain/profile'

export function toPrismBrowserProfile(domainProfile: Profile): BrowserProfile {
  const draft = defaultProfileDraft()
  const fp = draft.fingerprint

  fp.seed = domainProfile.seed
  fp.timezone = domainProfile.timezone
  fp.language = domainProfile.language
  fp.acceptLanguages = domainProfile.acceptLanguages
  fp.screenWidth = domainProfile.screenWidth
  fp.screenHeight = domainProfile.screenHeight
  fp.renderIdentityVersion = 4

  return {
    ...draft,
    id: domainProfile.name,
    serialNumber: 0,
    name: domainProfile.name,
    status: 'closed',
    createdAt: domainProfile.createdAt,
    updatedAt: domainProfile.updatedAt,
    fingerprint: fp,
  }
}

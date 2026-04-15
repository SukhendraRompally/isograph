/**
 * LinkedIn OAuth helpers for Isograph.
 * Uses Authorization Code flow (not PKCE — LinkedIn doesn't support PKCE).
 * Scopes required: openid, profile, email, w_member_social, r_member_social
 */

export const LINKEDIN_SCOPES = [
  'openid',
  'profile',
  'email',
  'w_member_social',
  // r_member_social requires LinkedIn Marketing Developer Platform approval (weeks)
  // Add back once approved
].join(' ')

export function getLinkedInAuthUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.LINKEDIN_CLIENT_ID!,
    redirect_uri: process.env.LINKEDIN_REDIRECT_URI!,
    scope: LINKEDIN_SCOPES,
    state,
  })
  return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`
}

export interface LinkedInTokenResponse {
  access_token: string
  expires_in: number
  refresh_token?: string
  refresh_token_expires_in?: number
  scope: string
  token_type: string
}

export async function exchangeCodeForToken(code: string): Promise<LinkedInTokenResponse> {
  const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.LINKEDIN_REDIRECT_URI!,
      client_id: process.env.LINKEDIN_CLIENT_ID!,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`LinkedIn token exchange failed: ${text}`)
  }

  return res.json() as Promise<LinkedInTokenResponse>
}

export async function refreshLinkedInToken(refreshToken: string): Promise<LinkedInTokenResponse> {
  const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.LINKEDIN_CLIENT_ID!,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`LinkedIn token refresh failed: ${text}`)
  }

  return res.json() as Promise<LinkedInTokenResponse>
}

/** Generate a random state value for CSRF protection */
export function generateOAuthState(): string {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
}

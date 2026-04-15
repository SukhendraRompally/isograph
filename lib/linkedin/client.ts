/**
 * LinkedIn API client for Isograph.
 * Handles: profile fetch, post creation (Share API), analytics fetch.
 */

const LINKEDIN_API_BASE = 'https://api.linkedin.com/v2'
const LINKEDIN_REST_BASE = 'https://api.linkedin.com/rest'

export interface LinkedInProfile {
  sub: string          // LinkedIn member URN (openid)
  name: string
  given_name: string
  family_name: string
  picture?: string
  email?: string
  headline?: string
}

export async function getLinkedInProfile(accessToken: string): Promise<LinkedInProfile> {
  const res = await fetch('https://api.linkedin.com/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`LinkedIn profile fetch failed: ${res.status}`)
  return res.json() as Promise<LinkedInProfile>
}

export interface CreatePostOptions {
  accessToken: string
  authorUrn: string   // urn:li:person:{id}
  text: string
  visibility?: 'PUBLIC' | 'CONNECTIONS'
}

export interface CreatePostResult {
  postUrn: string   // urn:li:share:{id} or urn:li:ugcPost:{id}
  shareUrl: string
}

export async function createLinkedInPost(opts: CreatePostOptions): Promise<CreatePostResult> {
  const { accessToken, authorUrn, text, visibility = 'PUBLIC' } = opts

  const body = {
    author: authorUrn,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text },
        shareMediaCategory: 'NONE',
      },
    },
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': visibility,
    },
  }

  const res = await fetch(`${LINKEDIN_API_BASE}/ugcPosts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`LinkedIn post creation failed: ${errorText}`)
  }

  const postUrn = res.headers.get('x-restli-id') ?? ''
  const encodedUrn = encodeURIComponent(postUrn)
  const shareUrl = `https://www.linkedin.com/feed/update/${encodedUrn}`

  return { postUrn, shareUrl }
}

export interface PostAnalyticsData {
  impressionCount: number
  clickCount: number
  likeCount: number
  commentCount: number
  shareCount: number
  engagementCount: number
}

export async function getPostAnalytics(
  accessToken: string,
  postUrn: string
): Promise<PostAnalyticsData | null> {
  const encoded = encodeURIComponent(postUrn)

  const res = await fetch(
    `${LINKEDIN_REST_BASE}/socialActions/${encoded}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'LinkedIn-Version': '202304',
      },
    }
  )

  if (!res.ok) return null

  const data = await res.json()

  return {
    impressionCount: data.totalShareStatistics?.impressionCount ?? 0,
    clickCount: data.totalShareStatistics?.clickCount ?? 0,
    likeCount: data.totalShareStatistics?.likeCount ?? 0,
    commentCount: data.totalShareStatistics?.commentCount ?? 0,
    shareCount: data.totalShareStatistics?.shareCount ?? 0,
    engagementCount: data.totalShareStatistics?.engagement ?? 0,
  }
}

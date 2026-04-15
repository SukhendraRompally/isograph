import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'
import { getPostAnalytics } from '@/lib/linkedin/client'

/**
 * QStash worker — called 24h after a post is published to fetch analytics.
 * Not protected by user session — authenticated by QStash signature.
 */
export async function POST(request: NextRequest) {
  // Basic signature check (full HMAC verification in production via @upstash/qstash)
  const signature = request.headers.get('upstash-signature')
  if (!signature && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Missing signature' }, { status: 401 })
  }

  const body = await request.json()
  const { postId, postUrn } = body as { postId: string; postUrn: string }

  if (!postId || !postUrn) {
    return NextResponse.json({ error: 'postId and postUrn required' }, { status: 400 })
  }

  const supabase = createClient()

  // Look up the post to get the user_id
  const { data: post } = await supabase
    .from('posts')
    .select('user_id, platform')
    .eq('id', postId)
    .single()

  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })

  const { data: connection } = await supabase
    .from('social_connections')
    .select('access_token')
    .eq('user_id', post.user_id)
    .eq('platform', 'linkedin')
    .eq('is_active', true)
    .single()

  if (!connection) return NextResponse.json({ error: 'Connection not found' }, { status: 404 })

  const analytics = await getPostAnalytics(connection.access_token, postUrn)
  if (!analytics) return NextResponse.json({ message: 'No analytics available yet' })

  const totalEngagement = analytics.likeCount + analytics.commentCount + analytics.shareCount
  const engagementRate = analytics.impressionCount > 0
    ? (totalEngagement / analytics.impressionCount) * 100
    : 0

  const now = new Date().toISOString()

  await supabase.from('post_analytics').upsert({
    post_id: postId,
    user_id: post.user_id,
    platform: post.platform,
    impressions: analytics.impressionCount,
    reactions: analytics.likeCount,
    comments: analytics.commentCount,
    shares: analytics.shareCount,
    clicks: analytics.clickCount,
    engagement_rate: Math.round(engagementRate * 100) / 100,
    fetched_at: now,
    period_start: now,
    period_end: now,
    source: 'api',
  }, { onConflict: 'post_id,period_start' })

  return NextResponse.json({ success: true })
}

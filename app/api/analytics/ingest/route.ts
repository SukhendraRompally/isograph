import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getPostAnalytics } from '@/lib/linkedin/client'

export async function POST() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch all published posts without recent analytics
  const { data: posts } = await supabase
    .from('posts')
    .select('id, platform_post_id, platform')
    .eq('user_id', user.id)
    .eq('status', 'published')
    .not('platform_post_id', 'is', null)

  if (!posts || posts.length === 0) {
    return NextResponse.json({ message: 'No published posts to ingest', ingested: 0 })
  }

  const { data: connection } = await supabase
    .from('social_connections')
    .select('access_token')
    .eq('user_id', user.id)
    .eq('platform', 'linkedin')
    .eq('is_active', true)
    .single()

  if (!connection) {
    return NextResponse.json({ error: 'LinkedIn not connected' }, { status: 400 })
  }

  let ingested = 0
  const now = new Date().toISOString()

  for (const post of posts) {
    if (!post.platform_post_id) continue

    try {
      const analytics = await getPostAnalytics(connection.access_token, post.platform_post_id)
      if (!analytics) continue

      const totalEngagement = analytics.likeCount + analytics.commentCount + analytics.shareCount
      const engagementRate = analytics.impressionCount > 0
        ? (totalEngagement / analytics.impressionCount) * 100
        : 0

      await supabase.from('post_analytics').upsert({
        post_id: post.id,
        user_id: user.id,
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

      ingested++
    } catch {
      // Non-fatal — continue with next post
    }
  }

  return NextResponse.json({ ingested })
}

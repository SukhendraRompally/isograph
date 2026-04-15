import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Recent posts with analytics
  const { data: posts } = await supabase
    .from('posts')
    .select(`
      id, platform, status, published_content, generated_content,
      was_edited, published_at, created_at, opportunity_snapshot,
      post_analytics (
        impressions, reactions, comments, shares, clicks,
        engagement_rate, fetched_at
      )
    `)
    .eq('user_id', user.id)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(30)

  // Aggregate stats
  const { data: totals } = await supabase
    .from('post_analytics')
    .select('impressions, reactions, comments, engagement_rate')
    .eq('user_id', user.id)

  const summary = totals ? {
    totalPosts: posts?.length ?? 0,
    totalImpressions: totals.reduce((s, r) => s + (r.impressions ?? 0), 0),
    totalReactions: totals.reduce((s, r) => s + (r.reactions ?? 0), 0),
    totalComments: totals.reduce((s, r) => s + (r.comments ?? 0), 0),
    avgEngagementRate: totals.length > 0
      ? totals.reduce((s, r) => s + (r.engagement_rate ?? 0), 0) / totals.length
      : 0,
  } : null

  return NextResponse.json({ posts: posts ?? [], summary })
}

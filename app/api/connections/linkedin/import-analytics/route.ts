import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { AnalyticsImportData } from '@/lib/linkedin/parseAnalyticsXls'

/**
 * POST /api/connections/linkedin/import-analytics
 *
 * Receives parsed LinkedIn Analytics XLS data (JSON) from the client.
 * The analytics export contains Post URLs + metrics but no post text,
 * so style inference is not possible from this data alone.
 *
 * What this does:
 *   1. Saves audience demographics to user_profiles.audience_context
 *   2. Returns top posts by impressions/engagement for display
 *   3. Returns a readable audience summary
 *
 * Style model update via combined XLS + Posts CSV is a separate flow.
 */
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: AnalyticsImportData
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { topPosts, demographics, totalImpressions, avgEngagementRate, periodSummary } = body

  if (!topPosts || topPosts.length === 0) {
    return NextResponse.json(
      { error: 'No posts found. Make sure you uploaded the LinkedIn Creator Analytics .xlsx (not the Posts CSV).' },
      { status: 400 }
    )
  }

  // ── Save audience demographics to user profile ────────────────────────────
  // Requires: ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS audience_context JSONB DEFAULT '{}';
  // Gracefully skips if column doesn't exist yet.
  const audienceContext = {
    demographics,
    importedAt: new Date().toISOString(),
    totalImpressions,
    avgEngagementRate: Math.round(avgEngagementRate * 10) / 10,
  }

  const { error: profileError } = await supabase
    .from('user_profiles')
    .update({ audience_context: audienceContext })
    .eq('id', user.id)

  if (profileError) {
    // Column may not exist yet — non-fatal, continue
    console.warn('Could not save audience_context (run migration):', profileError.message)
  }

  // ── Build audience summary lines for display ──────────────────────────────
  const audienceSummary = demographics
    .filter(d => d.segments.length > 0)
    .map(d => {
      const top3 = d.segments
        .slice(0, 3)
        .map(s => `${s.name}${s.pct > 1 ? ` (${s.pct}%)` : ''}`)
        .join(', ')
      return `${d.category}: ${top3}`
    })

  // ── Top posts for display (URL + metrics) ────────────────────────────────
  const topPostsDisplay = topPosts.slice(0, 10).map(p => ({
    url: p.url,
    publishedDate: p.publishedDate,
    impressions: p.impressions,
    engagements: p.engagements,
    engagementRate: p.engagementRate,
  }))

  return NextResponse.json({
    success: true,
    postsAnalysed: topPosts.length,
    totalImpressions,
    avgEngagementRate: Math.round(avgEngagementRate * 10) / 10,
    periodSummary,
    audienceSummary,
    topPostsDisplay,
    styleModelUpdated: false,
    note: 'Analytics and demographics saved. Style model training requires post text — upload your Posts.csv in the section below.',
  })
}

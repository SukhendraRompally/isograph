import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { scrapeLinkedInPosts } from '@/lib/linkedin/scrapePost'
import { inferStyleFromAnalytics, blendStyleModels, extractContentInsights } from '@/lib/styleInference'
import type { TopPost } from '@/lib/linkedin/parseAnalyticsXls'

// Allow up to 5 minutes on Vercel Pro — gracefully ignored on hobby plan
export const maxDuration = 300

/**
 * POST /api/connections/linkedin/fetch-post-content
 *
 * Takes ALL post URLs + engagement metrics from the analytics XLS,
 * fetches post text from each LinkedIn URL, then runs two things in parallel:
 *   1. Engagement-weighted style inference → updates style_models
 *   2. Topic/format/theme extraction → updates user_profiles
 *      - topTopics saved to interests (Scout uses them immediately)
 *      - all insights saved to audience_context
 *
 * Scraping: batches of 3 concurrent with 2s gap between batches.
 * 50 posts ≈ 20s. No artificial post cap — use everything LinkedIn gives.
 */
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const rawPosts = body.posts as {
    url: string
    impressions: number
    engagements: number
    engagementRate: number
    publishedDate: string
  }[]

  if (!rawPosts || rawPosts.length === 0) {
    return NextResponse.json({ error: 'No post URLs provided' }, { status: 400 })
  }

  const urls = rawPosts.map(p => p.url)

  // ── Scrape all post URLs ──────────────────────────────────────────────────
  const scraped = await scrapeLinkedInPosts(urls)

  const postsWithText: TopPost[] = scraped
    .map((s, i) => ({
      url: s.url,
      text: s.text,
      publishedDate: rawPosts[i].publishedDate,
      impressions: rawPosts[i].impressions,
      engagements: rawPosts[i].engagements,
      reactions: rawPosts[i].engagements,
      comments: 0,
      reposts: 0,
      clicks: 0,
      engagementRate: rawPosts[i].engagementRate,
    }))
    .filter(p => p.text.length > 30)

  const fetchedCount = postsWithText.length
  const failedCount = scraped.length - fetchedCount

  if (fetchedCount < 2) {
    return NextResponse.json({
      error: `Could only read ${fetchedCount} post(s). LinkedIn may be rate-limiting. Try again in a few minutes.`,
      fetchedCount,
      failedCount,
    }, { status: 422 })
  }

  // ── Style inference + topic extraction in parallel ───────────────────────
  const [inferredModel, contentInsights, currentStyleRow, profileRow] = await Promise.all([
    inferStyleFromAnalytics(postsWithText),
    extractContentInsights(postsWithText),
    supabase
      .from('style_models')
      .select('id, model, version')
      .eq('user_id', user.id)
      .eq('is_current', true)
      .single()
      .then(r => r.data),
    supabase
      .from('user_profiles')
      .select('onboarding_path, audience_context')
      .eq('id', user.id)
      .single()
      .then(r => r.data),
  ])

  // ── Blending rule ─────────────────────────────────────────────────────────
  // linkedin path → inferred model replaces (no prior manual preferences)
  // manual path   → inferred wins 60/40 over stated preference
  const onboardingPath = profileRow?.onboarding_path ?? null
  const existingModel = currentStyleRow?.model ?? null
  const finalModel = (existingModel && onboardingPath !== 'linkedin')
    ? blendStyleModels(existingModel, inferredModel, 0.4)
    : inferredModel

  const newVersion = (currentStyleRow?.version ?? 0) + 1

  // ── Save style model ──────────────────────────────────────────────────────
  await supabase
    .from('style_models')
    .update({ is_current: false })
    .eq('user_id', user.id)
    .eq('is_current', true)

  const { data: newStyleRow, error: insertError } = await supabase
    .from('style_models')
    .insert({
      user_id: user.id,
      version: newVersion,
      model: finalModel,
      source: 'inference',
      is_current: true,
    })
    .select()
    .single()

  if (insertError) {
    console.error('style_models insert error:', insertError)
    return NextResponse.json({ error: 'Failed to save style model' }, { status: 500 })
  }

  // ── Save topic insights to user profile ───────────────────────────────────
  // topTopics → interests (Scout uses this for Reddit/news queries immediately)
  // all insights → audience_context (Bridge uses for personalisation)
  const updatedAudienceContext = {
    ...(profileRow?.audience_context ?? {}),
    contentInsights,
    insightsUpdatedAt: new Date().toISOString(),
  }

  const profileUpdates: Record<string, unknown> = {
    audience_context: updatedAudienceContext,
    updated_at: new Date().toISOString(),
  }

  // Only overwrite interests if we found something meaningful
  if (contentInsights.topTopics.length > 0) {
    profileUpdates.interests = contentInsights.topTopics
  }

  await supabase
    .from('user_profiles')
    .update(profileUpdates)
    .eq('id', user.id)

  // ── Response ──────────────────────────────────────────────────────────────
  const postPreviews = postsWithText
    .sort((a, b) => b.engagementRate - a.engagementRate)
    .slice(0, 5)
    .map(p => ({
      url: p.url,
      textPreview: p.text.slice(0, 140) + (p.text.length > 140 ? '…' : ''),
      engagementRate: p.engagementRate,
      impressions: p.impressions,
    }))

  return NextResponse.json({
    success: true,
    fetchedCount,
    failedCount,
    styleModelUpdated: true,
    newVersion,
    styleModelId: newStyleRow.id,
    contentInsights,
    postPreviews,
  })
}

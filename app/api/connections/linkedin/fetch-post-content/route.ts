import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { scrapeLinkedInPosts } from '@/lib/linkedin/scrapePost'
import { inferStyleFromAnalytics, blendStyleModels } from '@/lib/styleInference'
import type { TopPost } from '@/lib/linkedin/parseAnalyticsXls'

/**
 * POST /api/connections/linkedin/fetch-post-content
 *
 * Takes top post URLs + their engagement metrics (from analytics XLS),
 * fetches the post text from each LinkedIn URL, then runs
 * engagement-weighted style inference.
 *
 * Body: {
 *   posts: { url, impressions, engagements, engagementRate, publishedDate }[]
 *   maxPosts?: number  // default 20 — limits scraping time
 * }
 *
 * This is intentionally server-side: the scraping must happen from the
 * server (not the browser) to avoid CORS blocks from LinkedIn.
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
  const maxPosts: number = body.maxPosts ?? 20

  if (!rawPosts || rawPosts.length === 0) {
    return NextResponse.json({ error: 'No post URLs provided' }, { status: 400 })
  }

  // Take top N by impressions (already sorted from XLS import)
  const postsToFetch = rawPosts.slice(0, maxPosts)
  const urls = postsToFetch.map(p => p.url)

  // ── Scrape post content from LinkedIn URLs ───────────────────────────────
  const scraped = await scrapeLinkedInPosts(urls)

  // Merge scraped text back with engagement data
  const postsWithText: TopPost[] = scraped
    .map((s, i) => ({
      url: s.url,
      text: s.text,
      publishedDate: postsToFetch[i].publishedDate,
      impressions: postsToFetch[i].impressions,
      engagements: postsToFetch[i].engagements,
      reactions: postsToFetch[i].engagements,
      comments: 0,
      reposts: 0,
      clicks: 0,
      engagementRate: postsToFetch[i].engagementRate,
    }))
    .filter(p => p.text.length > 30)  // drop posts we couldn't read

  const fetchedCount = postsWithText.length
  const failedCount = scraped.length - fetchedCount

  if (fetchedCount < 2) {
    return NextResponse.json({
      error: `Could only read ${fetchedCount} post(s). LinkedIn may be rate-limiting. Try again in a few minutes, or upload your Posts.csv instead.`,
      fetchedCount,
      failedCount,
    }, { status: 422 })
  }

  // ── Run engagement-weighted style inference ──────────────────────────────
  const inferredModel = await inferStyleFromAnalytics(postsWithText)

  // ── Load current style model + onboarding path ──────────────────────────
  const [{ data: currentStyleRow }, { data: profileRow }] = await Promise.all([
    supabase
      .from('style_models')
      .select('id, model, version')
      .eq('user_id', user.id)
      .eq('is_current', true)
      .single(),
    supabase
      .from('user_profiles')
      .select('onboarding_path')
      .eq('id', user.id)
      .single(),
  ])

  const onboardingPath = profileRow?.onboarding_path ?? null
  const existingModel = currentStyleRow?.model ?? null

  // Blending rule:
  //   linkedin path → inferred data IS the model (no blend with old data)
  //   manual path   → inferred data overrides stated preference 60/40
  //   no path set   → same as manual (safe default)
  const finalModel = (existingModel && onboardingPath !== 'linkedin')
    ? blendStyleModels(existingModel, inferredModel, 0.4)
    : inferredModel

  const newVersion = (currentStyleRow?.version ?? 0) + 1

  // ── Save new style model ─────────────────────────────────────────────────
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

  // Sample of fetched post previews for display
  const postPreviews = postsWithText.slice(0, 5).map(p => ({
    url: p.url,
    textPreview: p.text.slice(0, 120) + (p.text.length > 120 ? '…' : ''),
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
    postPreviews,
  })
}

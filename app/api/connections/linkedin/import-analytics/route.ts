import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { inferStyleFromAnalytics, blendStyleModels } from '@/lib/styleInference'
import type { AnalyticsImportData } from '@/lib/linkedin/parseAnalyticsXls'

/**
 * POST /api/connections/linkedin/import-analytics
 *
 * Receives parsed LinkedIn Analytics XLS data (JSON) from the client.
 * Client parses the XLS in the browser using the xlsx library to avoid
 * uploading a binary file. This route:
 *   1. Validates there are enough posts to infer from
 *   2. Runs engagement-weighted style inference on Top Posts
 *   3. Blends with current style model (60% analytics / 40% existing)
 *   4. Saves a new style_models row with source='inference'
 *   5. Returns the new model + demographics summary for display
 *
 * Available to all plans (analytics import is a core value feature).
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

  if (!topPosts || topPosts.length < 2) {
    return NextResponse.json(
      { error: 'Need at least 2 posts in the Top Posts tab to infer style.' },
      { status: 400 }
    )
  }

  // ── 1. Run engagement-weighted style inference ───────────────────────────
  const inferredModel = await inferStyleFromAnalytics(topPosts)

  // ── 2. Load current style model ──────────────────────────────────────────
  const { data: currentStyleRow } = await supabase
    .from('style_models')
    .select('id, model, version')
    .eq('user_id', user.id)
    .eq('is_current', true)
    .single()

  // ── 3. Blend: 60% analytics (real performance), 40% existing ─────────────
  // Analytics data reflects what actually worked with the audience,
  // so it gets more weight than the passive CSV inference (30%).
  const existingModel = currentStyleRow?.model ?? null
  const finalModel = existingModel
    ? blendStyleModels(existingModel, inferredModel, 0.4)
    : inferredModel

  const newVersion = (currentStyleRow?.version ?? 0) + 1

  // ── 4. Deactivate old current model ─────────────────────────────────────
  await supabase
    .from('style_models')
    .update({ is_current: false })
    .eq('user_id', user.id)
    .eq('is_current', true)

  // ── 5. Insert new model ──────────────────────────────────────────────────
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
    return NextResponse.json({ error: 'Failed to save updated style model' }, { status: 500 })
  }

  // ── 6. Build a readable audience summary from demographics ───────────────
  const audienceSummary = demographics
    .filter(d => d.segments.length > 0)
    .map(d => {
      const top3 = d.segments.slice(0, 3).map(s => s.name).join(', ')
      return `${d.category}: ${top3}`
    })

  return NextResponse.json({
    success: true,
    postsAnalysed: topPosts.length,
    totalImpressions,
    avgEngagementRate: Math.round(avgEngagementRate * 10) / 10,
    periodSummary,
    audienceSummary,
    styleModelUpdated: true,
    newVersion,
    inferredModel,
    finalModel,
    styleModelId: newStyleRow.id,
  })
}

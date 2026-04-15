import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { runUserReflection } from '@/lib/agents/reflection'
import { checkReflectionQuota } from '@/lib/usageLimits'
import { UserProfile, IsographPost, PostAnalytics, StyleModel } from '@/types'

export async function POST() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const quota = await checkReflectionQuota(user.id)
  if (!quota.allowed) {
    return NextResponse.json({ error: quota.message }, { status: 429 })
  }

  const { data: profileRow } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profileRow) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const { data: styleRow } = await supabase
    .from('style_models')
    .select('id, version, model')
    .eq('user_id', user.id)
    .eq('is_current', true)
    .single()

  if (!styleRow) return NextResponse.json({ error: 'No style model found' }, { status: 400 })

  // Get published posts since last reflection
  const { data: lastReflection } = await supabase
    .from('reflection_history')
    .select('created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)

  const sinceDate = lastReflection?.[0]?.created_at ?? new Date(0).toISOString()

  const { data: posts } = await supabase
    .from('posts')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'published')
    .gte('published_at', sinceDate)

  const { data: analytics } = await supabase
    .from('post_analytics')
    .select('*')
    .eq('user_id', user.id)

  const profile: UserProfile = {
    id: user.id,
    displayName: profileRow.display_name,
    headline: profileRow.headline,
    industry: profileRow.industry,
    interests: profileRow.interests ?? [],
    personalConstraints: profileRow.personal_constraints ?? [],
    location: profileRow.location,
    avatarUrl: profileRow.avatar_url,
    onboardingCompleted: profileRow.onboarding_completed,
  }

  try {
    const result = await runUserReflection(
      profile,
      (posts ?? []) as unknown as IsographPost[],
      (analytics ?? []) as unknown as PostAnalytics[],
      styleRow.model as StyleModel
    )

    if (result.deltas.length === 0) {
      return NextResponse.json({ result, message: 'No style updates — keep publishing for more data.' })
    }

    // Save new style model version
    await supabase
      .from('style_models')
      .update({ is_current: false })
      .eq('user_id', user.id)
      .eq('is_current', true)

    await supabase.from('style_models').insert({
      user_id: user.id,
      version: (styleRow.version ?? 1) + 1,
      model: result.updatedStyleModel,
      source: 'reflection',
      is_current: true,
      post_count_at_reflection: posts?.length ?? 0,
    })

    // Save reflection history
    await supabase.from('reflection_history').insert({
      user_id: user.id,
      style_model_before: styleRow.model,
      style_model_after: result.updatedStyleModel,
      insights: result.insights,
      deltas: result.deltas,
      summary: result.summary,
      posts_analysed: posts?.length ?? 0,
      triggered_by: 'manual',
    })

    return NextResponse.json({ result })
  } catch (err) {
    console.error('Reflection error:', err)
    return NextResponse.json({ error: 'Reflection failed' }, { status: 500 })
  }
}

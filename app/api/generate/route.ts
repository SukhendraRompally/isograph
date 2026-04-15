import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { runBridge } from '@/lib/agents/bridge'
import { runGuardian } from '@/lib/agents/guardian'
import { checkPostQuota, incrementPostUsage } from '@/lib/usageLimits'
import { UserProfile, ContentOpportunity, StyleModel } from '@/types'

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const quota = await checkPostQuota(user.id)
  if (!quota.allowed) {
    return NextResponse.json({ error: quota.message }, { status: 429 })
  }

  const body = await request.json()
  const opportunity = body.opportunity as ContentOpportunity
  if (!opportunity) return NextResponse.json({ error: 'opportunity is required' }, { status: 400 })

  const { data: profileRow } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profileRow) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const { data: styleRow } = await supabase
    .from('style_models')
    .select('model')
    .eq('user_id', user.id)
    .eq('is_current', true)
    .single()

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

  const styleModel: StyleModel = styleRow?.model ?? {
    tone: 0.5, brevity: 0.5, hookIntensity: 0.5, expertiseDepth: 0.5,
    evidenceStyle: 0.5, ctaFriction: 0.5, perspective: 0.5, vocabularyRigor: 0.5,
  }

  try {
    const content = await runBridge(profile, opportunity, styleModel)
    const guardian = await runGuardian(content, profile)

    if (guardian.status === 'block') {
      return NextResponse.json({ error: 'Post blocked by Guardian', guardian }, { status: 422 })
    }

    // Save draft post to DB
    const { data: post, error: postError } = await supabase
      .from('posts')
      .insert({
        user_id: user.id,
        platform: 'linkedin',
        source: 'generated',
        status: 'draft',
        generated_content: content,
        opportunity_id: null,  // text ID, not UUID — full data in opportunity_snapshot
        opportunity_snapshot: opportunity,
        style_model_used: styleModel,
        guardian_result: guardian,
        was_edited: false,
      })
      .select()
      .single()

    if (postError) throw postError

    // Increment quota after successful generation
    await incrementPostUsage(user.id)

    return NextResponse.json({ post, content, guardian })
  } catch (err) {
    console.error('Generate error:', err)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}

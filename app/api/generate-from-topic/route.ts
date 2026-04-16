import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getAzureClient, DEPLOYMENT } from '@/lib/azureClient'
import { runBridge } from '@/lib/agents/bridge'
import { runGuardian } from '@/lib/agents/guardian'
import type { UserProfile, PersonalOpportunity } from '@/types'

/**
 * POST /api/generate-from-topic
 *
 * User provides a free-form topic description.
 * 1. GPT expands it into a structured ContentOpportunity (topic, hook, why)
 * 2. Bridge agent generates post in user's voice
 * 3. Guardian checks safety + constraints
 * 4. Draft post saved to DB
 *
 * Same response shape as /api/generate.
 */
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const topicInput: string = body.topic?.trim()

  if (!topicInput || topicInput.length < 3) {
    return NextResponse.json({ error: 'Topic is required' }, { status: 400 })
  }

  // ── Fetch user profile + style model ─────────────────────────────────────
  const [profileResult, styleResult] = await Promise.all([
    supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single(),
    supabase
      .from('style_models')
      .select('model')
      .eq('user_id', user.id)
      .eq('is_current', true)
      .single(),
  ])

  if (profileResult.error || !profileResult.data) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  const profileRow = profileResult.data
  const styleModel = styleResult.data?.model ?? null

  const userProfile: UserProfile = {
    id: profileRow.id,
    displayName: profileRow.display_name ?? '',
    headline: profileRow.headline ?? '',
    industry: profileRow.industry ?? '',
    interests: profileRow.interests ?? [],
    personalConstraints: profileRow.personal_constraints ?? [],
    location: profileRow.location ?? '',
    onboardingCompleted: profileRow.onboarding_completed ?? false,
  }

  // ── Expand topic into a structured ContentOpportunity ────────────────────
  const opportunity = await expandTopicToOpportunity(topicInput, userProfile)

  // ── Bridge: generate post ─────────────────────────────────────────────────
  const generatedContent = await runBridge(userProfile, opportunity, styleModel)

  // ── Guardian: safety check ────────────────────────────────────────────────
  const guardianResult = await runGuardian(generatedContent, userProfile)

  if (guardianResult.status === 'block') {

    return NextResponse.json({
      blocked: true,
      guardian: { status: guardianResult.status, summary: guardianResult.summary },
    }, { status: 422 })
  }

  // ── Save draft post ───────────────────────────────────────────────────────
  const { data: post, error: postError } = await supabase
    .from('posts')
    .insert({
      user_id: user.id,
      platform: 'linkedin',
      source: 'generated',
      status: 'draft',
      generated_content: generatedContent,
      published_content: generatedContent,
      opportunity_snapshot: opportunity,
      style_model_used: styleModel,
      guardian_result: {
        status: guardianResult.status,
        summary: guardianResult.summary,
        checks: guardianResult.checks ?? [],
      },
      was_edited: false,
    })
    .select()
    .single()

  if (postError || !post) {
    console.error('Post insert error:', postError)
    return NextResponse.json({ error: 'Failed to save draft' }, { status: 500 })
  }

  return NextResponse.json({
    post: { id: post.id },
    content: generatedContent,
    opportunity,
    guardian: { status: guardianResult.status, summary: guardianResult.summary },
  })
}

/**
 * Use GPT to turn a free-form topic description into a structured ContentOpportunity.
 * This fills in the hook (opening line angle), why-now context, and reasonable
 * signal/fit scores so the Bridge agent has proper structure to work from.
 */
async function expandTopicToOpportunity(
  topicInput: string,
  userProfile: UserProfile
): Promise<PersonalOpportunity> {
  const azureClient = getAzureClient()

  const prompt = `You are a content strategist helping a LinkedIn professional plan a post.

## User background
Name: ${userProfile.displayName}
Headline: ${userProfile.headline}
Industry: ${userProfile.industry}
Interests: ${userProfile.interests.slice(0, 5).join(', ')}

## Topic they want to write about
"${topicInput}"

## Task
Turn this into a structured LinkedIn content opportunity. Be specific and actionable.

Return JSON only:
{
  "topic": "<concise topic title — the specific angle, max 10 words>",
  "hook": "<a compelling first line or opening angle for the post, max 20 words>",
  "why": "<why this topic is relevant or timely for their audience, 1-2 sentences>",
  "signalStrength": <40-75 — user-initiated topics have moderate signal>,
  "trendingTerms": ["<2-4 relevant keywords>"]
}`

  try {
    const response = await azureClient.chat.completions.create({
      model: DEPLOYMENT,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
      temperature: 0.4,
    })

    const text = response.choices[0]?.message?.content ?? ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in response')

    const raw = JSON.parse(jsonMatch[0])

    return {
      id: `topic-${Date.now()}`,
      userId: userProfile.id,
      topic: raw.topic ?? topicInput,
      hook: raw.hook ?? '',
      why: raw.why ?? '',
      signalStrength: Math.min(100, Math.max(0, raw.signalStrength ?? 60)),
      personalFit: 85, // user chose this topic themselves — high personal fit by definition
      sourceSignals: ['user-defined'],
      trendingTerms: Array.isArray(raw.trendingTerms) ? raw.trendingTerms.slice(0, 4) : [],
      status: 'new' as const,
      scoutedAt: new Date().toISOString(),
    }
  } catch {
    return {
      id: `topic-${Date.now()}`,
      userId: userProfile.id,
      topic: topicInput,
      hook: '',
      why: 'User-defined topic.',
      signalStrength: 60,
      personalFit: 85,
      sourceSignals: ['user-defined'],
      trendingTerms: [],
      status: 'new' as const,
      scoutedAt: new Date().toISOString(),
    }
  }
}

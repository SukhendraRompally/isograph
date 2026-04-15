import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { runScoutForUser } from '@/lib/agents/scout'
import { UserProfile } from '@/types'

export async function POST() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Scout doesn't consume post quota — it's a discovery operation
  // But check subscription is active
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', user.id)
    .single()

  if (sub?.status !== 'active' && sub?.status !== 'trialing') {
    return NextResponse.json({ error: 'Subscription is not active.' }, { status: 403 })
  }

  const { data: profileRow } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profileRow) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

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
    const opportunities = await runScoutForUser(profile)

    // Save opportunities to DB
    const toInsert = opportunities.map(opp => ({
      id: opp.id,
      user_id: user.id,
      topic: opp.topic,
      hook: opp.hook,
      why: opp.why,
      signal_strength: opp.signalStrength,
      personal_fit: opp.personalFit,
      source_signals: opp.sourceSignals,
      trending_terms: opp.trendingTerms,
      status: 'new',
      scouted_at: opp.scoutedAt,
    }))

    await supabase.from('opportunities').insert(toInsert)

    return NextResponse.json({ opportunities })
  } catch (err) {
    console.error('Scout error:', err)
    return NextResponse.json({ error: 'Scout failed' }, { status: 500 })
  }
}

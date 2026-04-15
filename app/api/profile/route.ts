import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

async function ensureProfileExists(
  supabase: ReturnType<typeof createClient>,
  user: { id: string; email?: string; user_metadata?: Record<string, string> }
) {
  const { data: existing } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('id', user.id)
    .single()

  if (!existing) {
    const displayName =
      user.user_metadata?.display_name ??
      user.user_metadata?.full_name ??
      user.email?.split('@')[0] ??
      'User'

    await supabase.from('user_profiles').insert({
      id: user.id,
      display_name: displayName,
      onboarding_completed: false,
    })

    // Check if subscription row already exists before inserting
    const { data: existingSub } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!existingSub) {
      await supabase.from('subscriptions').insert({
        user_id: user.id,
        plan: 'free',
        status: 'active',
        ai_posts_used_this_period: 0,
      })
    }
  }
}

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await ensureProfileExists(supabase, user)

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('plan, status, ai_posts_used_this_period, current_period_end')
    .eq('user_id', user.id)
    .single()

  return NextResponse.json({ profile, subscription: sub })
}

export async function PUT(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await ensureProfileExists(supabase, user)

  const body = await request.json()
  const allowed = [
    'display_name', 'headline', 'industry', 'interests',
    'personal_constraints', 'location', 'avatar_url',
    'onboarding_path', 'audience_context',
  ]
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .update(updates)
    .eq('id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ profile: data })
}

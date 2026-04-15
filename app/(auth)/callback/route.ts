import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/onboarding/connect'

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`)
  }

  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Handled by middleware session refresh
          }
        },
      },
    }
  )

  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  }

  const userId = data.user.id

  // Ensure user_profiles row exists
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id, onboarding_completed')
    .eq('id', userId)
    .single()

  if (!profile) {
    // Create profile row from auth metadata
    const displayName =
      data.user.user_metadata?.display_name ??
      data.user.email?.split('@')[0] ??
      'User'

    await supabase.from('user_profiles').insert({
      id: userId,
      display_name: displayName,
      onboarding_completed: false,
    })

    // Create free subscription row
    await supabase.from('subscriptions').insert({
      user_id: userId,
      plan: 'free',
      status: 'active',
      ai_posts_used_this_period: 0,
    })

    return NextResponse.redirect(`${origin}/onboarding/connect`)
  }

  // Existing user — send to onboarding if not complete, otherwise dashboard
  const destination = profile.onboarding_completed ? '/dashboard' : next
  return NextResponse.redirect(`${origin}${destination}`)
}

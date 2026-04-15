import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'
import { exchangeCodeForToken } from '@/lib/linkedin/oauth'
import { getLinkedInProfile } from '@/lib/linkedin/client'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(`${origin}/settings/connections?error=${error}`)
  }

  if (!code || !state) {
    return NextResponse.redirect(`${origin}/settings/connections?error=missing_params`)
  }

  // Validate CSRF state
  const cookieStore = cookies()
  const storedState = cookieStore.get('linkedin_oauth_state')?.value
  if (!storedState || storedState !== state) {
    return NextResponse.redirect(`${origin}/settings/connections?error=state_mismatch`)
  }
  cookieStore.delete('linkedin_oauth_state')

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${origin}/login`)

  try {
    // Exchange code for tokens
    const tokens = await exchangeCodeForToken(code)

    // Fetch LinkedIn profile
    const liProfile = await getLinkedInProfile(tokens.access_token)

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

    // Upsert connection
    await supabase.from('social_connections').upsert({
      user_id: user.id,
      platform: 'linkedin',
      platform_user_id: liProfile.sub,
      platform_username: liProfile.name,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? null,
      token_expires_at: expiresAt,
      scopes: tokens.scope.split(' '),
      connected_at: new Date().toISOString(),
      is_active: true,
    }, { onConflict: 'user_id,platform' })

    // Update user profile with LinkedIn data if not already set
    await supabase
      .from('user_profiles')
      .update({
        display_name: liProfile.name,
        avatar_url: liProfile.picture ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .is('display_name', null)

    // Determine where to redirect: onboarding or settings
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('onboarding_completed')
      .eq('id', user.id)
      .single()

    const destination = profile?.onboarding_completed
      ? '/settings/connections?connected=linkedin'
      : '/onboarding/interests'

    return NextResponse.redirect(`${origin}${destination}`)
  } catch (err) {
    console.error('LinkedIn callback error:', err)
    return NextResponse.redirect(`${origin}/settings/connections?error=connection_failed`)
  }
}

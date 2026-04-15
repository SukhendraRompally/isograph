import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getLinkedInAuthUrl, generateOAuthState } from '@/lib/linkedin/oauth'
import { cookies } from 'next/headers'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const state = generateOAuthState()

  // Store state in a short-lived cookie for CSRF validation
  const cookieStore = cookies()
  cookieStore.set('linkedin_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 600, // 10 minutes
    path: '/',
  })

  const authUrl = getLinkedInAuthUrl(state)
  return NextResponse.redirect(authUrl)
}

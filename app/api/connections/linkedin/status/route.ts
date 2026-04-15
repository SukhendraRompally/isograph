import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ isConnected: false })

  const { data: connection } = await supabase
    .from('social_connections')
    .select('platform_username, is_active')
    .eq('user_id', user.id)
    .eq('platform', 'linkedin')
    .single()

  return NextResponse.json({
    isConnected: connection?.is_active ?? false,
    username: connection?.platform_username ?? null,
  })
}

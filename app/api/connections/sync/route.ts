import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const csvText = body.csv as string | undefined

  if (!csvText) {
    return NextResponse.json({ error: 'csv field is required' }, { status: 400 })
  }

  // Check Pro plan (CSV inference is Pro-only)
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('plan')
    .eq('user_id', user.id)
    .single()

  if (sub?.plan !== 'pro') {
    return NextResponse.json(
      { error: 'CSV style inference is a Pro feature. Upgrade to unlock.' },
      { status: 403 }
    )
  }

  // Run import in background (import is heavy — use dynamic import to avoid edge timeouts)
  const { importLinkedInPostsCsv } = await import('@/lib/linkedin/importPosts')
  const result = await importLinkedInPostsCsv(user.id, csvText)

  return NextResponse.json(result)
}

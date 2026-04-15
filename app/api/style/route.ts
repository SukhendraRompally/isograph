import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { StyleModel } from '@/types'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: current } = await supabase
    .from('style_models')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_current', true)
    .single()

  const { data: history } = await supabase
    .from('style_models')
    .select('id, version, source, created_at, model')
    .eq('user_id', user.id)
    .order('version', { ascending: true })

  return NextResponse.json({ current, history: history ?? [] })
}

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const model = body.model as StyleModel
  const source = body.source ?? 'onboarding'

  if (!model) return NextResponse.json({ error: 'model is required' }, { status: 400 })

  // Mark any existing current as not current
  await supabase
    .from('style_models')
    .update({ is_current: false })
    .eq('user_id', user.id)
    .eq('is_current', true)

  // Get highest existing version
  const { data: existing } = await supabase
    .from('style_models')
    .select('version')
    .eq('user_id', user.id)
    .order('version', { ascending: false })
    .limit(1)

  const version = (existing?.[0]?.version ?? 0) + 1

  const { data, error } = await supabase
    .from('style_models')
    .insert({
      user_id: user.id,
      version,
      model,
      source,
      is_current: true,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Mark onboarding as complete when first style model is created
  if (source === 'onboarding') {
    await supabase
      .from('user_profiles')
      .update({ onboarding_completed: true, updated_at: new Date().toISOString() })
      .eq('id', user.id)
  }

  return NextResponse.json({ styleModel: data })
}

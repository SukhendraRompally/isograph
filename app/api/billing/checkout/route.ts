import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe/client'
import { STRIPE_PRICE_IDS } from '@/lib/stripe/plans'

export async function POST() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .single()

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const session = await getStripe().checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    customer: sub?.stripe_customer_id ?? undefined,
    customer_email: sub?.stripe_customer_id ? undefined : user.email,
    line_items: [
      {
        price: STRIPE_PRICE_IDS.pro_monthly,
        quantity: 1,
      },
    ],
    success_url: `${appUrl}/settings/billing?upgraded=true`,
    cancel_url: `${appUrl}/settings/billing`,
    metadata: { user_id: user.id },
  })

  return NextResponse.json({ url: session.url })
}

'use client'

import { useState, useEffect } from 'react'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { PLAN_DISPLAY } from '@/lib/stripe/plans'

export default function BillingPage() {
  const [plan, setPlan] = useState<'free' | 'pro'>('free')
  const [, setStatus] = useState<string>('active')
  const [periodEnd, setPeriodEnd] = useState<string | null>(null)
  const [postsUsed, setPostsUsed] = useState(0)
  const [loading, setLoading] = useState(true)
  const [checkoutLoading, setCheckoutLoading] = useState(false)

  useEffect(() => {
    fetch('/api/profile').then(r => r.json()).then(data => {
      const sub = data.subscription
      if (sub) {
        setPlan(sub.plan)
        setStatus(sub.status)
        setPeriodEnd(sub.current_period_end)
        setPostsUsed(sub.ai_posts_used_this_period ?? 0)
      }
      setLoading(false)
    })
  }, [])

  async function handleUpgrade() {
    setCheckoutLoading(true)
    const res = await fetch('/api/billing/checkout', { method: 'POST' })
    const data = await res.json()
    if (data.url) {
      window.location.href = data.url
    } else {
      setCheckoutLoading(false)
    }
  }

  if (loading) {
    return <div className="p-6 flex justify-center"><Loader2 className="w-5 h-5 text-indigo-400 animate-spin" /></div>
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-100">Billing</h1>
        <p className="text-sm text-slate-400 mt-1">Manage your Isograph subscription.</p>
      </div>

      {/* Current plan */}
      <Card padding="md">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-200">Current plan</h2>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            plan === 'pro'
              ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40'
              : 'bg-slate-800 text-slate-400 border border-slate-700'
          }`}>
            {plan === 'pro' ? 'Pro' : 'Free'}
          </span>
        </div>

        <div className="space-y-2 text-sm text-slate-400">
          <p>
            AI posts this month: <span className="text-slate-200 font-medium">{postsUsed}</span>
            {' / '}
            <span className="text-slate-200 font-medium">{plan === 'pro' ? 60 : 5}</span>
          </p>
          {periodEnd && (
            <p>
              {plan === 'pro' ? 'Next billing date' : 'Quota resets'}:{' '}
              <span className="text-slate-200">{new Date(periodEnd).toLocaleDateString()}</span>
            </p>
          )}
        </div>
      </Card>

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(['free', 'pro'] as const).map(p => {
          const info = PLAN_DISPLAY[p]
          const isCurrent = plan === p
          return (
            <Card
              key={p}
              padding="md"
              className={isCurrent ? 'border-indigo-500/40' : ''}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-bold text-slate-200">{info.name}</p>
                  <p className="text-xs text-slate-400">{info.price}</p>
                </div>
                {isCurrent && (
                  <span className="text-xs text-indigo-400 font-medium">Current</span>
                )}
              </div>
              <ul className="space-y-1.5 mb-4">
                {info.features.map(f => (
                  <li key={f} className="flex items-center gap-2 text-xs text-slate-400">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              {p === 'pro' && !isCurrent && (
                <Button onClick={handleUpgrade} disabled={checkoutLoading} className="w-full" size="sm">
                  {checkoutLoading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Redirecting…</> : 'Upgrade to Pro'}
                </Button>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}

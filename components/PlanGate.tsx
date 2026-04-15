'use client'

import { ReactNode } from 'react'
import { Lock } from 'lucide-react'
import Link from 'next/link'

interface Props {
  plan: 'free' | 'pro'
  requiredPlan: 'free' | 'pro'
  feature: string
  children: ReactNode
}

export default function PlanGate({ plan, requiredPlan, feature, children }: Props) {
  if (plan === requiredPlan || requiredPlan === 'free' || plan === 'pro') {
    return <>{children}</>
  }

  return (
    <div className="relative">
      <div className="pointer-events-none opacity-40 select-none">{children}</div>
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/60 backdrop-blur-[1px] rounded-2xl">
        <Lock className="w-5 h-5 text-slate-400 mb-2" />
        <p className="text-sm font-medium text-slate-200">{feature}</p>
        <p className="text-xs text-slate-400 mt-0.5 mb-3">Upgrade to Pro to unlock</p>
        <Link
          href="/settings/billing"
          className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-colors"
        >
          Upgrade to Pro
        </Link>
      </div>
    </div>
  )
}

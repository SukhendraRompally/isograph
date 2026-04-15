'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import OnboardingQuestionnaire from '@/components/OnboardingQuestionnaire'
import { StyleModel } from '@/types'

export default function OnboardingStylePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleComplete(model: StyleModel) {
    setLoading(true)
    setError(null)

    const res = await fetch('/api/style', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, source: 'onboarding' }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Something went wrong')
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-4xl">
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3].map(step => (
            <div
              key={step}
              className={`w-2 h-2 rounded-full ${step === 3 ? 'bg-indigo-500' : 'bg-slate-700'}`}
            />
          ))}
        </div>

        <h1 className="text-2xl font-bold text-slate-100 text-center mb-2">
          Define your writing style
        </h1>
        <p className="text-sm text-slate-400 text-center mb-8">
          Move each slider to match how you naturally write. Isograph will use this as your starting point — and refine it over time.
        </p>

        {error && (
          <div className="mb-6 p-3 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg text-center">
            {error}
          </div>
        )}

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8">
          <OnboardingQuestionnaire onComplete={handleComplete} loading={loading} />
        </div>
      </div>
    </div>
  )
}

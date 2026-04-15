'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const INDUSTRIES = [
  'Technology', 'Software Engineering', 'Marketing', 'Finance', 'Healthcare',
  'Design', 'Product Management', 'Data Science', 'HR', 'Sales',
  'Consulting', 'Legal', 'Education', 'Entrepreneurship',
]

const INTEREST_OPTIONS = [
  'AI & Machine Learning', 'Leadership', 'Startups', 'Remote Work',
  'Productivity', 'Diversity & Inclusion', 'Climate & Sustainability',
  'DevOps', 'Open Source', 'Mental Health', 'Personal Finance',
  'Writing & Content', 'Public Speaking', 'Networking', 'Career Growth',
]

export default function OnboardingInterestsPage() {
  const router = useRouter()
  const [industry, setIndustry] = useState('')
  const [headline, setHeadline] = useState('')
  const [selectedInterests, setSelectedInterests] = useState<string[]>([])
  const [personalConstraints, setPersonalConstraints] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggleInterest(interest: string) {
    setSelectedInterests(prev =>
      prev.includes(interest)
        ? prev.filter(i => i !== interest)
        : [...prev, interest].slice(0, 5)
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const constraints = personalConstraints
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean)

    const res = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        industry,
        headline,
        interests: selectedInterests,
        personal_constraints: constraints,
        onboarding_path: 'manual',
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Something went wrong')
      setLoading(false)
      return
    }

    router.push('/onboarding/style')
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Step 2 of 3 — manual path */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3].map(s => (
            <div key={s} className={`w-2 h-2 rounded-full ${s <= 2 ? 'bg-indigo-500' : 'bg-slate-700'}`} />
          ))}
        </div>

        <h1 className="text-2xl font-bold text-slate-100 text-center mb-2">Tell us about yourself</h1>
        <p className="text-sm text-slate-400 text-center mb-8">
          This shapes the topics and tone Isograph scouts for you.
        </p>

        <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
          {/* Headline */}
          <div>
            <label className="text-xs text-slate-400 block mb-1.5">Your LinkedIn headline</label>
            <input
              type="text"
              value={headline}
              onChange={e => setHeadline(e.target.value)}
              placeholder="e.g. Product Manager at Acme · Building things people love"
              className="w-full bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-indigo-500 placeholder:text-slate-600"
            />
          </div>

          {/* Industry */}
          <div>
            <label className="text-xs text-slate-400 block mb-2">Industry</label>
            <div className="flex flex-wrap gap-2">
              {INDUSTRIES.map(ind => (
                <button
                  key={ind}
                  type="button"
                  onClick={() => setIndustry(ind)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    industry === ind
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
                  }`}
                >
                  {ind}
                </button>
              ))}
            </div>
          </div>

          {/* Interests */}
          <div>
            <label className="text-xs text-slate-400 block mb-1">
              Topics you care about <span className="text-slate-600">(pick up to 5)</span>
            </label>
            <div className="flex flex-wrap gap-2 mt-2">
              {INTEREST_OPTIONS.map(interest => (
                <button
                  key={interest}
                  type="button"
                  onClick={() => toggleInterest(interest)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    selectedInterests.includes(interest)
                      ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
                  }`}
                >
                  {interest}
                </button>
              ))}
            </div>
          </div>

          {/* Personal constraints */}
          <div>
            <label className="text-xs text-slate-400 block mb-1.5">
              Topics or tones to avoid <span className="text-slate-600">(optional, one per line)</span>
            </label>
            <textarea
              value={personalConstraints}
              onChange={e => setPersonalConstraints(e.target.value)}
              rows={3}
              placeholder="e.g. Politics&#10;Cryptocurrency&#10;Aggressive sales tone"
              className="w-full bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-indigo-500 placeholder:text-slate-600 resize-none"
            />
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !industry}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {loading ? 'Saving…' : 'Continue →'}
          </button>
        </form>
      </div>
    </div>
  )
}

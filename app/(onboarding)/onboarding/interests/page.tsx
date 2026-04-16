'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'

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

const MAX_INTERESTS = 5

export default function OnboardingInterestsPage() {
  const router = useRouter()
  const [industry, setIndustry] = useState('')
  const [headline, setHeadline] = useState('')
  const [selectedInterests, setSelectedInterests] = useState<string[]>([])
  const [customInput, setCustomInput] = useState('')
  const [personalConstraints, setPersonalConstraints] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function toggleInterest(interest: string) {
    setSelectedInterests(prev =>
      prev.includes(interest)
        ? prev.filter(i => i !== interest)
        : prev.length < MAX_INTERESTS ? [...prev, interest] : prev
    )
  }

  function addCustomInterest() {
    const trimmed = customInput.trim()
    if (!trimmed || selectedInterests.length >= MAX_INTERESTS) return
    if (selectedInterests.map(i => i.toLowerCase()).includes(trimmed.toLowerCase())) {
      setCustomInput('')
      return
    }
    setSelectedInterests(prev => [...prev, trimmed])
    setCustomInput('')
    inputRef.current?.focus()
  }

  function removeInterest(interest: string) {
    setSelectedInterests(prev => prev.filter(i => i !== interest))
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

  const atLimit = selectedInterests.length >= MAX_INTERESTS

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Step 2 of 3 */}
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
            <label className="text-xs text-slate-400 block mb-1.5">
              Your LinkedIn headline
              <span className="text-slate-600 ml-1">— used to personalise generated posts</span>
            </label>
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
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-slate-400">
                Topics you care about
              </label>
              <span className={`text-xs ${atLimit ? 'text-amber-400' : 'text-slate-600'}`}>
                {selectedInterests.length}/{MAX_INTERESTS}
              </span>
            </div>

            {/* Selected chips */}
            {selectedInterests.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {selectedInterests.map(interest => (
                  <span
                    key={interest}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-600/25 text-indigo-300 border border-indigo-500/40 rounded-lg text-xs font-medium"
                  >
                    {interest}
                    <button
                      type="button"
                      onClick={() => removeInterest(interest)}
                      className="text-indigo-400 hover:text-indigo-200 transition-colors ml-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Preset chips */}
            <div className="flex flex-wrap gap-2 mb-3">
              {INTEREST_OPTIONS.filter(o => !selectedInterests.includes(o)).map(interest => (
                <button
                  key={interest}
                  type="button"
                  onClick={() => toggleInterest(interest)}
                  disabled={atLimit}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors border ${
                    atLimit
                      ? 'border-slate-800 text-slate-600 cursor-not-allowed'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  {interest}
                </button>
              ))}
            </div>

            {/* Custom text input */}
            {!atLimit && (
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={customInput}
                  onChange={e => setCustomInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); addCustomInterest() }
                  }}
                  placeholder="Add your own topic…"
                  maxLength={40}
                  className="flex-1 bg-slate-800 border border-slate-700 text-slate-100 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500 placeholder:text-slate-600"
                />
                <button
                  type="button"
                  onClick={addCustomInterest}
                  disabled={!customInput.trim()}
                  className="px-3 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-slate-200 text-xs font-medium rounded-lg transition-colors"
                >
                  Add
                </button>
              </div>
            )}
            {atLimit && (
              <p className="text-xs text-slate-600 mt-1">Remove one to add another.</p>
            )}
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

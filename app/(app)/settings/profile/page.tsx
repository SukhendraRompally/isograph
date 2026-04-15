'use client'

import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'

const INTEREST_OPTIONS = [
  'AI & Machine Learning', 'Leadership', 'Startups', 'Remote Work',
  'Productivity', 'Diversity & Inclusion', 'Climate & Sustainability',
  'DevOps', 'Open Source', 'Mental Health', 'Personal Finance',
  'Writing & Content', 'Public Speaking', 'Networking', 'Career Growth',
]

export default function ProfileSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [displayName, setDisplayName] = useState('')
  const [headline, setHeadline] = useState('')
  const [industry, setIndustry] = useState('')
  const [interests, setInterests] = useState<string[]>([])
  const [constraints, setConstraints] = useState('')

  useEffect(() => {
    fetch('/api/profile').then(r => r.json()).then(data => {
      const p = data.profile
      if (p) {
        setDisplayName(p.display_name ?? '')
        setHeadline(p.headline ?? '')
        setIndustry(p.industry ?? '')
        setInterests(p.interests ?? [])
        setConstraints((p.personal_constraints ?? []).join('\n'))
      }
      setLoading(false)
    })
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSaved(false)

    const res = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        display_name: displayName,
        headline,
        industry,
        interests,
        personal_constraints: constraints.split('\n').map(s => s.trim()).filter(Boolean),
      }),
    })

    if (res.ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } else {
      const data = await res.json()
      setError(data.error ?? 'Save failed')
    }
    setSaving(false)
  }

  if (loading) {
    return <div className="p-6 flex justify-center"><Loader2 className="w-5 h-5 text-indigo-400 animate-spin" /></div>
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-100">Profile</h1>
        <p className="text-sm text-slate-400 mt-1">This information shapes your content strategy.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <Card padding="md" className="space-y-4">
          <Input
            label="Display name"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
          />
          <Input
            label="Headline"
            value={headline}
            onChange={e => setHeadline(e.target.value)}
            placeholder="e.g. Product Manager · Building things people love"
          />
          <Input
            label="Industry"
            value={industry}
            onChange={e => setIndustry(e.target.value)}
            placeholder="e.g. Technology"
          />
        </Card>

        <Card padding="md">
          <p className="text-xs text-slate-400 mb-3">
            Interests <span className="text-slate-600">(up to 5)</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {INTEREST_OPTIONS.map(interest => (
              <button
                key={interest}
                type="button"
                onClick={() =>
                  setInterests(prev =>
                    prev.includes(interest)
                      ? prev.filter(i => i !== interest)
                      : [...prev, interest].slice(0, 5)
                  )
                }
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  interests.includes(interest)
                    ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
                }`}
              >
                {interest}
              </button>
            ))}
          </div>
        </Card>

        <Card padding="md">
          <label className="text-xs text-slate-400 block mb-1.5">
            Topics/tones to avoid <span className="text-slate-600">(one per line)</span>
          </label>
          <textarea
            value={constraints}
            onChange={e => setConstraints(e.target.value)}
            rows={4}
            placeholder="e.g. Politics&#10;Cryptocurrency"
            className="w-full bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-indigo-500 resize-none placeholder:text-slate-600"
          />
        </Card>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <Button type="submit" disabled={saving} size="lg">
          {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : saved ? '✓ Saved' : 'Save changes'}
        </Button>
      </form>
    </div>
  )
}

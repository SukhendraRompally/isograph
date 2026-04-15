'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, Loader2, CheckCircle, Sparkles, ArrowRight, ExternalLink } from 'lucide-react'
import type { AnalyticsImportData, TopPost } from '@/lib/linkedin/parseAnalyticsXls'

type Step = 'upload' | 'fetching' | 'done'

interface TopPostDisplay {
  url: string
  publishedDate: string
  impressions: number
  engagements: number
  engagementRate: number
}

interface FetchResult {
  fetchedCount: number
  failedCount: number
  newVersion: number
  postPreviews: { url: string; textPreview: string; engagementRate: number }[]
}

export default function OnboardingLinkedInImportPage() {
  const router = useRouter()

  const [step, setStep] = useState<Step>('upload')
  const [parseProgress, setParseProgress] = useState('')
  const [xlsError, setXlsError] = useState<string | null>(null)
  const [topPosts, setTopPosts] = useState<TopPostDisplay[]>([])
  const [fetchResult, setFetchResult] = useState<FetchResult | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const [personalConstraints, setPersonalConstraints] = useState('')
  const [saving, setSaving] = useState(false)

  // ── Step 1: parse XLS in browser, send to analytics API ───────────────────
  async function handleXlsUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setXlsError(null)
    setParseProgress('Reading file…')

    try {
      const XLSX = await import('xlsx')
      setParseProgress('Parsing spreadsheet…')
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array' })

      setParseProgress('Extracting posts…')
      const { parseLinkedInAnalyticsXls } = await import('@/lib/linkedin/parseAnalyticsXls')
      const parsed: AnalyticsImportData = parseLinkedInAnalyticsXls(wb, XLSX.utils)

      if (!parsed.topPosts || parsed.topPosts.length === 0) {
        setXlsError('No posts found in the Top Posts tab. Make sure you exported the full LinkedIn Creator Analytics .xlsx.')
        setParseProgress('')
        e.target.value = ''
        return
      }

      setParseProgress('Saving analytics…')

      // Save analytics + demographics
      const res = await fetch('/api/connections/linkedin/import-analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      })

      if (!res.ok) {
        const data = await res.json()
        setXlsError(data.error ?? 'Import failed')
        setParseProgress('')
        e.target.value = ''
        return
      }

      const importData = await res.json()
      setTopPosts(importData.topPostsDisplay ?? [])

      // Immediately kick off content fetch + style inference
      setStep('fetching')
      setParseProgress('')

      await fetchPostContent(parsed.topPosts.slice(0, 20) as TopPost[])

    } catch (err) {
      console.error(err)
      setXlsError('Failed to parse file. Make sure it is a valid LinkedIn Analytics .xlsx.')
      setParseProgress('')
    } finally {
      e.target.value = ''
    }
  }

  // ── Step 2: server fetches post text + runs style inference ───────────────
  async function fetchPostContent(posts: TopPost[]) {
    setFetchError(null)

    const postData = posts.map(p => ({
      url: p.url,
      impressions: p.impressions,
      engagements: p.engagements,
      engagementRate: p.engagementRate,
      publishedDate: p.publishedDate,
    }))

    const res = await fetch('/api/connections/linkedin/fetch-post-content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ posts: postData, maxPosts: 20 }),
    })

    const data = await res.json()

    if (!res.ok) {
      setFetchError(data.error ?? 'Could not read post content.')
      setStep('upload')  // allow retry
    } else {
      setFetchResult(data as FetchResult)
      setStep('done')
    }
  }

  // ── Step 3: save constraints + mark onboarding complete ───────────────────
  async function handleComplete() {
    setSaving(true)

    const constraints = personalConstraints
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean)

    await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personal_constraints: constraints,
        onboarding_path: 'linkedin',
        onboarding_completed: true,
      }),
    })

    // If no style model was built (XLS skipped), create neutral model
    if (!fetchResult) {
      await fetch('/api/style', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: {
            tone: 0.5, brevity: 0.5, hookIntensity: 0.5, expertiseDepth: 0.5,
            evidenceStyle: 0.5, ctaFriction: 0.5, perspective: 0.5, vocabularyRigor: 0.5,
          },
          source: 'onboarding',
        }),
      })
    }

    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">

        {/* Step indicator: 2 steps for LinkedIn path */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-2 h-2 rounded-full bg-slate-700" />
          <div className="w-2 h-2 rounded-full bg-indigo-500" />
        </div>

        <h1 className="text-2xl font-bold text-slate-100 text-center mb-2">
          Build your style model
        </h1>
        <p className="text-sm text-slate-400 text-center mb-8">
          Upload your LinkedIn Creator Analytics export. We read your posts, weight them by engagement, and build a style model from what actually worked.
        </p>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">

          {/* XLS upload / progress / result */}
          {step === 'upload' && (
            <div className="space-y-3">
              <div className="p-3 bg-slate-800/60 rounded-lg border border-slate-700/50">
                <p className="text-xs font-medium text-slate-300 mb-2">How to get your export:</p>
                <ol className="text-xs text-slate-400 space-y-1 list-decimal list-inside">
                  <li>LinkedIn profile → <strong className="text-slate-300">Creator mode analytics</strong></li>
                  <li>Click <strong className="text-slate-300">Export</strong> → select last 365 days</li>
                  <li>Download the .xlsx and upload below</li>
                </ol>
              </div>

              <label className={`flex flex-col items-center justify-center gap-2 px-4 py-5
                bg-slate-800 border border-dashed rounded-xl transition-colors
                ${parseProgress ? 'border-slate-700 cursor-default' : 'border-slate-700 hover:border-indigo-500/40 cursor-pointer'}`}>
                {parseProgress ? (
                  <>
                    <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
                    <span className="text-sm text-slate-400">{parseProgress}</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5 text-slate-400" />
                    <span className="text-sm text-slate-300">Select LinkedIn Analytics .xlsx</span>
                    <span className="text-xs text-slate-500">Contains 5 tabs including Top Posts and Demographics</span>
                  </>
                )}
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleXlsUpload}
                  disabled={!!parseProgress}
                />
              </label>

              {xlsError && <p className="text-xs text-red-400">{xlsError}</p>}
            </div>
          )}

          {step === 'fetching' && (
            <div className="py-6 flex flex-col items-center gap-3 text-center">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-200">Reading your posts…</p>
                <p className="text-xs text-slate-500 mt-1">
                  Fetching content from your top posts and inferring your writing style.
                  This takes about 30–60 seconds.
                </p>
              </div>
              {fetchError && (
                <div className="w-full">
                  <p className="text-xs text-red-400 mb-2">{fetchError}</p>
                  <button
                    onClick={() => setStep('upload')}
                    className="text-xs text-slate-400 hover:text-slate-300 underline"
                  >
                    Upload a different file
                  </button>
                </div>
              )}
            </div>
          )}

          {step === 'done' && fetchResult && (
            <div className="space-y-3">
              <div className="flex items-start gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-emerald-300">
                    Style model built from {fetchResult.fetchedCount} posts
                  </p>
                  <p className="text-xs text-emerald-400/70 mt-0.5">
                    Weighted by engagement rate · {topPosts.length} posts analysed
                    {fetchResult.failedCount > 0 && ` · ${fetchResult.failedCount} private/unavailable`}
                  </p>
                </div>
              </div>

              {/* Top post previews */}
              {fetchResult.postPreviews?.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs text-slate-500 font-medium">Posts used to train your model</p>
                  {fetchResult.postPreviews.slice(0, 3).map((p, i) => (
                    <div key={i} className="flex items-start gap-2 px-3 py-2 bg-slate-800 rounded-lg">
                      <span className="text-xs font-medium text-emerald-400 shrink-0 w-8">
                        {p.engagementRate}%
                      </span>
                      <p className="text-xs text-slate-400 leading-relaxed flex-1">{p.textPreview}</p>
                      <a href={p.url} target="_blank" rel="noopener noreferrer"
                        className="text-slate-600 hover:text-indigo-400 shrink-0 transition-colors">
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Personal constraints — always visible */}
          <div className="pt-2 border-t border-slate-800">
            <label className="text-xs text-slate-400 block mb-1.5">
              Topics or tones to avoid{' '}
              <span className="text-slate-600">(optional — one per line)</span>
            </label>
            <textarea
              value={personalConstraints}
              onChange={e => setPersonalConstraints(e.target.value)}
              rows={3}
              placeholder={'Politics\nCryptocurrency\nAggressive sales tone'}
              className="w-full bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-indigo-500 placeholder:text-slate-600 resize-none"
            />
            <p className="text-xs text-slate-600 mt-1">
              The Guardian agent blocks any generated post that touches these topics.
            </p>
          </div>

          {/* Complete setup */}
          <button
            onClick={handleComplete}
            disabled={saving || step === 'fetching'}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {saving ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Finishing setup…</>
            ) : (
              <>Go to dashboard <ArrowRight className="w-4 h-4" /></>
            )}
          </button>

          {/* Skip XLS */}
          {step === 'upload' && !parseProgress && (
            <p className="text-center text-xs text-slate-600">
              Don&apos;t have the file now?{' '}
              <button onClick={handleComplete} className="text-slate-500 hover:text-slate-400 underline">
                Skip and import from Settings later
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

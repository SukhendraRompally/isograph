'use client'

import { useState, useEffect } from 'react'
import { Loader2, Upload, BarChart2, Users, TrendingUp, CheckCircle, ExternalLink } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import LinkedInConnectButton from '@/components/LinkedInConnectButton'
import type { AnalyticsImportData } from '@/lib/linkedin/parseAnalyticsXls'

interface TopPostDisplay {
  url: string
  publishedDate: string
  impressions: number
  engagements: number
  engagementRate: number
}

interface ImportResult {
  postsAnalysed: number
  totalImpressions: number
  avgEngagementRate: number
  audienceSummary: string[]
  topPostsDisplay: TopPostDisplay[]
  styleModelUpdated: boolean
  note?: string
  periodSummary: {
    impressions: number
    reactions: number
    comments: number
    reposts: number
    newFollowers: number
  }
}

export default function ConnectionsPage() {
  const [loading, setLoading] = useState(true)
  const [plan, setPlan] = useState<'free' | 'pro'>('free')
  const [isConnected, setIsConnected] = useState(false)
  const [username, setUsername] = useState<string | undefined>()

  // Analytics XLS import state
  const [xlsLoading, setXlsLoading] = useState(false)
  const [xlsError, setXlsError] = useState<string | null>(null)
  const [xlsResult, setXlsResult] = useState<ImportResult | null>(null)
  const [parseProgress, setParseProgress] = useState('')

  // CSV (posts only) import state — Pro feature
  const [csvLoading, setCsvLoading] = useState(false)
  const [csvResult, setCsvResult] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/profile').then(r => r.json()).then(data => {
      setPlan(data.subscription?.plan ?? 'free')
      setLoading(false)
    })
    fetch('/api/connections/linkedin/status').then(r => r.json()).then(data => {
      setIsConnected(data.isConnected ?? false)
      setUsername(data.username)
    }).catch(() => {})
  }, [])

  // ── LinkedIn Analytics XLS upload ─────────────────────────────────────────
  async function handleAnalyticsXlsUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setXlsLoading(true)
    setXlsError(null)
    setXlsResult(null)
    setParseProgress('Reading file…')

    try {
      const XLSX = await import('xlsx')

      setParseProgress('Parsing spreadsheet…')
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array' })

      setParseProgress('Extracting posts and demographics…')
      const { parseLinkedInAnalyticsXls } = await import('@/lib/linkedin/parseAnalyticsXls')
      const parsed: AnalyticsImportData = parseLinkedInAnalyticsXls(wb, XLSX.utils)

      if (!parsed.topPosts || parsed.topPosts.length === 0) {
        setXlsError(
          'Could not find posts in the "Top Posts" tab. ' +
          'Make sure you exported the full LinkedIn Creator Analytics file.'
        )
        setXlsLoading(false)
        e.target.value = ''
        return
      }

      setParseProgress(`Found ${parsed.topPosts.length} posts — saving analytics…`)

      const res = await fetch('/api/connections/linkedin/import-analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      })

      const data = await res.json()

      if (!res.ok) {
        setXlsError(data.error ?? 'Import failed')
      } else {
        setXlsResult(data as ImportResult)
      }
    } catch (err) {
      console.error(err)
      setXlsError('Failed to parse the file. Make sure it is a valid LinkedIn Analytics .xlsx export.')
    } finally {
      setXlsLoading(false)
      setParseProgress('')
      e.target.value = ''
    }
  }

  // ── LinkedIn Posts CSV upload (Pro only) ──────────────────────────────────
  async function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setCsvLoading(true)
    setCsvResult(null)

    const text = await file.text()
    const res = await fetch('/api/connections/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv: text }),
    })
    const data = await res.json()

    setCsvResult(
      res.ok
        ? `Imported ${data.postsImported} posts. Style model ${data.styleUpdated ? 'updated.' : 'unchanged.'}`
        : `Error: ${data.error}`
    )
    setCsvLoading(false)
    e.target.value = ''
  }

  if (loading) {
    return (
      <div className="p-6 flex justify-center">
        <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-100">Connections</h1>
        <p className="text-sm text-slate-400 mt-1">
          Manage your LinkedIn connection and import your performance data.
        </p>
      </div>

      {/* LinkedIn OAuth */}
      <Card padding="md" className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-200">LinkedIn account</h2>
        <LinkedInConnectButton
          isConnected={isConnected}
          username={username}
          onDisconnect={() => setIsConnected(false)}
        />
      </Card>

      {/* Analytics XLS import */}
      <Card padding="md">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-200">Import Creator Analytics</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Upload your LinkedIn Creator Analytics export to see your top posts and audience breakdown.
            </p>
          </div>
          <Badge variant="success">Recommended</Badge>
        </div>

        {/* How-to */}
        <div className="mb-4 p-3 bg-slate-800/60 rounded-lg border border-slate-700/50">
          <p className="text-xs font-medium text-slate-300 mb-2">How to export:</p>
          <ol className="text-xs text-slate-400 space-y-1 list-decimal list-inside">
            <li>Go to your LinkedIn profile → <strong className="text-slate-300">Creator mode analytics</strong></li>
            <li>Click <strong className="text-slate-300">Export</strong> (top right)</li>
            <li>Select a date range (last 365 days recommended)</li>
            <li>Download the .xlsx and upload below</li>
          </ol>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { icon: TrendingUp, label: 'Top posts by impressions' },
            { icon: BarChart2, label: 'Engagement rates' },
            { icon: Users, label: 'Audience demographics' },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-1.5 text-xs text-slate-400">
              <Icon className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              {label}
            </div>
          ))}
        </div>

        {!xlsResult ? (
          <label className={`flex flex-col items-center justify-center gap-2 px-4 py-5
            bg-slate-800 border border-slate-700 border-dashed rounded-xl
            ${xlsLoading ? 'cursor-default' : 'cursor-pointer hover:border-indigo-500/40'}
            transition-colors`}>
            {xlsLoading ? (
              <>
                <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
                <span className="text-sm text-slate-400">{parseProgress || 'Processing…'}</span>
              </>
            ) : (
              <>
                <Upload className="w-5 h-5 text-slate-400" />
                <span className="text-sm text-slate-300">Select LinkedIn Analytics .xlsx</span>
                <span className="text-xs text-slate-500">The file with tabs: Discover, Engagement, Top Posts, Followers, Demographics</span>
              </>
            )}
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleAnalyticsXlsUpload}
              disabled={xlsLoading}
            />
          </label>
        ) : (
          <AnalyticsImportSuccess result={xlsResult} onReset={() => setXlsResult(null)} />
        )}

        {xlsError && <p className="mt-2 text-xs text-red-400">{xlsError}</p>}
      </Card>

      {/* Posts CSV import — Pro only, trains style model */}
      <Card padding="md">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-200">Import Posts CSV <span className="text-slate-500 font-normal">(trains style model)</span></h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Upload your Posts.csv export — contains the actual post text used to infer your writing style.
            </p>
          </div>
          {plan !== 'pro' && <Badge variant="indigo">Pro</Badge>}
        </div>

        {plan === 'pro' ? (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              LinkedIn → Settings → Data Privacy → Get a copy of your data → Posts.
            </p>
            <label className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 border border-slate-700 border-dashed rounded-xl cursor-pointer hover:border-indigo-500/40 transition-colors">
              {csvLoading ? (
                <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
              ) : (
                <Upload className="w-4 h-4 text-slate-400" />
              )}
              <span className="text-sm text-slate-400">
                {csvLoading ? 'Importing…' : 'Select LinkedIn Posts.csv'}
              </span>
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleCsvUpload}
                disabled={csvLoading}
              />
            </label>
            {csvResult && (
              <p className={`text-xs ${csvResult.startsWith('Error') ? 'text-red-400' : 'text-emerald-400'}`}>
                {csvResult}
              </p>
            )}
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-xs text-slate-400 mb-3">
              Upgrade to Pro to train your style model from your post text history.
            </p>
            <a
              href="/settings/billing"
              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition-colors"
            >
              Upgrade to Pro →
            </a>
          </div>
        )}
      </Card>
    </div>
  )
}

// ── Success state ─────────────────────────────────────────────────────────────

function AnalyticsImportSuccess({ result, onReset }: { result: ImportResult; onReset: () => void }) {
  return (
    <div className="space-y-4">
      {/* Summary banner */}
      <div className="flex items-start gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
        <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-emerald-300">Analytics imported</p>
          <p className="text-xs text-emerald-400/70 mt-0.5">
            {result.postsAnalysed} posts · {result.totalImpressions.toLocaleString()} total impressions · {result.avgEngagementRate}% avg engagement
          </p>
        </div>
      </div>

      {/* Top posts table */}
      {result.topPostsDisplay && result.topPostsDisplay.length > 0 && (
        <div>
          <p className="text-xs font-medium text-slate-400 mb-2">Top posts by impressions</p>
          <div className="space-y-1.5">
            {result.topPostsDisplay.slice(0, 5).map((p, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2 bg-slate-800 rounded-lg">
                <span className="text-xs text-slate-500 w-4 shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-500">{p.publishedDate}</span>
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-slate-400">{p.impressions.toLocaleString()} imp</span>
                  <span className="text-xs text-slate-400">{p.engagements} eng</span>
                  <span className={`text-xs font-medium ${p.engagementRate > result.avgEngagementRate ? 'text-emerald-400' : 'text-slate-400'}`}>
                    {p.engagementRate}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Audience demographics */}
      {result.audienceSummary && result.audienceSummary.length > 0 && (
        <div>
          <p className="text-xs font-medium text-slate-400 mb-1.5">Your audience</p>
          <div className="space-y-1">
            {result.audienceSummary.map((line, i) => (
              <p key={i} className="text-xs text-slate-500">{line}</p>
            ))}
          </div>
        </div>
      )}

      {/* Note about style model */}
      {result.note && (
        <p className="text-xs text-amber-400/80 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
          {result.note}
        </p>
      )}

      <button onClick={onReset} className="text-xs text-slate-500 hover:text-slate-400 transition-colors">
        Upload another file →
      </button>
    </div>
  )
}

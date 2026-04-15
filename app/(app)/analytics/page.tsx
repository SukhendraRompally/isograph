'use client'

import { useState, useEffect } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import StyleRadar from '@/components/StyleRadar'
import { StyleModel } from '@/types'

interface AnalyticsData {
  posts: Array<{
    id: string
    published_content: string
    was_edited: boolean
    published_at: string
    post_analytics: Array<{
      impressions: number
      reactions: number
      comments: number
      engagement_rate: number
    }>
  }>
  summary: {
    totalPosts: number
    totalImpressions: number
    totalReactions: number
    totalComments: number
    avgEngagementRate: number
  } | null
}

interface StyleData {
  current: { version: number; model: StyleModel; source: string; created_at: string } | null
  history: Array<{ id: string; version: number; model: StyleModel; source: string; created_at: string }>
}

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [styleData, setStyleData] = useState<StyleData | null>(null)
  const [reflectionLoading, setReflectionLoading] = useState(false)
  const [reflectionResult, setReflectionResult] = useState<{ summary: string; insights: string[] } | null>(null)
  const [reflectionError, setReflectionError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      const [analyticsRes, styleRes] = await Promise.all([
        fetch('/api/analytics'),
        fetch('/api/style'),
      ])
      if (analyticsRes.ok) setAnalytics(await analyticsRes.json())
      if (styleRes.ok) setStyleData(await styleRes.json())
      setLoading(false)
    }
    loadData()
  }, [])

  async function runReflection() {
    setReflectionLoading(true)
    setReflectionError(null)
    setReflectionResult(null)

    const res = await fetch('/api/reflect', { method: 'POST' })
    const data = await res.json()

    if (!res.ok) {
      setReflectionError(data.error ?? 'Reflection failed')
    } else {
      setReflectionResult({ summary: data.result.summary, insights: data.result.insights })
      // Reload style data to show updated model
      const styleRes = await fetch('/api/style')
      if (styleRes.ok) setStyleData(await styleRes.json())
    }
    setReflectionLoading(false)
  }

  const currentModel = styleData?.current?.model
  // Previous model for delta ghost
  const history = styleData?.history ?? []
  const previousModel: StyleModel | undefined = history.length >= 2 ? history[history.length - 2].model : undefined

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-64">
        <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-bold text-slate-100">Analytics</h1>
        <p className="text-sm text-slate-400 mt-1">Performance data and your evolving style model.</p>
      </div>

      {/* Summary stats */}
      {analytics?.summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Posts published', value: analytics.summary.totalPosts },
            { label: 'Total impressions', value: analytics.summary.totalImpressions >= 1000 ? `${(analytics.summary.totalImpressions / 1000).toFixed(1)}k` : analytics.summary.totalImpressions },
            { label: 'Total reactions', value: analytics.summary.totalReactions },
            { label: 'Avg engagement', value: `${analytics.summary.avgEngagementRate.toFixed(1)}%` },
          ].map(stat => (
            <Card key={stat.label} padding="md">
              <p className="text-xs text-slate-500 mb-1">{stat.label}</p>
              <p className="text-2xl font-bold text-slate-100">{stat.value}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Style model + reflection */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Style radar */}
        <Card padding="md">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-200">Your style model</h2>
              {styleData?.current && (
                <p className="text-xs text-slate-500 mt-0.5">
                  v{styleData.current.version} · {styleData.current.source}
                </p>
              )}
            </div>
            {previousModel && (
              <Badge variant="indigo">Showing delta from v{(styleData?.current?.version ?? 1) - 1}</Badge>
            )}
          </div>
          {currentModel ? (
            <StyleRadar current={currentModel} previous={previousModel} size={250} />
          ) : (
            <p className="text-sm text-slate-500 text-center py-8">Complete onboarding to see your style model.</p>
          )}
        </Card>

        {/* Reflection */}
        <Card padding="md">
          <h2 className="text-sm font-semibold text-slate-200 mb-1">Reflection</h2>
          <p className="text-xs text-slate-400 mb-4">
            Run Reflection to analyse your published posts and refine your style model.
          </p>

          {reflectionResult ? (
            <div className="space-y-3">
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
                <p className="text-xs text-emerald-300 font-medium mb-1">Style model updated</p>
                <p className="text-xs text-slate-300">{reflectionResult.summary}</p>
              </div>
              {reflectionResult.insights.map((insight, i) => (
                <p key={i} className="text-xs text-slate-400">· {insight}</p>
              ))}
            </div>
          ) : (
            <Button
              onClick={runReflection}
              disabled={reflectionLoading}
              className="w-full"
            >
              {reflectionLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Analysing posts…</>
              ) : (
                <><RefreshCw className="w-4 h-4" /> Run Reflection</>
              )}
            </Button>
          )}

          {reflectionError && (
            <p className="text-xs text-red-400 mt-3">{reflectionError}</p>
          )}

          {history.length > 1 && (
            <div className="mt-4 pt-4 border-t border-slate-800">
              <p className="text-xs text-slate-500 mb-2">Version history</p>
              <div className="space-y-1">
                {history.slice().reverse().map(row => (
                  <div key={row.id} className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">v{row.version} · {row.source}</span>
                    <span className="text-xs text-slate-600">
                      {new Date(row.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Posts with analytics */}
      {analytics && analytics.posts.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-200 mb-4">Posts performance</h2>
          <div className="space-y-3">
            {analytics.posts.map(post => {
              const a = post.post_analytics?.[0]
              return (
                <Card key={post.id} padding="md">
                  <div className="flex items-start gap-4">
                    <p className="text-sm text-slate-300 flex-1 line-clamp-2">
                      {(post.published_content ?? '').slice(0, 140)}…
                    </p>
                    {a ? (
                      <div className="shrink-0 grid grid-cols-2 gap-x-4 gap-y-1 text-right">
                        <div>
                          <p className="text-xs text-slate-500">Impressions</p>
                          <p className="text-sm font-semibold text-slate-200">{a.impressions}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Engagement</p>
                          <p className="text-sm font-semibold text-slate-200">{a.engagement_rate}%</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Reactions</p>
                          <p className="text-sm font-semibold text-slate-200">{a.reactions}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Comments</p>
                          <p className="text-sm font-semibold text-slate-200">{a.comments}</p>
                        </div>
                      </div>
                    ) : (
                      <Badge variant="default">No analytics yet</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    {post.was_edited && <Badge variant="indigo">edited</Badge>}
                    <span className="text-xs text-slate-600">
                      {new Date(post.published_at).toLocaleDateString()}
                    </span>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

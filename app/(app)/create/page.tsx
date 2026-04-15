'use client'

import { useState } from 'react'
import { Scan, CheckCircle2, Loader2, Pencil, Send, RotateCcw, ExternalLink, MessageSquarePlus } from 'lucide-react'
import { PersonalOpportunity } from '@/types'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'

type Stage =
  | 'idle'
  | 'topic-input'
  | 'scanning'
  | 'opportunities'
  | 'generating'
  | 'editing'
  | 'published'

interface GeneratedDraft {
  id: string
  content: string
  guardian?: { status: string; summary: string }
}

interface PublishResult {
  postUrn: string
  shareUrl: string
  publishedAt: string
}

export default function CreatePage() {
  const [stage, setStage] = useState<Stage>('idle')
  const [opportunities, setOpportunities] = useState<PersonalOpportunity[]>([])
  const [selectedOpp, setSelectedOpp] = useState<PersonalOpportunity | null>(null)
  const [draft, setDraft] = useState<GeneratedDraft | null>(null)
  const [editedContent, setEditedContent] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [publishResult, setPublishResult] = useState<PublishResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Topic path
  const [topicInput, setTopicInput] = useState('')
  const [topicOpportunity, setTopicOpportunity] = useState<PersonalOpportunity | null>(null)

  async function handleScan() {
    setStage('scanning')
    setError(null)
    setOpportunities([])
    setSelectedOpp(null)
    setDraft(null)

    const res = await fetch('/api/scout', { method: 'POST' })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Scout failed')
      setStage('idle')
      return
    }

    setOpportunities(data.opportunities)
    setStage('opportunities')
  }

  async function handleGenerate() {
    if (!selectedOpp) return
    setStage('generating')
    setError(null)

    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ opportunity: selectedOpp }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Generation failed')
      setStage('opportunities')
      return
    }

    setDraft({ id: data.post.id, content: data.content, guardian: data.guardian })
    setEditedContent(data.content)
    setIsEditing(false)
    setStage('editing')
  }

  async function handleGenerateFromTopic() {
    if (!topicInput.trim()) return
    setStage('generating')
    setError(null)

    const res = await fetch('/api/generate-from-topic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: topicInput.trim() }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Generation failed')
      setStage('topic-input')
      return
    }

    setTopicOpportunity(data.opportunity ?? null)
    setSelectedOpp(null)
    setDraft({ id: data.post.id, content: data.content, guardian: data.guardian })
    setEditedContent(data.content)
    setIsEditing(false)
    setStage('editing')
  }

  async function handlePublish() {
    if (!draft) return
    setError(null)

    const res = await fetch('/api/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId: draft.id, content: editedContent }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Publish failed')
      return
    }

    setPublishResult({ postUrn: data.postUrn, shareUrl: data.shareUrl, publishedAt: data.publishedAt })
    setStage('published')
  }

  function handleReset() {
    setStage('idle')
    setOpportunities([])
    setSelectedOpp(null)
    setTopicOpportunity(null)
    setTopicInput('')
    setDraft(null)
    setEditedContent('')
    setIsEditing(false)
    setPublishResult(null)
    setError(null)
  }

  // The topic currently being written about (for the editing stage summary pill)
  const activeTopic = selectedOpp?.topic ?? topicOpportunity?.topic ?? topicInput

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-100">Create a post</h1>
        <p className="text-sm text-slate-400 mt-1">
          Let Isograph find opportunities, or tell it what you want to write about.
        </p>
      </div>

      {/* Stage: idle — two paths */}
      {stage === 'idle' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Scout path */}
          <button
            onClick={handleScan}
            className="text-left bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-6 transition-all group"
          >
            <div className="w-10 h-10 bg-indigo-600/20 rounded-xl flex items-center justify-center mb-4 group-hover:bg-indigo-600/30 transition-colors">
              <Scan className="w-5 h-5 text-indigo-400" />
            </div>
            <h2 className="text-sm font-semibold text-slate-200 mb-1">Scout for opportunities</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Isograph scans Reddit, news, and trending signals to find content angles tailored to your background.
            </p>
          </button>

          {/* Topic path */}
          <button
            onClick={() => setStage('topic-input')}
            className="text-left bg-slate-900 border border-slate-800 hover:border-emerald-500/50 rounded-2xl p-6 transition-all group"
          >
            <div className="w-10 h-10 bg-emerald-600/20 rounded-xl flex items-center justify-center mb-4 group-hover:bg-emerald-600/30 transition-colors">
              <MessageSquarePlus className="w-5 h-5 text-emerald-400" />
            </div>
            <h2 className="text-sm font-semibold text-slate-200 mb-1">I know what I want to write</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Describe your topic in your own words. Isograph will shape it into a post that sounds like you.
            </p>
          </button>
        </div>
      )}

      {/* Stage: topic-input */}
      {stage === 'topic-input' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-slate-200 mb-1">What do you want to write about?</h2>
            <p className="text-xs text-slate-400">
              Describe your topic, angle, or idea in plain language. A few words or a full sentence — whatever feels natural.
            </p>
          </div>

          <textarea
            value={topicInput}
            onChange={e => setTopicInput(e.target.value)}
            placeholder="e.g. Why most teams over-engineer their data pipelines, or the leadership lesson I learned from a failed launch"
            rows={4}
            className="w-full bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 resize-none leading-relaxed placeholder:text-slate-500"
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && topicInput.trim().length >= 3) {
                handleGenerateFromTopic()
              }
            }}
          />

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => { setStage('idle'); setError(null) }} className="flex-1">
              Back
            </Button>
            <Button
              onClick={handleGenerateFromTopic}
              disabled={topicInput.trim().length < 3}
              className="flex-1"
              size="lg"
            >
              Generate post
            </Button>
          </div>

          <p className="text-xs text-slate-500 text-center">
            Isograph will use your style model and profile to write a post that sounds like you.
          </p>
        </div>
      )}

      {/* Stage: scanning */}
      {stage === 'scanning' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
          <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mx-auto mb-4" />
          <p className="text-sm text-slate-400">Scanning signals…</p>
          <div className="space-y-3 mt-6">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        </div>
      )}

      {/* Stage: opportunities */}
      {stage === 'opportunities' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-400">
              Found {opportunities.length} opportunities. Pick one to generate a post.
            </p>
            <Button variant="ghost" size="sm" onClick={handleScan}>
              <RotateCcw className="w-3.5 h-3.5" />
              Rescan
            </Button>
          </div>

          {opportunities.map(opp => (
            <button
              key={opp.id}
              onClick={() => setSelectedOpp(opp)}
              className={`w-full text-left bg-slate-900 border rounded-2xl p-5 transition-all ${
                selectedOpp?.id === opp.id
                  ? 'border-indigo-500/60 ring-1 ring-indigo-500/30'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 transition-colors ${
                  selectedOpp?.id === opp.id ? 'border-indigo-500 bg-indigo-500' : 'border-slate-600'
                }`}>
                  {selectedOpp?.id === opp.id && (
                    <CheckCircle2 className="w-3 h-3 text-white" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-200">{opp.topic}</p>
                  <p className="text-xs text-slate-400 mt-1">{opp.hook}</p>
                  <p className="text-xs text-slate-500 mt-2">{opp.why}</p>
                  <div className="flex gap-2 mt-3">
                    <Badge variant="indigo">
                      Signal {opp.signalStrength}
                    </Badge>
                    <Badge variant="default">
                      Fit {opp.personalFit}
                    </Badge>
                    {opp.trendingTerms.slice(0, 2).map(term => (
                      <Badge key={term} variant="default">{term}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            </button>
          ))}

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <Button
            onClick={handleGenerate}
            disabled={!selectedOpp}
            className="w-full"
            size="lg"
          >
            Generate post
          </Button>
        </div>
      )}

      {/* Stage: generating */}
      {stage === 'generating' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
          <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mx-auto mb-4" />
          <p className="text-sm font-medium text-slate-200">Generating your post…</p>
          <p className="text-xs text-slate-400 mt-1">Bridge + Guardian agents running</p>
        </div>
      )}

      {/* Stage: editing */}
      {stage === 'editing' && draft && (
        <div className="space-y-4">
          {/* Topic summary pill */}
          {activeTopic && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 flex items-center gap-3">
              <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-slate-500">Writing about</p>
                <p className="text-sm font-medium text-slate-200 truncate">{activeTopic}</p>
              </div>
            </div>
          )}

          {/* Guardian notice */}
          {draft.guardian && draft.guardian.status === 'review' && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
              <p className="text-xs text-amber-400 font-medium">Guardian flagged for review</p>
              <p className="text-xs text-amber-400/80 mt-0.5">{draft.guardian.summary}</p>
            </div>
          )}

          {/* Post editor */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-slate-400">
                {editedContent.split(/\s+/).filter(Boolean).length} words
                {editedContent !== draft.content && (
                  <span className="ml-2 text-amber-400">· edited</span>
                )}
              </p>
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-indigo-400 transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
                {isEditing ? 'Preview' : 'Edit'}
              </button>
            </div>

            {isEditing ? (
              <textarea
                value={editedContent}
                onChange={e => setEditedContent(e.target.value)}
                rows={10}
                className="w-full bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-indigo-500 resize-none leading-relaxed"
              />
            ) : (
              <div className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
                {editedContent}
              </div>
            )}
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                if (topicOpportunity) {
                  setStage('topic-input')
                } else {
                  setStage('opportunities')
                }
              }}
              className="flex-1"
            >
              Back
            </Button>
            <Button onClick={handlePublish} className="flex-1" size="lg">
              <Send className="w-4 h-4" />
              Publish to LinkedIn
            </Button>
          </div>
        </div>
      )}

      {/* Stage: published */}
      {stage === 'published' && publishResult && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
          <div className="w-12 h-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
          </div>
          <h2 className="text-base font-semibold text-slate-200 mb-2">Published!</h2>
          <p className="text-xs text-slate-400 mb-6">
            Analytics will be ingested automatically in 24 hours (Pro) or you can enter them manually.
          </p>
          <div className="flex gap-3 justify-center">
            <a
              href={publishResult.shareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold rounded-lg transition-colors border border-slate-700"
            >
              <ExternalLink className="w-4 h-4" />
              View on LinkedIn
            </a>
            <Button onClick={handleReset}>
              Create another post
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { Loader2, Upload } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import LinkedInConnectButton from '@/components/LinkedInConnectButton'

export default function ConnectionsPage() {
  const [loading, setLoading] = useState(true)
  const [plan, setPlan] = useState<'free' | 'pro'>('free')
  const [isConnected, setIsConnected] = useState(false)
  const [username, setUsername] = useState<string | undefined>()
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

    if (res.ok) {
      setCsvResult(`Imported ${data.postsImported} posts. Style model ${data.styleUpdated ? 'updated.' : 'unchanged.'}`)
    } else {
      setCsvResult(`Error: ${data.error}`)
    }
    setCsvLoading(false)
  }

  if (loading) {
    return <div className="p-6 flex justify-center"><Loader2 className="w-5 h-5 text-indigo-400 animate-spin" /></div>
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-100">Connections</h1>
        <p className="text-sm text-slate-400 mt-1">Manage your LinkedIn connection and post history import.</p>
      </div>

      <Card padding="md" className="space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-sm font-semibold text-slate-200">LinkedIn</h2>
        </div>
        <LinkedInConnectButton
          isConnected={isConnected}
          username={username}
          onDisconnect={() => setIsConnected(false)}
        />
      </Card>

      <Card padding="md">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-200">Import post history</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Upload your LinkedIn Posts.csv export to bootstrap your style model.
            </p>
          </div>
          {plan !== 'pro' && <Badge variant="indigo">Pro</Badge>}
        </div>

        {plan === 'pro' ? (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              Go to LinkedIn Settings → Data Privacy → Get a copy of your data → Posts.
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
            <p className="text-xs text-slate-400 mb-3">Upgrade to Pro to import your post history for style inference.</p>
            <a href="/settings/billing" className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition-colors">
              Upgrade to Pro →
            </a>
          </div>
        )}
      </Card>
    </div>
  )
}

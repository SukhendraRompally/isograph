'use client'

import { useState } from 'react'
import { CheckCircle2, Loader2, Unlink } from 'lucide-react'

interface Props {
  isConnected: boolean
  username?: string
  onDisconnect?: () => void
}

export default function LinkedInConnectButton({ isConnected, username, onDisconnect }: Props) {
  const [disconnecting, setDisconnecting] = useState(false)

  async function handleDisconnect() {
    if (!onDisconnect) return
    setDisconnecting(true)
    try {
      await fetch('/api/connections/linkedin/disconnect', { method: 'DELETE' })
      onDisconnect()
    } finally {
      setDisconnecting(false)
    }
  }

  if (isConnected) {
    return (
      <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-emerald-300">LinkedIn connected</p>
          {username && <p className="text-xs text-slate-400 truncate">{username}</p>}
        </div>
        <button
          onClick={handleDisconnect}
          disabled={disconnecting}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-red-400 transition-colors"
        >
          {disconnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unlink className="w-3.5 h-3.5" />}
          Disconnect
        </button>
      </div>
    )
  }

  return (
    <a
      href="/api/connections/linkedin/authorize"
      className="flex items-center justify-center gap-2.5 bg-[#0077B5] hover:bg-[#006399] text-white text-sm font-semibold rounded-xl px-5 py-3 transition-colors w-full"
    >
      Connect LinkedIn
    </a>
  )
}

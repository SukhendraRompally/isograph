'use client'

import { PersonalOpportunity } from '@/types'
import { CheckCircle2 } from 'lucide-react'

interface OpportunityCardProps {
  opportunity: PersonalOpportunity
  isSelected: boolean
  onSelect: () => void
}

function SignalBar({ value, label }: { value: number; label: string }) {
  const color = value >= 75 ? 'bg-green-500' : value >= 50 ? 'bg-yellow-500' : 'bg-slate-500'
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-slate-400 w-20 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-[10px] text-slate-300 w-5 text-right">{value}</span>
    </div>
  )
}

export default function OpportunityCard({ opportunity, isSelected, onSelect }: OpportunityCardProps) {
  return (
    <div
      onClick={onSelect}
      className={`rounded-xl border p-4 flex flex-col gap-3 cursor-pointer transition-all ${
        isSelected
          ? 'bg-indigo-600/15 border-indigo-500/50 ring-1 ring-indigo-500/30'
          : 'bg-slate-800/50 border-slate-700/50 hover:border-slate-600'
      }`}
    >
      {/* Topic + selected indicator */}
      <div className="flex items-start justify-between gap-2">
        <p className={`text-xs font-semibold leading-snug ${isSelected ? 'text-indigo-300' : 'text-indigo-400'}`}>
          {opportunity.topic}
        </p>
        {isSelected && (
          <CheckCircle2 size={14} className="text-indigo-400 shrink-0 mt-0.5" />
        )}
      </div>

      <p className="text-xs text-slate-300 leading-relaxed">{opportunity.hook}</p>
      <p className="text-xs text-slate-400 leading-relaxed">{opportunity.why}</p>

      {/* Signal bars */}
      <div className="space-y-1.5">
        <SignalBar value={opportunity.signalStrength} label="Signal strength" />
        <SignalBar value={opportunity.personalFit} label="Personal fit" />
      </div>

      {/* Trending terms */}
      <div className="flex flex-wrap gap-1">
        {opportunity.trendingTerms.map(term => (
          <span key={term} className="text-[10px] px-1.5 py-0.5 bg-slate-700/60 text-slate-400 rounded">
            {term}
          </span>
        ))}
      </div>

      {/* Source signals */}
      <div className="border-t border-slate-700/40 pt-2 space-y-0.5">
        {opportunity.sourceSignals.map((sig, i) => (
          <p key={i} className="text-[10px] text-slate-500">· {sig}</p>
        ))}
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { StyleModel, STYLE_DIMENSIONS, STYLE_LABELS } from '@/types'
import StyleRadar from './StyleRadar'

const QUESTION_TEXT: Record<keyof StyleModel, string> = {
  tone:            'How would you describe your writing style on LinkedIn?',
  brevity:         'When you write about professional topics, how long do your posts tend to be?',
  hookIntensity:   'How do you typically open a LinkedIn post?',
  expertiseDepth:  'Who do you primarily write for?',
  evidenceStyle:   'How do you support your points?',
  ctaFriction:     'How do your posts typically end?',
  perspective:     'What angle do you usually write from?',
  vocabularyRigor: 'What kind of language do you use?',
}

interface Props {
  onComplete: (model: StyleModel) => void
  loading?: boolean
}

export default function OnboardingQuestionnaire({ onComplete, loading }: Props) {
  const [answers, setAnswers] = useState<Record<keyof StyleModel, number>>(
    STYLE_DIMENSIONS.reduce((acc, dim) => ({ ...acc, [dim]: 0.5 }), {} as Record<keyof StyleModel, number>)
  )

  const styleModel: StyleModel = answers as StyleModel


  function handleSubmit() {
    onComplete(styleModel)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Questions */}
      <div className="space-y-6">
        {STYLE_DIMENSIONS.map(dim => {
          const label = STYLE_LABELS[dim]
          const value = answers[dim]
          return (
            <div key={dim}>
              <label className="text-sm font-medium text-slate-200 block mb-1">
                {QUESTION_TEXT[dim]}
              </label>
              <div className="flex items-center gap-3 mt-3">
                <span className="text-xs text-slate-500 w-28 text-right shrink-0">{label.low}</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={value}
                  onChange={e => setAnswers(prev => ({ ...prev, [dim]: parseFloat(e.target.value) }))}
                  className="flex-1 accent-indigo-500"
                />
                <span className="text-xs text-slate-500 w-28 shrink-0">{label.high}</span>
              </div>
              <div className="text-center mt-1">
                <span className="text-xs text-indigo-400 font-medium">
                  {value < 0.33 ? label.low : value > 0.66 ? label.high : 'Balanced'}
                </span>
              </div>
            </div>
          )
        })}

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-semibold rounded-lg transition-colors mt-4"
        >
          {loading ? 'Creating your style model…' : 'Create my style model'}
        </button>
      </div>

      {/* Live radar preview */}
      <div className="flex flex-col items-center gap-4">
        <p className="text-sm text-slate-400 text-center">Your style model — updates as you answer</p>
        <StyleRadar current={styleModel} size={280} />
        <div className="grid grid-cols-2 gap-2 w-full max-w-xs mt-2">
          {STYLE_DIMENSIONS.map(dim => (
            <div key={dim} className="flex items-center justify-between bg-slate-800 rounded-lg px-3 py-1.5">
              <span className="text-xs text-slate-400">{STYLE_LABELS[dim].label}</span>
              <span className="text-xs font-mono text-indigo-400">{answers[dim].toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

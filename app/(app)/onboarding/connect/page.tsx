'use client'

import { useRouter } from 'next/navigation'
import { BarChart2, SlidersHorizontal, ArrowRight } from 'lucide-react'

export default function OnboardingPathPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">

        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-slate-100 mb-3">
            How do you want to set up your style?
          </h1>
          <p className="text-slate-400 text-sm max-w-md mx-auto">
            Isograph needs to understand how you write. Choose the approach that fits you best.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* LinkedIn path */}
          <button
            onClick={() => router.push('/onboarding/linkedin-import')}
            className="group text-left bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-6 transition-all hover:bg-slate-900/80 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-4">
              <BarChart2 className="w-5 h-5 text-indigo-400" />
            </div>

            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-base font-semibold text-slate-100">Learn from my LinkedIn</h2>
              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full">
                Recommended
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Upload your Creator Analytics export. We read your actual posts, weight them by engagement rate, and infer your style from what genuinely worked.
            </p>

            <ul className="text-xs text-slate-500 space-y-1 mb-5">
              <li className="flex items-center gap-1.5">
                <span className="w-1 h-1 bg-indigo-500 rounded-full shrink-0" />
                No sliders or guesswork
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-1 h-1 bg-indigo-500 rounded-full shrink-0" />
                Style model reflects what your audience responds to
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-1 h-1 bg-indigo-500 rounded-full shrink-0" />
                Best if you&apos;ve posted 6+ months on LinkedIn
              </li>
            </ul>

            <div className="flex items-center gap-1 text-xs font-medium text-indigo-400 group-hover:gap-2 transition-all">
              Get started <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </button>

          {/* Manual path */}
          <button
            onClick={() => router.push('/onboarding/interests')}
            className="group text-left bg-slate-900 border border-slate-800 hover:border-slate-600 rounded-2xl p-6 transition-all hover:bg-slate-900/80 focus:outline-none focus:ring-2 focus:ring-slate-500/40"
          >
            <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center mb-4">
              <SlidersHorizontal className="w-5 h-5 text-slate-400" />
            </div>

            <h2 className="text-base font-semibold text-slate-100 mb-1">Set it up manually</h2>

            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Tell us your topics and answer 8 quick style questions. A good starting point if you&apos;re newer to LinkedIn or prefer to define your voice explicitly.
            </p>

            <ul className="text-xs text-slate-500 space-y-1 mb-5">
              <li className="flex items-center gap-1.5">
                <span className="w-1 h-1 bg-slate-500 rounded-full shrink-0" />
                Industry, interests, and topics to avoid
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-1 h-1 bg-slate-500 rounded-full shrink-0" />
                8 style dimension sliders with live preview
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-1 h-1 bg-slate-500 rounded-full shrink-0" />
                Works even with no posting history
              </li>
            </ul>

            <div className="flex items-center gap-1 text-xs font-medium text-slate-400 group-hover:gap-2 group-hover:text-slate-300 transition-all">
              Get started <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </button>

        </div>

        <p className="text-center text-xs text-slate-600 mt-6">
          You can switch approaches or re-import from Settings at any time.
        </p>

      </div>
    </div>
  )
}

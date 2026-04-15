import Link from 'next/link'
import { CheckCircle2, TrendingUp, Zap, BarChart2 } from 'lucide-react'
import { PLAN_DISPLAY } from '@/lib/stripe/plans'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
            <span className="text-white text-xs font-bold">I</span>
          </div>
          <span className="text-base font-bold">Isograph</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm text-slate-400 hover:text-slate-200 transition-colors">
            Sign in
          </Link>
          <Link
            href="/signup"
            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Get started free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 py-24 max-w-4xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 bg-indigo-600/10 border border-indigo-500/20 rounded-full px-4 py-1.5 mb-8">
          <Zap className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-xs text-indigo-300 font-medium">Personal LinkedIn intelligence</span>
        </div>
        <h1 className="text-5xl font-black text-slate-100 leading-tight mb-6">
          LinkedIn content that<br />
          <span className="text-indigo-400">sounds like you</span>
        </h1>
        <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          Isograph learns your writing style, scouts trending topics in your industry, and generates posts that sound genuinely like you &mdash; not an AI assistant. It gets better every time you publish.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            href="/signup"
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors"
          >
            Start free — no credit card
          </Link>
          <Link href="/login" className="text-sm text-slate-400 hover:text-slate-200 transition-colors">
            Already have an account →
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-16 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: TrendingUp,
              title: 'Learns your style',
              body: 'Answer 8 questions to create your style model. Isograph refines it every time you publish, edit, or get engagement.',
            },
            {
              icon: Zap,
              title: 'Scouts your niche',
              body: 'Real-time signals from Reddit, news, and industry trends — filtered for your specific background, not generic trending topics.',
            },
            {
              icon: BarChart2,
              title: 'Closes the loop',
              body: 'Post performance feeds back into your style model. Over time, posts get measurably better at earning engagement from your audience.',
            },
          ].map(feat => (
            <div key={feat.title} className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <div className="w-9 h-9 bg-indigo-600/20 rounded-xl flex items-center justify-center mb-4">
                <feat.icon className="w-5 h-5 text-indigo-400" />
              </div>
              <h3 className="text-sm font-bold text-slate-200 mb-2">{feat.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{feat.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="px-6 py-16 max-w-3xl mx-auto" id="pricing">
        <h2 className="text-2xl font-bold text-slate-100 text-center mb-3">Simple pricing</h2>
        <p className="text-sm text-slate-400 text-center mb-10">Free forever. Upgrade when you&apos;re ready to scale.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {(['free', 'pro'] as const).map(plan => {
            const info = PLAN_DISPLAY[plan]
            return (
              <div
                key={plan}
                className={`bg-slate-900 border rounded-2xl p-6 ${
                  plan === 'pro' ? 'border-indigo-500/40' : 'border-slate-800'
                }`}
              >
                <div className="mb-4">
                  <p className="text-base font-bold text-slate-200">{info.name}</p>
                  <p className="text-2xl font-black text-slate-100 mt-1">{info.price}</p>
                </div>
                <ul className="space-y-2 mb-6">
                  {info.features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm text-slate-400">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/signup"
                  className={`block text-center py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                    plan === 'pro'
                      ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                  }`}
                >
                  {plan === 'pro' ? 'Start with Pro' : 'Start free'}
                </Link>
              </div>
            )
          })}
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 border-t border-slate-900 text-center">
        <p className="text-xs text-slate-600">© {new Date().getFullYear()} Isograph. Built for people who have things to say.</p>
      </footer>
    </div>
  )
}

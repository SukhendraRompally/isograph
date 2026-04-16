import Link from 'next/link'
import { TrendingUp, Zap, BarChart2 } from 'lucide-react'

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
              body: 'Upload your LinkedIn analytics export and Isograph builds your style model from your actual post history — weighted by what earned the most engagement from your audience.',
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

      {/* Footer */}
      <footer className="px-6 py-8 border-t border-slate-900 text-center">
        <p className="text-xs text-slate-600">© {new Date().getFullYear()} Isograph. Built for people who have things to say.</p>
      </footer>
    </div>
  )
}

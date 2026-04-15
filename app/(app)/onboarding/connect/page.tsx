import { createClient } from '@/lib/supabase/server'
import LinkedInConnectButton from '@/components/LinkedInConnectButton'
import Link from 'next/link'

export default async function OnboardingConnectPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: connection } = user ? await supabase
    .from('social_connections')
    .select('platform_username, is_active')
    .eq('user_id', user.id)
    .eq('platform', 'linkedin')
    .single() : { data: null }

  const isConnected = connection?.is_active ?? false

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3].map(step => (
            <div
              key={step}
              className={`w-2 h-2 rounded-full transition-colors ${step === 1 ? 'bg-indigo-500' : 'bg-slate-700'}`}
            />
          ))}
        </div>

        <h1 className="text-2xl font-bold text-slate-100 text-center mb-2">
          Connect LinkedIn
        </h1>
        <p className="text-sm text-slate-400 text-center mb-8">
          Isograph uses your LinkedIn to publish posts and learn from their performance.
        </p>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <LinkedInConnectButton
            isConnected={isConnected}
            username={connection?.platform_username}
          />

          <div className="text-xs text-slate-500 space-y-1.5 pt-2 border-t border-slate-800">
            <p className="font-medium text-slate-400">What we access:</p>
            <p>• Post on your behalf (only when you hit publish)</p>
            <p>• Read analytics for posts created through Isograph</p>
            <p>• Your basic profile (name, photo)</p>
            <p>• We never read your inbox or connections</p>
          </div>
        </div>

        <div className="flex items-center justify-between mt-6">
          <Link href="/onboarding/interests" className="text-xs text-slate-500 hover:text-slate-400 transition-colors">
            Skip for now →
          </Link>
          {isConnected && (
            <Link
              href="/onboarding/interests"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Continue →
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

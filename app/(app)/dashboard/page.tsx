import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { TrendingUp, PenLine, Zap, BarChart2 } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [{ data: profile }, { data: sub }, { data: recentPosts }, { data: analyticsRows }] = await Promise.all([
    supabase.from('user_profiles').select('display_name, onboarding_completed').eq('id', user.id).single(),
    supabase.from('subscriptions').select('plan, ai_posts_used_this_period').eq('user_id', user.id).single(),
    supabase.from('posts').select('id, published_content, was_edited, published_at, status').eq('user_id', user.id).eq('status', 'published').order('published_at', { ascending: false }).limit(5),
    supabase.from('post_analytics').select('impressions, reactions, comments, engagement_rate').eq('user_id', user.id),
  ])

  const plan = sub?.plan ?? 'free'
  const postsUsed = sub?.ai_posts_used_this_period ?? 0
  const postsLimit = plan === 'pro' ? 60 : 5
  const totalImpressions = analyticsRows?.reduce((s, r) => s + (r.impressions ?? 0), 0) ?? 0
  const totalReactions = analyticsRows?.reduce((s, r) => s + (r.reactions ?? 0), 0) ?? 0
  const avgEngagement = analyticsRows?.length
    ? analyticsRows.reduce((s, r) => s + (r.engagement_rate ?? 0), 0) / analyticsRows.length
    : 0

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const displayName = profile?.display_name ?? 'there'

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-xl font-bold text-slate-100">
          {greeting}, {displayName.split(' ')[0]}!
        </h1>
        <p className="text-sm text-slate-400 mt-1">Here&apos;s how your LinkedIn presence is growing.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card padding="md">
          <p className="text-xs text-slate-500 mb-1">AI posts used</p>
          <p className="text-2xl font-bold text-slate-100">{postsUsed}</p>
          <p className="text-xs text-slate-500 mt-0.5">of {postsLimit} this month</p>
          <div className="mt-3 h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-600 rounded-full transition-all"
              style={{ width: `${Math.min(100, (postsUsed / postsLimit) * 100)}%` }}
            />
          </div>
        </Card>

        <Card padding="md">
          <p className="text-xs text-slate-500 mb-1">Total impressions</p>
          <p className="text-2xl font-bold text-slate-100">
            {totalImpressions >= 1000 ? `${(totalImpressions / 1000).toFixed(1)}k` : totalImpressions}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">across all posts</p>
        </Card>

        <Card padding="md">
          <p className="text-xs text-slate-500 mb-1">Total reactions</p>
          <p className="text-2xl font-bold text-slate-100">{totalReactions}</p>
          <p className="text-xs text-slate-500 mt-0.5">likes + comments</p>
        </Card>

        <Card padding="md">
          <p className="text-xs text-slate-500 mb-1">Avg. engagement</p>
          <p className="text-2xl font-bold text-slate-100">{avgEngagement.toFixed(1)}%</p>
          <p className="text-xs text-slate-500 mt-0.5">engagement rate</p>
        </Card>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        <Link href="/create" className="group">
          <Card padding="md" className="hover:border-indigo-500/40 transition-colors h-full">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-indigo-600/20 rounded-lg flex items-center justify-center">
                <PenLine className="w-4 h-4 text-indigo-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-200 group-hover:text-indigo-300 transition-colors">Create a post</p>
                <p className="text-xs text-slate-500">Scout → generate → publish</p>
              </div>
            </div>
          </Card>
        </Link>

        <Link href="/analytics" className="group">
          <Card padding="md" className="hover:border-indigo-500/40 transition-colors h-full">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-emerald-600/20 rounded-lg flex items-center justify-center">
                <BarChart2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-200 group-hover:text-indigo-300 transition-colors">View analytics</p>
                <p className="text-xs text-slate-500">Performance + style evolution</p>
              </div>
            </div>
          </Card>
        </Link>

        <Link href="/settings/connections" className="group">
          <Card padding="md" className="hover:border-indigo-500/40 transition-colors h-full">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600/20 rounded-lg flex items-center justify-center">
                <Zap className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-200 group-hover:text-indigo-300 transition-colors">Connections</p>
                <p className="text-xs text-slate-500">LinkedIn + CSV import</p>
              </div>
            </div>
          </Card>
        </Link>
      </div>

      {/* Recent posts */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-200">Recent posts</h2>
          <Link href="/analytics" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
            View all →
          </Link>
        </div>

        {!recentPosts || recentPosts.length === 0 ? (
          <Card padding="md" className="text-center">
            <TrendingUp className="w-8 h-8 text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-400">No posts yet.</p>
            <p className="text-xs text-slate-500 mt-1">
              <Link href="/create" className="text-indigo-400 hover:text-indigo-300">Create your first post →</Link>
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {recentPosts.map(post => (
              <Card key={post.id} padding="md">
                <div className="flex items-start justify-between gap-4">
                  <p className="text-sm text-slate-300 line-clamp-2 flex-1">
                    {(post.published_content ?? '').slice(0, 160)}
                    {(post.published_content ?? '').length > 160 ? '…' : ''}
                  </p>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <Badge variant={post.status === 'published' ? 'success' : 'default'}>
                      {post.status}
                    </Badge>
                    {post.was_edited && (
                      <Badge variant="indigo">edited</Badge>
                    )}
                  </div>
                </div>
                {post.published_at && (
                  <p className="text-xs text-slate-600 mt-2">
                    {new Date(post.published_at).toLocaleDateString()}
                  </p>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

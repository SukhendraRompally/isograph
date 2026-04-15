import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import Image from 'next/image'
import {
  LayoutDashboard,
  PenLine,
  BarChart2,
  Settings,
} from 'lucide-react'
import LogoutButton from '@/components/LogoutButton'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/create',    label: 'Create',    icon: PenLine },
  { href: '/analytics', label: 'Analytics', icon: BarChart2 },
  { href: '/settings',  label: 'Settings',  icon: Settings },
]

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('display_name, avatar_url, onboarding_completed')
    .eq('id', user.id)
    .single()

  // Send to onboarding if not yet complete
  if (!profile?.onboarding_completed) {
    redirect('/onboarding/connect')
  }

  const displayName = profile?.display_name ?? user.email?.split('@')[0] ?? 'User'
  const initials = displayName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100">
      {/* Sidebar */}
      <aside className="w-56 flex flex-col border-r border-slate-800 bg-slate-900">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 py-5 border-b border-slate-800">
          <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">I</span>
          </div>
          <span className="text-base font-bold text-slate-100">Isograph</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-4 space-y-0.5">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors group"
            >
              <Icon className="w-4 h-4 flex-shrink-0 group-hover:text-indigo-400 transition-colors" />
              {label}
            </Link>
          ))}
        </nav>

        {/* User section */}
        <div className="px-2 py-4 border-t border-slate-800 space-y-0.5">
          <Link
            href="/settings/profile"
            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800 transition-colors w-full"
          >
            {profile?.avatar_url ? (
              <Image
                src={profile.avatar_url}
                alt={displayName}
                width={28}
                height={28}
                className="w-7 h-7 rounded-full flex-shrink-0"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-semibold text-white">{initials}</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-200 truncate">{displayName}</p>
              <p className="text-xs text-slate-500 truncate">{user.email}</p>
            </div>
          </Link>

          <LogoutButton />
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}

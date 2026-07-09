import { Link, useLocation, useNavigate } from 'react-router-dom'
import { BarChart2, Database, LogOut, Plus, ChevronRight } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import type { ReactNode } from 'react'
import { cn } from '../lib/utils'

interface Props {
  children: ReactNode
  onUpload?: () => void
}

export function Layout({ children, onUpload }: Props) {
  const { user, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  const nav = [
    { to: '/app', label: 'Dashboards', icon: BarChart2 },
    { to: '/app/data', label: 'Datasets', icon: Database },
  ]

  return (
    <div className="flex h-screen bg-surface-0">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 flex flex-col bg-surface-1 border-r border-border">
        {/* Logo */}
        <div className="h-14 flex items-center px-5 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center">
              <BarChart2 size={14} className="text-white" />
            </div>
            <span className="font-semibold text-white text-sm">DashAI</span>
          </div>
        </div>

        {/* New Dashboard button */}
        {onUpload && (
          <div className="px-3 py-3 border-b border-border">
            <button
              onClick={onUpload}
              className="w-full flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors"
            >
              <Plus size={15} />
              New Dashboard
            </button>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 px-3 py-3 space-y-1">
          {nav.map(({ to, label, icon: Icon }) => {
            const active = location.pathname === to
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
                  active
                    ? 'bg-violet-600/20 text-violet-400 font-medium'
                    : 'text-slate-400 hover:text-white hover:bg-surface-3'
                )}
              >
                <Icon size={16} />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* User */}
        <div className="px-3 py-3 border-t border-border">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg">
            <div className="w-7 h-7 rounded-full bg-violet-600/30 flex items-center justify-center text-violet-400 text-xs font-medium flex-shrink-0">
              {user?.email?.[0]?.toUpperCase() ?? '?'}
            </div>
            <span className="text-xs text-slate-400 truncate flex-1">{user?.email}</span>
            <button
              onClick={handleSignOut}
              className="text-slate-500 hover:text-slate-300 transition-colors"
              title="Sign out"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}

export function PageHeader({
  title,
  subtitle,
  back,
  actions,
}: {
  title: string
  subtitle?: string
  back?: { to: string; label: string }
  actions?: ReactNode
}) {
  return (
    <div className="h-14 flex items-center px-6 border-b border-border gap-3">
      {back && (
        <Link to={back.to} className="text-slate-500 hover:text-slate-300 flex items-center gap-1 text-sm mr-1">
          <span>{back.label}</span>
          <ChevronRight size={14} />
        </Link>
      )}
      <div className="flex-1 min-w-0">
        <h1 className="text-sm font-semibold text-white truncate">{title}</h1>
        {subtitle && <p className="text-xs text-slate-500 truncate">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

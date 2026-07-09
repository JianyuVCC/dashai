import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { BarChart2 } from 'lucide-react'
import { DashboardGrid } from '../components/DashboardGrid'
import { ChatWidget } from '../components/ChatWidget'
import { Spinner } from '../components/ui/Spinner'
import { getPublicDashboard, getPublicChartData, chatPublicDashboard } from '../lib/api'
import type { Dashboard, ChatMessage } from '../lib/types'

export function PublicDashboardPage() {
  const { slug } = useParams<{ slug: string }>()
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [containerWidth, setContainerWidth] = useState(900)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!slug) return
    getPublicDashboard(slug)
      .then(setDashboard)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [slug])

  useEffect(() => {
    if (!containerRef.current) return
    const obs = new ResizeObserver((entries) => {
      setContainerWidth(entries[0].contentRect.width)
    })
    obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [])

  const fetchData = useCallback(
    async (_chartId: string, params: Record<string, string>) => {
      if (!slug) return []
      return getPublicChartData(slug, params)
    },
    [slug]
  )

  async function handleChat(message: string, history: ChatMessage[]) {
    if (!slug) return { message: '' }
    const res = await chatPublicDashboard(slug, message, history)
    return { message: res.message }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-0 flex items-center justify-center">
        <Spinner className="w-8 h-8" />
      </div>
    )
  }

  if (notFound || !dashboard) {
    return (
      <div className="min-h-screen bg-surface-0 flex flex-col items-center justify-center text-center px-4">
        <BarChart2 size={48} className="text-violet-500/30 mb-4" />
        <h1 className="text-xl font-semibold text-white mb-2">Dashboard not found</h1>
        <p className="text-sm text-slate-400 mb-6">This dashboard may have been unpublished or the link is incorrect.</p>
        <Link to="/" className="btn-primary text-sm">Go to DashAI</Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-0 flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-6 h-14 flex items-center gap-4 flex-shrink-0">
        <Link to="/" className="flex items-center gap-2 mr-2">
          <div className="w-6 h-6 rounded-md bg-violet-600 flex items-center justify-center">
            <BarChart2 size={12} className="text-white" />
          </div>
          <span className="text-xs font-medium text-slate-400">DashAI</span>
        </Link>
        <div className="h-4 w-px bg-border" />
        <h1 className="text-sm font-semibold text-white truncate">{dashboard.title}</h1>
        {dashboard.description && (
          <>
            <div className="h-4 w-px bg-border hidden sm:block" />
            <p className="text-xs text-slate-400 truncate hidden sm:block">{dashboard.description}</p>
          </>
        )}
      </header>

      {/* Grid */}
      <div ref={containerRef} className="flex-1 p-4 overflow-auto">
        {dashboard.charts.length === 0 ? (
          <div className="flex items-center justify-center py-20 text-slate-500 text-sm">
            No charts in this dashboard.
          </div>
        ) : (
          <DashboardGrid
            charts={dashboard.charts}
            layout={dashboard.layout}
            fetchData={fetchData}
            readonly
            containerWidth={containerWidth}
          />
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-border py-3 px-6 flex items-center justify-between flex-shrink-0">
        <p className="text-xs text-slate-500">
          Built with{' '}
          <Link to="/" className="text-violet-400 hover:text-violet-300">DashAI</Link>
        </p>
        <Link to="/signup" className="text-xs text-violet-400 hover:text-violet-300">
          Create your own dashboard →
        </Link>
      </footer>

      {/* Chat */}
      <ChatWidget
        onSend={handleChat}
        title="Ask about this data"
        placeholder="Ask a question about this dashboard…"
      />
    </div>
  )
}

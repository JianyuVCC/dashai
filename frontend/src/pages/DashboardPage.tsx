import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { Globe, Lock, RotateCcw, Pencil, Check, X as XIcon } from 'lucide-react'
import { Layout, PageHeader } from '../components/Layout'
import { DashboardGrid } from '../components/DashboardGrid'
import { ChatWidget } from '../components/ChatWidget'
import { PublishModal } from '../components/PublishModal'
import { Spinner } from '../components/ui/Spinner'
import { getDashboard, getChartData, chatWithDashboard } from '../lib/api'
import type { Dashboard, ChatMessage, LayoutItem } from '../lib/types'

export function DashboardPage() {
  const { id } = useParams<{ id: string }>()
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [publishModal, setPublishModal] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState('')
  const [containerWidth, setContainerWidth] = useState(900)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!id) return
    getDashboard(id)
      .then((d) => {
        setDashboard(d)
        setTitleValue(d.title)
      })
      .finally(() => setLoading(false))
  }, [id])

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
      if (!dashboard) return []
      return getChartData(dashboard.dataset_id, params)
    },
    [dashboard]
  )

  async function handleChat(message: string, history: ChatMessage[]) {
    if (!id) return { message: '' }
    const res = await chatWithDashboard(id, message, history)
    if (res.dashboard) setDashboard(res.dashboard)
    return { message: res.message }
  }

  function handleLayoutChange(newLayout: LayoutItem[]) {
    if (!dashboard) return
    setDashboard({ ...dashboard, layout: newLayout })
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <Spinner className="w-8 h-8" />
        </div>
      </Layout>
    )
  }

  if (!dashboard) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen text-slate-400">
          Dashboard not found.
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <PageHeader
        back={{ to: '/app', label: 'Dashboards' }}
        title={
          editingTitle ? '' : dashboard.title
        }
        actions={
          <div className="flex items-center gap-2">
            {editingTitle ? (
              <>
                <input
                  className="input text-sm py-1.5 h-8 w-48"
                  value={titleValue}
                  onChange={(e) => setTitleValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { setDashboard({ ...dashboard, title: titleValue }); setEditingTitle(false) }
                    if (e.key === 'Escape') { setTitleValue(dashboard.title); setEditingTitle(false) }
                  }}
                  autoFocus
                />
                <button onClick={() => { setDashboard({ ...dashboard, title: titleValue }); setEditingTitle(false) }} className="btn-ghost p-1.5">
                  <Check size={14} className="text-emerald-400" />
                </button>
                <button onClick={() => { setTitleValue(dashboard.title); setEditingTitle(false) }} className="btn-ghost p-1.5">
                  <XIcon size={14} />
                </button>
              </>
            ) : (
              <button onClick={() => setEditingTitle(true)} className="btn-ghost p-1.5" title="Edit title">
                <Pencil size={14} />
              </button>
            )}

            <button
              onClick={() => window.location.reload()}
              className="btn-ghost p-1.5"
              title="Refresh charts"
            >
              <RotateCcw size={14} />
            </button>

            <button
              onClick={() => setPublishModal(true)}
              className={`text-sm flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors ${
                dashboard.is_public
                  ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                  : 'btn-primary'
              }`}
            >
              {dashboard.is_public ? (
                <><Globe size={13} /> Published</>
              ) : (
                <><Lock size={13} /> Publish</>
              )}
            </button>
          </div>
        }
      />

      <div ref={containerRef} className="p-4 overflow-auto">
        {dashboard.charts.length === 0 ? (
          <div className="flex items-center justify-center py-20 text-slate-500 text-sm">
            No charts in this dashboard.
          </div>
        ) : (
          <DashboardGrid
            charts={dashboard.charts}
            layout={dashboard.layout}
            fetchData={fetchData}
            onLayoutChange={handleLayoutChange}
            containerWidth={containerWidth}
          />
        )}
      </div>

      <ChatWidget
        onSend={handleChat}
        title="Ask about this dashboard"
        placeholder="Ask anything about your data…"
      />

      <PublishModal
        open={publishModal}
        onClose={() => setPublishModal(false)}
        dashboard={dashboard}
        onUpdate={setDashboard}
      />
    </Layout>
  )
}

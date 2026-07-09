import { useState } from 'react'
import { Globe, Lock, Copy, Check, ExternalLink } from 'lucide-react'
import { Modal } from './ui/Modal'
import { Spinner } from './ui/Spinner'
import { publishDashboard, unpublishDashboard } from '../lib/api'
import { getPublicUrl } from '../lib/utils'
import type { Dashboard } from '../lib/types'

interface Props {
  open: boolean
  onClose: () => void
  dashboard: Dashboard
  onUpdate: (updated: Dashboard) => void
}

export function PublishModal({ open, onClose, dashboard, onUpdate }: Props) {
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const publicUrl = dashboard.public_slug ? getPublicUrl(dashboard.public_slug) : null

  async function handlePublish() {
    setLoading(true)
    try {
      const res = await publishDashboard(dashboard.id)
      onUpdate({ ...dashboard, is_public: res.is_public, public_slug: res.public_slug ?? undefined })
    } finally {
      setLoading(false)
    }
  }

  async function handleUnpublish() {
    setLoading(true)
    try {
      await unpublishDashboard(dashboard.id)
      onUpdate({ ...dashboard, is_public: false })
    } finally {
      setLoading(false)
    }
  }

  function handleCopy() {
    if (!publicUrl) return
    navigator.clipboard.writeText(publicUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Modal open={open} onClose={onClose} title="Publish Dashboard" size="sm">
      <div className="space-y-4">
        {dashboard.is_public && publicUrl ? (
          <>
            <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-3">
              <Globe size={18} className="text-emerald-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-emerald-400">Published</p>
                <p className="text-xs text-slate-400">Anyone with the link can view this dashboard</p>
              </div>
            </div>

            <div>
              <p className="text-xs text-slate-500 mb-1.5">Public URL</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-surface-3 border border-border rounded-lg px-3 py-2 text-slate-300 truncate">
                  {publicUrl}
                </code>
                <button onClick={handleCopy} className="btn-ghost p-2 flex-shrink-0" title="Copy link">
                  {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                </button>
                <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost p-2 flex-shrink-0" title="Open">
                  <ExternalLink size={16} />
                </a>
              </div>
            </div>

            <div className="flex justify-between items-center pt-1">
              <button
                onClick={handleUnpublish}
                className="btn-danger text-sm flex items-center gap-2"
                disabled={loading}
              >
                {loading ? <Spinner className="w-4 h-4" /> : <Lock size={14} />}
                Unpublish
              </button>
              <button onClick={onClose} className="btn-ghost text-sm">Done</button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 bg-surface-3 rounded-lg px-4 py-3">
              <Lock size={18} className="text-slate-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-white">Private</p>
                <p className="text-xs text-slate-400">Only you can see this dashboard</p>
              </div>
            </div>

            <p className="text-sm text-slate-400">
              Publishing will create a public link anyone can use to view this dashboard and chat with your data.
            </p>

            <div className="flex justify-end gap-2 pt-1">
              <button onClick={onClose} className="btn-ghost text-sm">Cancel</button>
              <button
                onClick={handlePublish}
                className="btn-primary text-sm flex items-center gap-2"
                disabled={loading}
              >
                {loading ? <Spinner className="w-4 h-4" /> : <Globe size={14} />}
                Publish
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}

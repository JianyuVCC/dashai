import { useState } from 'react'
import { Modal } from './ui/Modal'
import { Spinner } from './ui/Spinner'
import { AlertCircle } from 'lucide-react'
import { connectDatabase } from '../lib/api'
import type { DatasetMeta } from '../lib/types'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: (dataset: DatasetMeta) => void
}

export function DBConnectModal({ open, onClose, onSuccess }: Props) {
  const [dialect, setDialect] = useState<'postgresql' | 'mysql'>('postgresql')
  const [uri, setUri] = useState('')
  const [query, setQuery] = useState('SELECT * FROM your_table LIMIT 10000')
  const [name, setName] = useState('')
  const [save, setSave] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const dataset = await connectDatabase({
        dialect,
        connection_uri: uri,
        query,
        name: name || undefined,
        save_connection: save,
      })
      onSuccess(dataset)
      onClose()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Connection failed'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Connect Database" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Database type</label>
          <div className="flex gap-2">
            {(['postgresql', 'mysql'] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDialect(d)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  dialect === d
                    ? 'bg-violet-600 text-white'
                    : 'bg-surface-3 text-slate-400 hover:text-white'
                }`}
              >
                {d === 'postgresql' ? 'PostgreSQL' : 'MySQL'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Connection URI</label>
          <input
            className="input font-mono text-sm"
            value={uri}
            onChange={(e) => setUri(e.target.value)}
            placeholder={
              dialect === 'postgresql'
                ? 'postgresql://user:pass@host:5432/dbname'
                : 'mysql://user:pass@host:3306/dbname'
            }
            required
          />
        </div>

        <div>
          <label className="label">SQL Query (SELECT only)</label>
          <textarea
            className="input font-mono text-sm resize-none"
            rows={4}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            required
          />
          <p className="text-xs text-slate-500 mt-1">Only SELECT / WITH … SELECT queries are allowed.</p>
        </div>

        <div>
          <label className="label">Dataset name (optional)</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My query"
          />
        </div>

        <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-400">
          <input
            type="checkbox"
            checked={save}
            onChange={(e) => setSave(e.target.checked)}
            className="rounded border-border bg-surface-3 text-violet-600 focus:ring-violet-500"
          />
          Save connection for later (credentials stored encrypted)
        </label>

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            <AlertCircle size={16} className="flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-ghost text-sm">
            Cancel
          </button>
          <button type="submit" className="btn-primary text-sm flex items-center gap-2" disabled={loading}>
            {loading && <Spinner className="w-4 h-4" />}
            {loading ? 'Connecting…' : 'Connect & Import'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

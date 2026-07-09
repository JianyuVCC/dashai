import { useEffect, useState } from 'react'
import { Database, Upload, Trash2, RefreshCw } from 'lucide-react'
import { Layout, PageHeader } from '../components/Layout'
import { FileUpload } from '../components/FileUpload'
import { DBConnectModal } from '../components/DBConnectModal'
import { Modal } from '../components/ui/Modal'
import { Spinner } from '../components/ui/Spinner'
import { listDatasets, deleteDataset, listSavedConnections } from '../lib/api'
import { formatDate } from '../lib/utils'
import type { DatasetMeta, SavedConnection } from '../lib/types'

export function DataPage() {
  const [datasets, setDatasets] = useState<DatasetMeta[]>([])
  const [connections, setConnections] = useState<SavedConnection[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadModal, setUploadModal] = useState(false)
  const [dbModal, setDbModal] = useState(false)

  useEffect(() => {
    Promise.all([listDatasets(), listSavedConnections()])
      .then(([ds, cs]) => { setDatasets(ds); setConnections(cs) })
      .finally(() => setLoading(false))
  }, [])

  function handleUploaded(ds: DatasetMeta) {
    setDatasets((prev) => [ds, ...prev])
    setUploadModal(false)
    setDbModal(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this dataset and its stored file?')) return
    await deleteDataset(id)
    setDatasets((prev) => prev.filter((d) => d.id !== id))
  }

  return (
    <Layout>
      <PageHeader
        title="Datasets"
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => setDbModal(true)} className="btn-ghost text-sm flex items-center gap-1.5">
              <Database size={14} /> Connect DB
            </button>
            <button onClick={() => setUploadModal(true)} className="btn-primary text-sm flex items-center gap-1.5">
              <Upload size={14} /> Upload
            </button>
          </div>
        }
      />

      <div className="p-6 max-w-4xl space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner className="w-6 h-6" />
          </div>
        ) : datasets.length === 0 ? (
          <div className="card p-10 text-center">
            <Database size={40} className="text-slate-600 mx-auto mb-3" />
            <p className="text-white font-medium mb-1">No datasets yet</p>
            <p className="text-sm text-slate-500 mb-4">Upload a file or connect a database to get started.</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setUploadModal(true)} className="btn-primary text-sm flex items-center gap-2">
                <Upload size={14} /> Upload file
              </button>
              <button onClick={() => setDbModal(true)} className="btn-ghost text-sm flex items-center gap-2">
                <Database size={14} /> Connect DB
              </button>
            </div>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-1">
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Source</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Rows</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Cols</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Uploaded</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {datasets.map((ds) => (
                  <tr key={ds.id} className="border-b border-border/50 hover:bg-surface-3 transition-colors">
                    <td className="px-4 py-3 text-white font-medium max-w-[220px]">
                      <span className="truncate block">{ds.filename}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        ds.source_type === 'database'
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'bg-violet-500/20 text-violet-400'
                      }`}>
                        {ds.source_type === 'database' ? 'database' : 'file'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{ds.rows.toLocaleString()}</td>
                    <td className="px-4 py-3 text-slate-400">{ds.columns.length}</td>
                    <td className="px-4 py-3 text-slate-400">{formatDate(ds.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        {ds.source_type === 'database' && (
                          <button className="text-slate-500 hover:text-blue-400 p-1 transition-colors" title="Refresh from DB">
                            <RefreshCw size={13} />
                          </button>
                        )}
                        <button onClick={() => handleDelete(ds.id)} className="text-slate-500 hover:text-red-400 p-1 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {connections.length > 0 && (
          <div>
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Saved Connections ({connections.length})
            </h2>
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-1">
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Name</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Type</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Added</th>
                  </tr>
                </thead>
                <tbody>
                  {connections.map((c) => (
                    <tr key={c.id} className="border-b border-border/50">
                      <td className="px-4 py-3 text-white">{c.name}</td>
                      <td className="px-4 py-3 text-slate-400 capitalize">{c.dialect}</td>
                      <td className="px-4 py-3 text-slate-400">{formatDate(c.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <Modal open={uploadModal} onClose={() => setUploadModal(false)} title="Upload Dataset">
        <FileUpload onSuccess={handleUploaded} />
      </Modal>

      <DBConnectModal open={dbModal} onClose={() => setDbModal(false)} onSuccess={handleUploaded} />
    </Layout>
  )
}

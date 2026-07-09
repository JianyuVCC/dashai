import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart2, Upload, Database, Trash2, Plus, ArrowRight, Globe } from 'lucide-react'
import { Layout, PageHeader } from '../components/Layout'
import { FileUpload } from '../components/FileUpload'
import { DBConnectModal } from '../components/DBConnectModal'
import { Modal } from '../components/ui/Modal'
import { Spinner } from '../components/ui/Spinner'
import { listDashboards, listDatasets, createDashboard, deleteDashboard, deleteDataset } from '../lib/api'
import { formatDate } from '../lib/utils'
import type { Dashboard, DatasetMeta } from '../lib/types'

export function AppHome() {
  const [dashboards, setDashboards] = useState<Dashboard[]>([])
  const [datasets, setDatasets] = useState<DatasetMeta[]>([])
  const [loadingDash, setLoadingDash] = useState(true)
  const [uploadModal, setUploadModal] = useState(false)
  const [dbModal, setDbModal] = useState(false)
  const [generating, setGenerating] = useState<string | null>(null)
  const [promptModal, setPromptModal] = useState<{ datasetId: string } | null>(null)
  const [prompt, setPrompt] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([listDashboards(), listDatasets()])
      .then(([d, ds]) => { setDashboards(d); setDatasets(ds) })
      .finally(() => setLoadingDash(false))
  }, [])

  function handleDatasetUploaded(ds: DatasetMeta) {
    setDatasets((prev) => [ds, ...prev])
    setUploadModal(false)
    setPromptModal({ datasetId: ds.id })
  }

  async function handleGenerate() {
    if (!promptModal) return
    setGenerating(promptModal.datasetId)
    setPromptModal(null)
    try {
      const d = await createDashboard(promptModal.datasetId, prompt)
      setDashboards((prev) => [d, ...prev])
      navigate(`/app/dashboard/${d.id}`)
    } finally {
      setGenerating(null)
      setPrompt('')
    }
  }

  async function handleDeleteDash(id: string) {
    if (!confirm('Delete this dashboard?')) return
    await deleteDashboard(id)
    setDashboards((prev) => prev.filter((d) => d.id !== id))
  }

  async function handleDeleteDataset(id: string) {
    if (!confirm('Delete this dataset?')) return
    await deleteDataset(id)
    setDatasets((prev) => prev.filter((d) => d.id !== id))
  }

  return (
    <Layout onUpload={() => setUploadModal(true)}>
      <PageHeader
        title="Dashboards"
        actions={
          <button onClick={() => setUploadModal(true)} className="btn-primary text-sm flex items-center gap-2">
            <Plus size={15} /> New Dashboard
          </button>
        }
      />

      <div className="p-6 space-y-8 max-w-5xl">
        {/* Dashboards */}
        <section>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            My Dashboards ({dashboards.length})
          </h2>

          {loadingDash ? (
            <div className="flex items-center justify-center py-12">
              <Spinner className="w-6 h-6" />
            </div>
          ) : dashboards.length === 0 ? (
            <div className="card p-10 text-center">
              <BarChart2 size={40} className="text-violet-500/40 mx-auto mb-3" />
              <p className="text-white font-medium mb-1">No dashboards yet</p>
              <p className="text-sm text-slate-500 mb-4">Upload data and let AI build your first dashboard.</p>
              <button onClick={() => setUploadModal(true)} className="btn-primary text-sm mx-auto flex items-center gap-2 w-fit">
                <Upload size={14} /> Upload data
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {dashboards.map((d) => (
                <div
                  key={d.id}
                  className="card p-4 hover:border-violet-600/50 transition-colors cursor-pointer group"
                  onClick={() => navigate(`/app/dashboard/${d.id}`)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-9 h-9 rounded-lg bg-violet-600/20 flex items-center justify-center">
                      <BarChart2 size={18} className="text-violet-400" />
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {d.is_public && <Globe size={13} className="text-emerald-400" title="Published" />}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteDash(d.id) }}
                        className="text-slate-500 hover:text-red-400 p-1 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <h3 className="text-sm font-medium text-white mb-1 truncate">{d.title}</h3>
                  {d.description && (
                    <p className="text-xs text-slate-500 line-clamp-2 mb-2">{d.description}</p>
                  )}
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-500">{formatDate(d.created_at)}</p>
                    <ArrowRight size={14} className="text-slate-600 group-hover:text-violet-400 transition-colors" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Datasets */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Datasets ({datasets.length})
            </h2>
            <div className="flex gap-2">
              <button onClick={() => setDbModal(true)} className="btn-ghost text-xs flex items-center gap-1.5">
                <Database size={13} /> Connect DB
              </button>
              <button onClick={() => setUploadModal(true)} className="btn-ghost text-xs flex items-center gap-1.5">
                <Upload size={13} /> Upload file
              </button>
            </div>
          </div>

          {datasets.length === 0 ? (
            <div className="card p-6 text-center">
              <p className="text-sm text-slate-500">No datasets yet.</p>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500">Name</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500">Rows</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500">Columns</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500">Uploaded</th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {datasets.map((ds) => (
                    <tr key={ds.id} className="border-b border-border/50 hover:bg-surface-3 transition-colors">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          {ds.source_type === 'database' ? (
                            <Database size={14} className="text-blue-400 flex-shrink-0" />
                          ) : (
                            <BarChart2 size={14} className="text-violet-400 flex-shrink-0" />
                          )}
                          <span className="text-white truncate max-w-[200px]">{ds.filename}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-slate-400">{ds.rows.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-slate-400">{ds.columns.length}</td>
                      <td className="px-4 py-2.5 text-slate-400">{formatDate(ds.created_at)}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2 justify-end">
                          {generating === ds.id ? (
                            <Spinner className="w-4 h-4" />
                          ) : (
                            <button
                              onClick={() => setPromptModal({ datasetId: ds.id })}
                              className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
                            >
                              Generate dashboard
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteDataset(ds.id)}
                            className="text-slate-500 hover:text-red-400 p-1 transition-colors"
                          >
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
        </section>
      </div>

      {/* Upload modal */}
      <Modal open={uploadModal} onClose={() => setUploadModal(false)} title="Upload Dataset">
        <div className="space-y-4">
          <FileUpload onSuccess={handleDatasetUploaded} />
          <div className="text-center">
            <button
              onClick={() => { setUploadModal(false); setDbModal(true) }}
              className="text-sm text-violet-400 hover:text-violet-300"
            >
              Or connect a live database →
            </button>
          </div>
        </div>
      </Modal>

      {/* DB modal */}
      <DBConnectModal open={dbModal} onClose={() => setDbModal(false)} onSuccess={handleDatasetUploaded} />

      {/* Prompt modal */}
      <Modal
        open={!!promptModal}
        onClose={() => { setPromptModal(null); setPrompt('') }}
        title="Generate Dashboard"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            Claude will analyze your data and create charts automatically. Optionally, describe what you want to focus on.
          </p>
          <div>
            <label className="label">Focus (optional)</label>
            <textarea
              className="input resize-none"
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Focus on revenue trends and top performing regions"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => { setPromptModal(null); setPrompt('') }} className="btn-ghost text-sm">Cancel</button>
            <button onClick={handleGenerate} className="btn-primary text-sm flex items-center gap-2" disabled={!!generating}>
              {generating && <Spinner className="w-4 h-4" />}
              Generate Dashboard
            </button>
          </div>
        </div>
      </Modal>
    </Layout>
  )
}

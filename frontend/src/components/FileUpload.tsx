import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react'
import { cn } from '../lib/utils'
import { uploadDataset } from '../lib/api'
import { Spinner } from './ui/Spinner'
import type { DatasetMeta } from '../lib/types'

const ACCEPT = {
  'text/csv': ['.csv', '.tsv'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/json': ['.json'],
  'application/octet-stream': ['.parquet', '.db', '.sqlite', '.sqlite3'],
}

interface Props {
  onSuccess: (dataset: DatasetMeta) => void
}

export function FileUpload({ onSuccess }: Props) {
  const [status, setStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')
  const [filename, setFilename] = useState('')

  const onDrop = useCallback(
    async (accepted: File[]) => {
      const file = accepted[0]
      if (!file) return
      setFilename(file.name)
      setStatus('uploading')
      setError('')
      try {
        const dataset = await uploadDataset(file)
        setStatus('done')
        onSuccess(dataset)
      } catch (e: unknown) {
        const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Upload failed'
        setError(msg)
        setStatus('error')
      }
    },
    [onSuccess]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPT,
    maxFiles: 1,
    disabled: status === 'uploading',
  })

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all',
          isDragActive
            ? 'border-violet-500 bg-violet-500/10'
            : 'border-border hover:border-violet-600/50 hover:bg-surface-3',
          status === 'uploading' && 'pointer-events-none opacity-60'
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-3">
          {status === 'uploading' ? (
            <>
              <Spinner className="w-8 h-8" />
              <p className="text-sm text-slate-400">Uploading {filename}…</p>
            </>
          ) : status === 'done' ? (
            <>
              <CheckCircle className="w-10 h-10 text-emerald-500" />
              <p className="text-sm text-emerald-400">Uploaded {filename}</p>
            </>
          ) : (
            <>
              <div className="w-12 h-12 rounded-full bg-violet-600/20 flex items-center justify-center">
                <Upload className="text-violet-400 w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">
                  {isDragActive ? 'Drop it here' : 'Drag & drop your file'}
                </p>
                <p className="text-xs text-slate-500 mt-1">or click to browse</p>
              </div>
              <div className="flex flex-wrap gap-1 justify-center mt-1">
                {['CSV', 'XLSX', 'XLS', 'JSON', 'Parquet', 'SQLite'].map((f) => (
                  <span key={f} className="text-xs bg-surface-3 text-slate-400 px-2 py-0.5 rounded-full">
                    {f}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {status === 'error' && (
        <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          <AlertCircle size={16} className="flex-shrink-0" />
          {error}
        </div>
      )}
    </div>
  )
}

import axios from 'axios'
import { supabase } from './supabase'
import type { Dashboard, DatasetMeta, ChatMessage, PublishResponse, SavedConnection } from './types'

const BASE = (import.meta.env.VITE_API_URL as string) ?? ''

const http = axios.create({ baseURL: BASE })

http.interceptors.request.use(async (config) => {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ── Datasets ─────────────────────────────────────────────────────────────────

export async function uploadDataset(file: File): Promise<DatasetMeta> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await http.post<DatasetMeta>('/datasets', form)
  return data
}

export async function connectDatabase(payload: {
  dialect: string
  connection_uri: string
  query: string
  name?: string
  save_connection?: boolean
}): Promise<DatasetMeta> {
  const { data } = await http.post<DatasetMeta>('/datasets/connect', payload)
  return data
}

export async function listDatasets(): Promise<DatasetMeta[]> {
  const { data } = await http.get<DatasetMeta[]>('/datasets')
  return data
}

export async function deleteDataset(id: string): Promise<void> {
  await http.delete(`/datasets/${id}`)
}

export async function listSavedConnections(): Promise<SavedConnection[]> {
  const { data } = await http.get<SavedConnection[]>('/datasets/connections/saved')
  return data
}

// ── Dashboards ────────────────────────────────────────────────────────────────

export async function createDashboard(dataset_id: string, user_prompt = ''): Promise<Dashboard> {
  const { data } = await http.post<Dashboard>('/dashboards', { dataset_id, user_prompt })
  return data
}

export async function listDashboards(): Promise<Dashboard[]> {
  const { data } = await http.get<Dashboard[]>('/dashboards')
  return data
}

export async function getDashboard(id: string): Promise<Dashboard> {
  const { data } = await http.get<Dashboard>(`/dashboards/${id}`)
  return data
}

export async function deleteDashboard(id: string): Promise<void> {
  await http.delete(`/dashboards/${id}`)
}

export async function publishDashboard(id: string): Promise<PublishResponse> {
  const { data } = await http.post<PublishResponse>(`/dashboards/${id}/publish`)
  return data
}

export async function unpublishDashboard(id: string): Promise<PublishResponse> {
  const { data } = await http.post<PublishResponse>(`/dashboards/${id}/unpublish`)
  return data
}

export async function chatWithDashboard(
  id: string,
  message: string,
  history: ChatMessage[]
): Promise<{ message: string; dashboard: Dashboard | null }> {
  const { data } = await http.post(`/dashboards/${id}/chat`, { message, history })
  return data
}

// ── Chart Data ────────────────────────────────────────────────────────────────

export interface ChartDataParams {
  x_column?: string
  y_column?: string
  y_columns?: string
  aggregation?: string
  limit?: number
}

export async function getChartData(
  dataset_id: string,
  params: ChartDataParams
): Promise<Record<string, unknown>[]> {
  const { data } = await http.get<{ data: Record<string, unknown>[] }>(
    `/chart-data/${dataset_id}`,
    { params }
  )
  return data.data
}

// ── Public Endpoints (no auth) ────────────────────────────────────────────────

export async function getPublicDashboard(slug: string): Promise<Dashboard> {
  const { data } = await axios.get<Dashboard>(`${BASE}/public/dashboards/${slug}`)
  return data
}

export async function getPublicChartData(
  slug: string,
  params: ChartDataParams
): Promise<Record<string, unknown>[]> {
  const { data } = await axios.get<{ data: Record<string, unknown>[] }>(
    `${BASE}/public/dashboards/${slug}/chart-data`,
    { params }
  )
  return data.data
}

export async function chatPublicDashboard(
  slug: string,
  message: string,
  history: ChatMessage[]
): Promise<{ message: string }> {
  const { data } = await axios.post(`${BASE}/public/dashboards/${slug}/chat`, {
    message,
    history,
  })
  return data
}

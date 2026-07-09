export interface DatasetMeta {
  id: string
  filename: string
  source_type: 'file' | 'database'
  rows: number
  columns: string[]
  dtypes: Record<string, string>
  preview: Record<string, unknown>[]
  created_at: string
}

export type ChartType = 'bar' | 'line' | 'pie' | 'scatter' | 'area' | 'table'
export type Aggregation = 'sum' | 'count' | 'mean' | 'max' | 'min' | 'median'

export interface ChartConfig {
  id: string
  type: ChartType
  title: string
  x_column?: string
  y_column?: string
  y_columns?: string[]
  color_column?: string
  aggregation?: Aggregation
  filters?: Record<string, unknown>
  options?: Record<string, unknown>
}

export interface LayoutItem {
  i: string
  x: number
  y: number
  w: number
  h: number
}

export interface Dashboard {
  id: string
  title: string
  dataset_id: string
  charts: ChartConfig[]
  layout: LayoutItem[]
  is_public: boolean
  public_slug?: string
  created_at: string
  updated_at: string
  description: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface SavedConnection {
  id: string
  name: string
  dialect: string
  created_at: string
}

export interface PublishResponse {
  is_public: boolean
  public_slug?: string
}

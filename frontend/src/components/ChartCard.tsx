import { useEffect, useState } from 'react'
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'
import { Spinner } from './ui/Spinner'
import { AlertCircle } from 'lucide-react'
import { CHART_COLORS } from '../lib/utils'
import type { ChartConfig } from '../lib/types'

interface Props {
  chart: ChartConfig
  fetchData: (params: Record<string, string>) => Promise<Record<string, unknown>[]>
}

const tickStyle = { fill: '#94a3b8', fontSize: 11 }
const gridStyle = { stroke: '#2a2a42', strokeDasharray: '3 3' }
const tooltipStyle = {
  contentStyle: { background: '#1e1e30', border: '1px solid #2a2a42', borderRadius: 8, fontSize: 12 },
  labelStyle: { color: '#e2e8f0' },
  itemStyle: { color: '#a78bfa' },
}

export function ChartCard({ chart, fetchData }: Props) {
  const [data, setData] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const params: Record<string, string> = {}
    if (chart.x_column) params.x_column = chart.x_column
    if (chart.y_column) params.y_column = chart.y_column
    if (chart.y_columns?.length) params.y_columns = chart.y_columns.join(',')
    if (chart.aggregation) params.aggregation = chart.aggregation

    setLoading(true)
    fetchData(params)
      .then(setData)
      .catch(() => setError('Failed to load chart data'))
      .finally(() => setLoading(false))
  }, [chart, fetchData])

  const yKeys = chart.y_columns?.length ? chart.y_columns : chart.y_column ? [chart.y_column] : []

  function renderChart() {
    switch (chart.type) {
      case 'bar':
        return (
          <BarChart data={data}>
            <CartesianGrid {...gridStyle} />
            <XAxis dataKey={chart.x_column} tick={tickStyle} />
            <YAxis tick={tickStyle} width={45} />
            <Tooltip {...tooltipStyle} />
            {yKeys.length > 1 && <Legend />}
            {yKeys.map((k, i) => (
              <Bar key={k} dataKey={k} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[3, 3, 0, 0]} maxBarSize={48} />
            ))}
          </BarChart>
        )

      case 'line':
        return (
          <LineChart data={data}>
            <CartesianGrid {...gridStyle} />
            <XAxis dataKey={chart.x_column} tick={tickStyle} />
            <YAxis tick={tickStyle} width={45} />
            <Tooltip {...tooltipStyle} />
            {yKeys.length > 1 && <Legend />}
            {yKeys.map((k, i) => (
              <Line key={k} type="monotone" dataKey={k} stroke={CHART_COLORS[i % CHART_COLORS.length]} dot={false} strokeWidth={2} />
            ))}
          </LineChart>
        )

      case 'area':
        return (
          <AreaChart data={data}>
            <CartesianGrid {...gridStyle} />
            <XAxis dataKey={chart.x_column} tick={tickStyle} />
            <YAxis tick={tickStyle} width={45} />
            <Tooltip {...tooltipStyle} />
            {yKeys.length > 1 && <Legend />}
            {yKeys.map((k, i) => (
              <Area key={k} type="monotone" dataKey={k} stroke={CHART_COLORS[i % CHART_COLORS.length]}
                fill={CHART_COLORS[i % CHART_COLORS.length]} fillOpacity={0.15} strokeWidth={2} dot={false} />
            ))}
          </AreaChart>
        )

      case 'pie':
        return (
          <PieChart>
            <Pie
              data={data}
              dataKey={chart.y_column ?? yKeys[0] ?? 'value'}
              nameKey={chart.x_column ?? 'name'}
              outerRadius="70%"
              innerRadius="40%"
              paddingAngle={2}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              labelLine={false}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip {...tooltipStyle} />
          </PieChart>
        )

      case 'scatter':
        return (
          <ScatterChart>
            <CartesianGrid {...gridStyle} />
            <XAxis dataKey={chart.x_column} tick={tickStyle} name={chart.x_column} />
            <YAxis dataKey={chart.y_column} tick={tickStyle} name={chart.y_column} width={45} />
            <Tooltip {...tooltipStyle} cursor={{ strokeDasharray: '3 3' }} />
            <Scatter data={data} fill={CHART_COLORS[0]} />
          </ScatterChart>
        )

      case 'table':
        return (
          <div className="overflow-auto h-full">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-surface-2">
                <tr>
                  {data[0] && Object.keys(data[0]).map((col) => (
                    <th key={col} className="text-left px-3 py-2 text-slate-400 font-medium border-b border-border whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-surface-3 transition-colors">
                    {Object.values(row).map((val, j) => (
                      <td key={j} className="px-3 py-1.5 text-slate-300 whitespace-nowrap">
                        {String(val ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="card h-full flex flex-col overflow-hidden">
      <div className="px-4 pt-3 pb-2 border-b border-border flex-shrink-0">
        <h3 className="text-sm font-medium text-white truncate">{chart.title}</h3>
      </div>
      <div className="flex-1 min-h-0 p-3">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <Spinner className="w-6 h-6" />
          </div>
        ) : error ? (
          <div className="h-full flex items-center justify-center text-red-400 text-sm gap-2">
            <AlertCircle size={16} /> {error}
          </div>
        ) : data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-500 text-sm">No data</div>
        ) : chart.type === 'table' ? (
          renderChart()
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {renderChart() as React.ReactElement}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

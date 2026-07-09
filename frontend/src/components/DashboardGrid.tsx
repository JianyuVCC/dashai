import { useMemo } from 'react'
import GridLayout from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { ChartCard } from './ChartCard'
import type { ChartConfig, LayoutItem } from '../lib/types'

interface Props {
  charts: ChartConfig[]
  layout: LayoutItem[]
  fetchData: (chartId: string, params: Record<string, string>) => Promise<Record<string, unknown>[]>
  onLayoutChange?: (layout: LayoutItem[]) => void
  readonly?: boolean
  containerWidth: number
}

export function DashboardGrid({ charts, layout, fetchData, onLayoutChange, readonly, containerWidth }: Props) {
  const chartMap = useMemo(() => new Map(charts.map((c) => [c.id, c])), [charts])

  const gridLayout = layout.map((l) => ({
    ...l,
    minW: 2,
    minH: 3,
    isDraggable: !readonly,
    isResizable: !readonly,
  }))

  function handleLayoutChange(newLayout: GridLayout.Layout[]) {
    if (readonly || !onLayoutChange) return
    onLayoutChange(
      newLayout.map(({ i, x, y, w, h }) => ({ i, x, y, w, h }))
    )
  }

  const cols = 12
  const rowHeight = 60

  return (
    <GridLayout
      className="layout"
      layout={gridLayout}
      cols={cols}
      rowHeight={rowHeight}
      width={containerWidth}
      onLayoutChange={handleLayoutChange}
      draggableHandle=".drag-handle"
      margin={[12, 12]}
    >
      {layout.map(({ i }) => {
        const chart = chartMap.get(i)
        if (!chart) return null
        return (
          <div key={i} className="group relative">
            {!readonly && (
              <div className="drag-handle absolute top-0 left-0 right-0 h-10 z-10 cursor-grab active:cursor-grabbing" />
            )}
            <ChartCard
              chart={chart}
              fetchData={(params) => fetchData(i, params)}
            />
          </div>
        )
      })}
    </GridLayout>
  )
}

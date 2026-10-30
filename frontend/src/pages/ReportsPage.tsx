import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { getDailyClosing, getInventoryValue, getLowStock, getSalesRange, getTopProducts } from '@/api/reports'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { Loading } from '@/components/ui/Loading'
import { Table } from '@/components/ui/Table'
import { Button } from '@/components/ui/Button'
import { DailyClosingModal } from '@/components/DailyClosingModal'
import { downloadCsv } from '@/lib/csv'
import { formatCurrencyCOP, formatNumber, toISODate } from '@/lib/format'

const today = new Date()

export const ReportsPage = () => {
  const [dateFrom, setDateFrom] = useState(toISODate(new Date(today.getFullYear(), today.getMonth(), 1)))
  const [dateTo, setDateTo] = useState(toISODate(today))
  const [closingOpen, setClosingOpen] = useState(false)

  const inventoryValueQuery = useQuery({ queryKey: ['report', 'inventory-value'], queryFn: getInventoryValue })
  const lowStockQuery = useQuery({ queryKey: ['report', 'low-stock'], queryFn: () => getLowStock() })
  const topProductsQuery = useQuery({
    queryKey: ['report', 'top-products', dateFrom, dateTo],
    queryFn: () => getTopProducts(dateFrom, dateTo, 20),
  })
  const salesRangeQuery = useQuery({
    queryKey: ['report', 'sales-range', dateFrom, dateTo],
    queryFn: () => getSalesRange(dateFrom, dateTo),
  })
  const closingQuery = useQuery({
    queryKey: ['report', 'daily-closing', dateFrom, dateTo],
    queryFn: () => getDailyClosing(dateFrom, dateTo),
  })

  const exportLowStock = () => {
    if (!lowStockQuery.data || lowStockQuery.data.length === 0) return

    downloadCsv(
      'ccp_pereira_stock_bajo.csv',
      ['Producto', 'SKU', 'Bodega', 'Stock actual', 'Stock mínimo'],
      lowStockQuery.data.map((row) => [
        row.product_name,
        row.sku,
        row.warehouse_name,
        row.current_stock,
        row.min_stock,
      ]),
    )
  }

  const exportTopProducts = () => {
    if (!topProductsQuery.data || topProductsQuery.data.length === 0) return

    downloadCsv(
      'ccp_pereira_top_productos.csv',
      ['Producto', 'SKU', 'Unidades', 'Subtotal', 'IVA', 'Total'],
      topProductsQuery.data.map((row) => [
        row.product_name,
        row.sku,
        row.units_sold,
        row.subtotal,
        row.tax_total,
        row.total,
      ]),
    )
  }

  return (
    <div className="space-y-5">
      <Card
        title="Cierre y reportes"
        subtitle="Elige un rango de fechas o pulsa Hacer Cierre para generar el rótulo del día actual."
      >
        <div className="grid gap-3 lg:grid-cols-[minmax(0,180px)_minmax(0,180px)_1fr_auto_auto] lg:items-end">
          <Input
            label="Fecha inicio"
            type="date"
            value={dateFrom}
            onChange={(event): void => setDateFrom(event.target.value)}
          />
          <Input
            label="Fecha fin"
            type="date"
            value={dateTo}
            onChange={(event): void => setDateTo(event.target.value)}
          />

          <div className="grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div>
              <p className="text-xs text-slate-500">Tickets</p>
              <p className="text-lg font-semibold text-slate-800">{closingQuery.data?.tickets ?? 0}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Total vendido</p>
              <p className="text-lg font-semibold text-slate-800">
                {formatCurrencyCOP(closingQuery.data?.total ?? 0)}
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="secondary"
            onClick={(): void => {
              const todayISO = toISODate(new Date())
              setDateFrom(todayISO)
              setDateTo(todayISO)
            }}
          >
            Hacer Cierre
          </Button>

          <Button type="button" onClick={(): void => setClosingOpen(true)}>
            Ver rótulo de cierre
          </Button>
        </div>
      </Card>

      <DailyClosingModal
        open={closingOpen}
        data={closingQuery.data ?? null}
        loading={closingQuery.isLoading}
        onClose={(): void => setClosingOpen(false)}
      />

      {inventoryValueQuery.isLoading || lowStockQuery.isLoading || topProductsQuery.isLoading || salesRangeQuery.isLoading ? (
        <Loading message="Cargando reportes..." />
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2">
        <Card title="Valor total de inventario">
          <p className="text-3xl font-bold text-blue-700">
            {formatCurrencyCOP(inventoryValueQuery.data?.total_inventory_value ?? 0)}
          </p>
          <p className="mt-1 text-sm text-slate-500">Basado en costo * stock actual.</p>
        </Card>

        <Card title="Ventas por rango">
          <p className="text-sm text-slate-500">Tickets: {salesRangeQuery.data?.tickets ?? 0}</p>
          <p className="mt-2 text-xl font-semibold text-slate-800">
            Total: {formatCurrencyCOP(salesRangeQuery.data?.total ?? 0)}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            Subtotal {formatCurrencyCOP(salesRangeQuery.data?.subtotal ?? 0)} | IVA{' '}
            {formatCurrencyCOP(salesRangeQuery.data?.tax_total ?? 0)}
          </p>
        </Card>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card
          title="Productos con stock bajo"
          actions={
            <Button type="button" variant="secondary" onClick={exportLowStock}>
              Exportar CSV
            </Button>
          }
        >
          {!lowStockQuery.data || lowStockQuery.data.length === 0 ? (
            <EmptyState title="Sin alertas" description="No hay productos con stock por debajo del mínimo." />
          ) : (
            <Table columns={['Producto', 'Bodega', 'Disponible', 'Mínimo']}>
              {lowStockQuery.data.map((row) => (
                <tr key={`${row.product_id}-${row.warehouse_id}`}>
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-slate-800">{row.product_name}</p>
                    <p className="text-xs text-slate-500">SKU: {row.sku}</p>
                  </td>
                  <td className="px-3 py-2.5">{row.warehouse_name}</td>
                  <td className="px-3 py-2.5">{formatNumber(row.current_stock, 3)}</td>
                  <td className="px-3 py-2.5">{formatNumber(row.min_stock, 3)}</td>
                </tr>
              ))}
            </Table>
          )}
        </Card>

        <Card
          title="Top productos vendidos"
          actions={
            <Button type="button" variant="secondary" onClick={exportTopProducts}>
              Exportar CSV
            </Button>
          }
        >
          {!topProductsQuery.data || topProductsQuery.data.length === 0 ? (
            <EmptyState title="Sin datos" description="No hay ventas en el rango seleccionado." />
          ) : (
            <Table columns={['Producto', 'Unidades', 'Subtotal', 'IVA', 'Total']}>
              {topProductsQuery.data.map((row) => (
                <tr key={row.product_id}>
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-slate-800">{row.product_name}</p>
                    <p className="text-xs text-slate-500">SKU: {row.sku}</p>
                  </td>
                  <td className="px-3 py-2.5">{formatNumber(row.units_sold, 2)}</td>
                  <td className="px-3 py-2.5">{formatCurrencyCOP(row.subtotal)}</td>
                  <td className="px-3 py-2.5">{formatCurrencyCOP(row.tax_total)}</td>
                  <td className="px-3 py-2.5 font-semibold">{formatCurrencyCOP(row.total)}</td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>
    </div>
  )
}

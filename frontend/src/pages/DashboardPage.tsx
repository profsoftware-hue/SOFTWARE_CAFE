import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Boxes, DollarSign, PackageSearch, ShoppingBag } from 'lucide-react'
import { useState } from 'react'

import { listProducts } from '@/api/products'
import { getInventoryValue, getLowStock, getSalesRange, getTopProducts } from '@/api/reports'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Loading } from '@/components/ui/Loading'
import { Table } from '@/components/ui/Table'
import { cn } from '@/lib/cn'
import { formatCurrencyCOP, formatDateTime, formatNumber, toISODate } from '@/lib/format'

const today = new Date()
const thirtyDaysAgo = new Date(today)
thirtyDaysAgo.setDate(today.getDate() - 30)

export const DashboardPage = () => {
  const [renderedAt] = useState(() => formatDateTime(new Date()))
  const salesFrom = toISODate(today)
  const salesTo = toISODate(today)

  const inventoryValueQuery = useQuery({
    queryKey: ['dashboard', 'inventory-value'],
    queryFn: getInventoryValue,
  })

  const salesTodayQuery = useQuery({
    queryKey: ['dashboard', 'sales-today', salesFrom, salesTo],
    queryFn: () => getSalesRange(salesFrom, salesTo),
  })

  const lowStockQuery = useQuery({
    queryKey: ['dashboard', 'low-stock'],
    queryFn: () => getLowStock(),
  })

  const topProductsQuery = useQuery({
    queryKey: ['dashboard', 'top-products'],
    queryFn: () => getTopProducts(toISODate(thirtyDaysAgo), toISODate(today), 8),
  })

  const productsQuery = useQuery({
    queryKey: ['dashboard', 'products-count'],
    queryFn: () => listProducts({ limit: 500 }),
  })

  const cards = [
    {
      title: 'Ventas del día',
      value: formatCurrencyCOP(salesTodayQuery.data?.total ?? 0),
      icon: ShoppingBag,
      subtitle: `${salesTodayQuery.data?.tickets ?? 0} tickets confirmados`,
      cardClass: 'border-blue-200 border-l-4 border-l-blue-700 bg-gradient-to-br from-blue-50 via-white to-white',
      iconClass: 'bg-blue-700 text-white',
      titleClass: 'text-blue-800',
    },
    {
      title: 'Valor de inventario',
      value: formatCurrencyCOP(inventoryValueQuery.data?.total_inventory_value ?? 0),
      icon: DollarSign,
      subtitle: 'Costo total actual del inventario',
      cardClass: 'border-cyan-300 border-l-4 border-l-ccp-teal bg-gradient-to-br from-cyan-200/60 via-white to-white',
      iconClass: 'bg-ccp-teal text-white',
      titleClass: 'text-ccp-teal',
    },
    {
      title: 'Stock bajo',
      value: String(lowStockQuery.data?.length ?? 0),
      icon: AlertTriangle,
      subtitle: 'Productos por debajo de mínimo',
      cardClass: 'border-amber-200 border-l-4 border-l-amber-500 bg-gradient-to-br from-amber-50 via-white to-white',
      iconClass: 'bg-amber-500 text-white',
      titleClass: 'text-amber-700',
    },
    {
      title: 'Total productos',
      value: String(productsQuery.data?.length ?? 0),
      icon: Boxes,
      subtitle: 'Registros activos e inactivos',
      cardClass:
        'border-emerald-200 border-l-4 border-l-emerald-600 bg-gradient-to-br from-emerald-100/70 via-white to-white',
      iconClass: 'bg-emerald-600 text-white',
      titleClass: 'text-emerald-800',
    },
  ]

  const loading =
    inventoryValueQuery.isLoading ||
    salesTodayQuery.isLoading ||
    lowStockQuery.isLoading ||
    topProductsQuery.isLoading ||
    productsQuery.isLoading

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 sm:gap-4">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <Card key={card.title} className={card.cardClass}>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className={cn('text-xs font-medium sm:text-sm', card.titleClass)}>{card.title}</p>
                  <p className="mt-1.5 truncate text-xl font-bold text-slate-800 sm:text-2xl">{card.value}</p>
                  <p className="mt-1 text-[11px] text-slate-500 sm:text-xs">{card.subtitle}</p>
                </div>
                <span className={cn('shrink-0 rounded-xl p-2 shadow-sm sm:p-2.5', card.iconClass)}>
                  <Icon size={18} />
                </span>
              </div>
            </Card>
          )
        })}
      </section>

      {loading ? <Loading message="Cargando resumen del dashboard..." /> : null}

      <section className="grid gap-5 lg:grid-cols-2">
        <Card
          title="Productos más vendidos"
          subtitle="Últimos 30 días"
          actions={<span className="text-xs text-slate-500">Actualizado: {renderedAt}</span>}
        >
          {!topProductsQuery.data || topProductsQuery.data.length === 0 ? (
            <EmptyState
              title="Aún no hay ventas confirmadas"
              description="Cuando registres ventas en el POS, aparecerán aquí los productos más vendidos."
            />
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

        <Card
          title="Alertas de stock"
          subtitle="Productos en nivel crítico"
          actions={<PackageSearch size={18} className="text-slate-500" />}
        >
          {!lowStockQuery.data || lowStockQuery.data.length === 0 ? (
            <EmptyState
              title="No hay alertas"
              description="Excelente. Actualmente no hay productos por debajo del stock mínimo."
            />
          ) : (
            <div className="space-y-2">
              {lowStockQuery.data.slice(0, 8).map((row) => (
                <article
                  key={`${row.product_id}-${row.warehouse_id}`}
                  className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-800">{row.product_name}</p>
                    <p className="text-xs text-amber-700">{row.warehouse_name}</p>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    Disponible: <strong>{formatNumber(row.current_stock, 3)}</strong> | Mínimo:{' '}
                    <strong>{formatNumber(row.min_stock, 3)}</strong>
                  </p>
                </article>
              ))}
            </div>
          )}
        </Card>
      </section>
    </div>
  )
}

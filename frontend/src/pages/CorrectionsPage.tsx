import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Boxes, History, Wrench } from 'lucide-react'
import { useState } from 'react'

import { getApiErrorMessage } from '@/api/client'
import {
  correctInventory,
  correctSaleItem,
  getCorrectionSale,
  listCorrectionSales,
} from '@/api/corrections'
import { listCurrentStock } from '@/api/inventory'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Table } from '@/components/ui/Table'
import {
  formatCurrencyCOP,
  formatDateTime,
  formatDecimalInput,
  formatNumber,
  parseDecimal,
} from '@/lib/format'
import type { CorrectionSaleItem, CurrentStockRow } from '@/types/api'

type CorrectionTab = 'sales' | 'inventory'

export const CorrectionsPage = () => {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<CorrectionTab>('sales')

  const [selectedSaleId, setSelectedSaleId] = useState<number | null>(null)
  const [selectedItem, setSelectedItem] = useState<CorrectionSaleItem | null>(null)
  const [saleQuantity, setSaleQuantity] = useState('')
  const [saleReason, setSaleReason] = useState('')
  const [saleError, setSaleError] = useState<string | null>(null)
  const [saleMessage, setSaleMessage] = useState<string | null>(null)

  const [inventorySearch, setInventorySearch] = useState('')
  const [inventoryRow, setInventoryRow] = useState<CurrentStockRow | null>(null)
  const [inventoryQuantity, setInventoryQuantity] = useState('')
  const [inventoryReason, setInventoryReason] = useState('')
  const [inventoryError, setInventoryError] = useState<string | null>(null)
  const [inventoryMessage, setInventoryMessage] = useState<string | null>(null)

  const salesQuery = useQuery({
    queryKey: ['correction-sales'],
    queryFn: () => listCorrectionSales(100),
  })

  const saleDetailQuery = useQuery({
    queryKey: ['correction-sale', selectedSaleId],
    queryFn: () => getCorrectionSale(selectedSaleId as number),
    enabled: selectedSaleId !== null,
  })

  const stockQuery = useQuery({
    queryKey: ['stock', 'corrections', inventorySearch],
    queryFn: () =>
      listCurrentStock({
        search: inventorySearch.trim() || undefined,
        include_inactive: true,
      }),
    enabled: activeTab === 'inventory',
  })

  const invalidateCorrectionData = () => {
    void queryClient.invalidateQueries({ queryKey: ['correction-sales'] })
    void queryClient.invalidateQueries({ queryKey: ['correction-sale'] })
    void queryClient.invalidateQueries({ queryKey: ['stock'] })
    void queryClient.invalidateQueries({ queryKey: ['kardex'] })
    void queryClient.invalidateQueries({ queryKey: ['report'] })
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    void queryClient.invalidateQueries({ queryKey: ['recent-sales'] })
  }

  const saleCorrectionMutation = useMutation({
    mutationFn: ({
      saleId,
      saleItemId,
      correctedQuantity,
      reason,
    }: {
      saleId: number
      saleItemId: number
      correctedQuantity: number
      reason: string
    }) =>
      correctSaleItem(saleId, saleItemId, {
        corrected_quantity: correctedQuantity,
        reason,
      }),
    onSuccess: () => {
      invalidateCorrectionData()
      setSelectedItem(null)
      setSaleReason('')
      setSaleError(null)
      setSaleMessage('Corrección aplicada. La venta conserva su valor original.')
    },
    onError: (unknownError) => setSaleError(getApiErrorMessage(unknownError)),
  })

  const inventoryCorrectionMutation = useMutation({
    mutationFn: correctInventory,
    onSuccess: () => {
      invalidateCorrectionData()
      setInventoryRow(null)
      setInventoryReason('')
      setInventoryError(null)
      setInventoryMessage('Stock corregido correctamente.')
    },
    onError: (unknownError) => setInventoryError(getApiErrorMessage(unknownError)),
  })

  const openSale = (saleId: number) => {
    setSelectedSaleId(saleId)
    setSelectedItem(null)
    setSaleQuantity('')
    setSaleReason('')
    setSaleError(null)
    setSaleMessage(null)
  }

  const closeSale = () => {
    setSelectedSaleId(null)
    setSelectedItem(null)
    setSaleQuantity('')
    setSaleReason('')
    setSaleError(null)
    setSaleMessage(null)
  }

  const selectItem = (item: CorrectionSaleItem) => {
    setSelectedItem(item)
    setSaleQuantity(formatNumber(item.effective_quantity, 3))
    setSaleReason('')
    setSaleError(null)
    setSaleMessage(null)
  }

  const submitSaleCorrection = () => {
    if (!selectedSaleId || !selectedItem) return
    const quantity = parseDecimal(saleQuantity)
    if (quantity < 0) {
      setSaleError('La cantidad no puede ser negativa.')
      return
    }
    if (saleReason.trim().length < 3) {
      setSaleError('Escribe un motivo de al menos 3 caracteres.')
      return
    }
    saleCorrectionMutation.mutate({
      saleId: selectedSaleId,
      saleItemId: selectedItem.sale_item_id,
      correctedQuantity: quantity,
      reason: saleReason.trim(),
    })
  }

  const openInventory = (row: CurrentStockRow) => {
    setInventoryRow(row)
    setInventoryQuantity(formatNumber(row.current_stock, 3))
    setInventoryReason('')
    setInventoryError(null)
    setInventoryMessage(null)
  }

  const closeInventory = () => {
    setInventoryRow(null)
    setInventoryQuantity('')
    setInventoryReason('')
    setInventoryError(null)
  }

  const submitInventoryCorrection = () => {
    if (!inventoryRow) return
    const quantity = parseDecimal(inventoryQuantity)
    if (quantity < 0) {
      setInventoryError('La cantidad no puede ser negativa.')
      return
    }
    if (inventoryReason.trim().length < 3) {
      setInventoryError('Escribe un motivo de al menos 3 caracteres.')
      return
    }
    inventoryCorrectionMutation.mutate({
      product_id: inventoryRow.product_id,
      warehouse_id: inventoryRow.warehouse_id,
      corrected_quantity: quantity,
      reason: inventoryReason.trim(),
    })
  }

  return (
    <div className="space-y-4">
      <Card
        title="Correcciones administrativas"
        subtitle="Ajusta cantidades de ventas o inventario sin modificar los valores facturados."
      >
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-semibold">Uso exclusivo del administrador</p>
          <p className="mt-1">
            Esta herramienta cambia cantidades y stock. No modifica el total de la venta, el
            recibo, la facturación ni los valores contables. Cada cambio queda auditado con
            usuario, fecha y motivo.
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            variant={activeTab === 'sales' ? 'primary' : 'secondary'}
            onClick={(): void => setActiveTab('sales')}
          >
            <History size={16} className="mr-1.5" />
            Corregir ventas
          </Button>
          <Button
            type="button"
            variant={activeTab === 'inventory' ? 'primary' : 'secondary'}
            onClick={(): void => setActiveTab('inventory')}
          >
            <Boxes size={16} className="mr-1.5" />
            Corregir inventario
          </Button>
        </div>

        {saleMessage ? (
          <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {saleMessage}
          </div>
        ) : null}
        {inventoryMessage ? (
          <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {inventoryMessage}
          </div>
        ) : null}
      </Card>

      {activeTab === 'sales' ? (
        <Card
          title="Ventas recientes"
          subtitle="Selecciona una venta para corregir las cantidades de sus productos."
        >
          {salesQuery.isLoading ? <p className="text-sm text-slate-500">Cargando ventas...</p> : null}
          {!salesQuery.isLoading && (!salesQuery.data || salesQuery.data.length === 0) ? (
            <EmptyState title="Sin ventas" description="No hay ventas confirmadas para corregir." />
          ) : null}
          {salesQuery.data && salesQuery.data.length > 0 ? (
            <Table columns={['Fecha', 'Factura', 'Cliente', 'Total', 'Acción']}>
              {salesQuery.data.map((sale) => (
                <tr key={sale.id}>
                  <td className="px-3 py-2.5 text-xs text-slate-500">
                    {formatDateTime(sale.sold_at)}
                  </td>
                  <td className="px-3 py-2.5 font-medium text-slate-800">{sale.sale_number}</td>
                  <td className="px-3 py-2.5">{sale.customer_name ?? 'Consumidor final'}</td>
                  <td className="px-3 py-2.5 font-semibold">{formatCurrencyCOP(sale.total)}</td>
                  <td className="px-3 py-2.5">
                    <Button type="button" variant="secondary" onClick={(): void => openSale(sale.id)}>
                      Revisar
                    </Button>
                  </td>
                </tr>
              ))}
            </Table>
          ) : null}
        </Card>
      ) : (
        <Card
          title="Inventario actual"
          subtitle="Corrige la cantidad real en bodega. No modifica compras, ventas ni facturación."
        >
          <div className="max-w-md">
            <Input
              label="Buscar producto"
              value={inventorySearch}
              onChange={(event): void => setInventorySearch(event.target.value)}
              placeholder="Nombre, SKU o código de barras"
            />
          </div>
          {stockQuery.isLoading ? (
            <p className="mt-3 text-sm text-slate-500">Cargando inventario...</p>
          ) : null}
          {!stockQuery.isLoading && (!stockQuery.data || stockQuery.data.length === 0) ? (
            <EmptyState title="Sin productos" description="No se encontraron productos." />
          ) : null}
          {stockQuery.data && stockQuery.data.length > 0 ? (
            <Table
              className="mt-3"
              columns={['Producto', 'Bodega', 'Stock actual', 'Estado', 'Acción']}
            >
              {stockQuery.data.map((row) => (
                <tr key={`${row.product_id}-${row.warehouse_id}`}>
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-slate-800">{row.product_name}</p>
                    <p className="text-xs text-slate-500">SKU: {row.sku}</p>
                  </td>
                  <td className="px-3 py-2.5">{row.warehouse_name}</td>
                  <td className="px-3 py-2.5 font-semibold">{formatNumber(row.current_stock, 3)}</td>
                  <td className="px-3 py-2.5">
                    <Badge variant={row.is_active ? 'success' : 'default'}>
                      {row.is_active ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5">
                    <Button type="button" variant="secondary" onClick={(): void => openInventory(row)}>
                      Corregir
                    </Button>
                  </td>
                </tr>
              ))}
            </Table>
          ) : null}
        </Card>
      )}

      <Modal
        open={selectedSaleId !== null}
        onClose={closeSale}
        title="Corregir cantidades de la venta"
        description="El total, el recibo y la contabilidad no se modifican."
        className="max-w-5xl"
      >
        {saleDetailQuery.isLoading ? (
          <p className="text-sm text-slate-500">Cargando venta...</p>
        ) : null}
        {saleDetailQuery.data ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <p className="font-semibold text-slate-800">{saleDetailQuery.data.sale_number}</p>
              <p className="text-slate-500">
                {saleDetailQuery.data.customer_name ?? 'Consumidor final'} ·{' '}
                {formatCurrencyCOP(saleDetailQuery.data.total)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Las cantidades corregidas ajustan stock y unidades vendidas; el valor total
                original se conserva.
              </p>
            </div>

            <Table columns={['Producto', 'Cantidad original', 'Cantidad actual', 'Valor línea', 'Acción']}>
              {saleDetailQuery.data.items.map((item) => (
                <tr key={item.sale_item_id}>
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-slate-800">{item.product_name}</p>
                    <p className="text-xs text-slate-500">Ítem #{item.sale_item_id}</p>
                  </td>
                  <td className="px-3 py-2.5">{formatNumber(item.quantity, 3)}</td>
                  <td className="px-3 py-2.5 font-semibold">
                    {formatNumber(item.effective_quantity, 3)}
                  </td>
                  <td className="px-3 py-2.5">{formatCurrencyCOP(item.line_total)}</td>
                  <td className="px-3 py-2.5">
                    <Button type="button" variant="secondary" onClick={(): void => selectItem(item)}>
                      <Wrench size={14} className="mr-1" />
                      Corregir
                    </Button>
                  </td>
                </tr>
              ))}
            </Table>

            {selectedItem ? (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                <p className="text-sm font-semibold text-slate-800">
                  {selectedItem.product_name}
                </p>
                <p className="text-xs text-slate-500">
                  Cantidad actual vendida: {formatNumber(selectedItem.effective_quantity, 3)}
                </p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <Input
                    label="Nueva cantidad vendida *"
                    type="text"
                    inputMode="decimal"
                    value={saleQuantity}
                    onChange={(event): void =>
                      setSaleQuantity(formatDecimalInput(event.target.value, 3))
                    }
                    helperText="Se ajusta el stock por la diferencia."
                  />
                  <Input
                    label="Motivo de la corrección *"
                    value={saleReason}
                    onChange={(event): void => setSaleReason(event.target.value)}
                    placeholder="Ej. Se digitó 10 y eran 2 unidades"
                  />
                </div>
                {saleError ? (
                  <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    {saleError}
                  </div>
                ) : null}
                <div className="mt-3 flex justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={(): void => setSelectedItem(null)}>
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    loading={saleCorrectionMutation.isPending}
                    onClick={submitSaleCorrection}
                  >
                    Aplicar corrección
                  </Button>
                </div>
              </div>
            ) : null}

            {saleDetailQuery.data.history.length > 0 ? (
              <div>
                <p className="mb-2 text-sm font-semibold text-slate-700">
                  Historial de correcciones
                </p>
                <Table columns={['Fecha', 'Ítem', 'Antes', 'Después', 'Motivo', 'Usuario']}>
                  {saleDetailQuery.data.history.map((correction) => (
                    <tr key={correction.id}>
                      <td className="px-3 py-2.5 text-xs text-slate-500">
                        {formatDateTime(correction.created_at)}
                      </td>
                      <td className="px-3 py-2.5">#{correction.sale_item_id ?? '-'}</td>
                      <td className="px-3 py-2.5">{formatNumber(correction.previous_quantity, 3)}</td>
                      <td className="px-3 py-2.5">{formatNumber(correction.corrected_quantity, 3)}</td>
                      <td className="px-3 py-2.5">{correction.reason}</td>
                      <td className="px-3 py-2.5">{correction.created_by_name ?? '-'}</td>
                    </tr>
                  ))}
                </Table>
              </div>
            ) : null}

            <div className="flex justify-end">
              <Button type="button" variant="ghost" onClick={closeSale}>
                Cerrar
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={inventoryRow !== null}
        onClose={closeInventory}
        title="Corregir stock del producto"
        description="Ajusta la cantidad real en bodega sin modificar compras ni ventas."
        className="max-w-lg"
      >
        {inventoryRow ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="font-semibold text-slate-800">{inventoryRow.product_name}</p>
              <p className="text-xs text-slate-500">
                {inventoryRow.warehouse_name} · SKU: {inventoryRow.sku}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Stock actual: <strong>{formatNumber(inventoryRow.current_stock, 3)}</strong>
              </p>
            </div>

            <Input
              label="Stock real en bodega *"
              type="text"
              inputMode="decimal"
              value={inventoryQuantity}
              onChange={(event): void =>
                setInventoryQuantity(formatDecimalInput(event.target.value, 3))
              }
              helperText="El sistema ajustará la diferencia mediante un movimiento de inventario."
            />
            <Input
              label="Motivo de la corrección *"
              value={inventoryReason}
              onChange={(event): void => setInventoryReason(event.target.value)}
              placeholder="Ej. Se ingresaron 100 unidades y eran 10"
            />

            {inventoryError ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {inventoryError}
              </div>
            ) : null}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={closeInventory}>
                Cancelar
              </Button>
              <Button
                type="button"
                loading={inventoryCorrectionMutation.isPending}
                onClick={submitInventoryCorrection}
              >
                Aplicar corrección
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}

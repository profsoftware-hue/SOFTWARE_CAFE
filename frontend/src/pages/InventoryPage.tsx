import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Boxes, PackagePlus, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import { getApiErrorMessage } from '@/api/client'
import { listWarehouses } from '@/api/catalogs'
import { listCurrentStock, listKardex } from '@/api/inventory'
import { addProductStock, createQuickProduct, deleteProduct, patchProduct } from '@/api/products'
import { useAuth } from '@/auth/context'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { Loading } from '@/components/ui/Loading'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { Table } from '@/components/ui/Table'
import { downloadCsv } from '@/lib/csv'
import { formatCurrencyCOP, formatDateTime, formatNumber, toISODate } from '@/lib/format'
import type { CurrentStockRow } from '@/types/api'

type InventoryTab = 'products' | 'kardex'

interface NewProductForm {
  name: string
  sale_price_excl_tax: string
  cost_price: string
  quantity: string
  vat_rate: string
  sku: string
}

const emptyNewProduct = (): NewProductForm => ({
  name: '',
  sale_price_excl_tax: '',
  cost_price: '',
  quantity: '1',
  vat_rate: '0.19',
  sku: '',
})

export const InventoryPage = () => {
  const queryClient = useQueryClient()
  const { session, hasPermission } = useAuth()
  const canManage = hasPermission('inventory.manage')
  const isAdmin = session?.roles.includes('ADMIN') ?? false
  const [activeTab, setActiveTab] = useState<InventoryTab>('products')

  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [newOpen, setNewOpen] = useState(false)
  const [newForm, setNewForm] = useState<NewProductForm>(() => emptyNewProduct())
  const [newError, setNewError] = useState<string | null>(null)
  const [addRow, setAddRow] = useState<CurrentStockRow | null>(null)
  const [addQuantity, setAddQuantity] = useState('1')
  const [addError, setAddError] = useState<string | null>(null)
  const [editRow, setEditRow] = useState<CurrentStockRow | null>(null)
  const [editForm, setEditForm] = useState({
    name: '',
    sale_price_excl_tax: '',
    cost_price: '',
    vat_rate: '0.19',
    sku: '',
  })
  const [editError, setEditError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const [kardexProductId, setKardexProductId] = useState('')
  const [kardexWarehouseId, setKardexWarehouseId] = useState('')
  const [kardexMovementType, setKardexMovementType] = useState('')

  const warehousesQuery = useQuery({ queryKey: ['warehouses'], queryFn: listWarehouses })

  const stockQuery = useQuery({
    queryKey: ['stock', search, dateFrom, dateTo],
    queryFn: () =>
      listCurrentStock({
        search: search.trim() || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      }),
  })

  const kardexQuery = useQuery({
    queryKey: ['kardex', kardexProductId, kardexWarehouseId, kardexMovementType],
    queryFn: () =>
      listKardex({
        product_id: kardexProductId ? Number(kardexProductId) : undefined,
        warehouse_id: kardexWarehouseId ? Number(kardexWarehouseId) : undefined,
        movement_type: kardexMovementType || undefined,
        limit: 300,
      }),
  })

  const invalidateInventory = () => {
    void queryClient.invalidateQueries({ queryKey: ['stock'] })
    void queryClient.invalidateQueries({ queryKey: ['kardex'] })
    void queryClient.invalidateQueries({ queryKey: ['products'] })
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const createMutation = useMutation({
    mutationFn: createQuickProduct,
    onSuccess: (product) => {
      invalidateInventory()
      setNewOpen(false)
      setNewForm(emptyNewProduct())
      setNewError(null)
      setMessage(`Producto "${product.name}" creado y agregado al inventario.`)
      setActionError(null)
    },
    onError: (unknownError) => setNewError(getApiErrorMessage(unknownError)),
  })

  const addMutation = useMutation({
    mutationFn: ({ row, quantity }: { row: CurrentStockRow; quantity: number }) =>
      addProductStock(row.product_id, quantity, row.warehouse_id),
    onSuccess: () => {
      invalidateInventory()
      setAddRow(null)
      setAddQuantity('1')
      setAddError(null)
      setMessage('Unidades agregadas correctamente.')
      setActionError(null)
    },
    onError: (unknownError) => setAddError(getApiErrorMessage(unknownError)),
  })

  const deleteMutation = useMutation({
    mutationFn: (productId: number) => deleteProduct(productId),
    onSuccess: () => {
      invalidateInventory()
      setMessage('Producto eliminado del inventario.')
      setActionError(null)
    },
    onError: (unknownError) => {
      setMessage(null)
      setActionError(getApiErrorMessage(unknownError))
    },
  })

  const editMutation = useMutation({
    mutationFn: ({ productId, payload }: { productId: number; payload: Parameters<typeof patchProduct>[1] }) =>
      patchProduct(productId, payload),
    onSuccess: (product) => {
      invalidateInventory()
      setEditRow(null)
      setEditError(null)
      setActionError(null)
      setMessage(`Producto "${product.name}" actualizado correctamente.`)
    },
    onError: (unknownError) => setEditError(getApiErrorMessage(unknownError)),
  })

  const handleDelete = (row: CurrentStockRow) => {
    const confirmed = window.confirm(
      `¿Eliminar "${row.product_name}" del inventario?\n\nEsta acción no se puede deshacer.`,
    )
    if (confirmed) {
      deleteMutation.mutate(row.product_id)
    }
  }

  const openEdit = (row: CurrentStockRow) => {
    setEditRow(row)
    setEditForm({
      name: row.product_name,
      sale_price_excl_tax: row.sale_price_excl_tax,
      cost_price: row.cost_price,
      vat_rate: row.vat_rate,
      sku: row.sku,
    })
    setEditError(null)
    setMessage(null)
    setActionError(null)
  }

  const submitEdit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editRow) return
    setEditError(null)

    const name = editForm.name.trim()
    const price = Number(editForm.sale_price_excl_tax)
    const cost = Number(editForm.cost_price)

    if (!name || Number.isNaN(price) || price < 0 || Number.isNaN(cost) || cost < 0) {
      setEditError('Completa nombre, precio y costo con valores válidos.')
      return
    }

    editMutation.mutate({
      productId: editRow.product_id,
      payload: {
        name,
        sale_price_excl_tax: price,
        cost_price: cost,
        vat_rate: Number(editForm.vat_rate),
        sku: editForm.sku.trim(),
      },
    })
  }

  const submitNewProduct = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setNewError(null)

    const name = newForm.name.trim()
    const price = Number(newForm.sale_price_excl_tax)
    const quantity = Number(newForm.quantity)

    if (!name || Number.isNaN(price) || price < 0 || Number.isNaN(quantity) || quantity <= 0) {
      setNewError('Completa nombre, precio y una cantidad mayor a cero.')
      return
    }

    createMutation.mutate({
      name,
      quantity,
      sale_price_excl_tax: price,
      cost_price: Number(newForm.cost_price) || 0,
      vat_rate: Number(newForm.vat_rate),
      sku: newForm.sku.trim() || undefined,
    })
  }

  const submitAddUnits = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!addRow) return
    setAddError(null)

    const quantity = Number(addQuantity)
    if (Number.isNaN(quantity) || quantity <= 0) {
      setAddError('Ingresa una cantidad mayor a cero.')
      return
    }

    addMutation.mutate({ row: addRow, quantity })
  }

  const applyToday = () => {
    const today = toISODate(new Date())
    setDateFrom(today)
    setDateTo(today)
  }

  const applyThisMonth = () => {
    const now = new Date()
    setDateFrom(toISODate(new Date(now.getFullYear(), now.getMonth(), 1)))
    setDateTo(toISODate(now))
  }

  const clearDateRange = () => {
    setDateFrom('')
    setDateTo('')
  }

  const exportStock = () => {
    if (!stockQuery.data || stockQuery.data.length === 0) return

    downloadCsv(
      'ccp_pereira_inventario.csv',
      [
        'Producto',
        'SKU',
        'Bodega',
        'Precio venta',
        'Costo',
        'Stock actual',
        'Vendidos',
        'Total vendido',
        'Stock mínimo',
      ],
      stockQuery.data.map((row) => [
        row.product_name,
        row.sku,
        row.warehouse_name,
        row.sale_price_excl_tax,
        row.cost_price,
        row.current_stock,
        row.sold_quantity,
        row.sold_total,
        row.min_stock,
      ]),
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="rounded-xl bg-blue-50 p-2 text-blue-700">
              <Boxes size={20} />
            </span>
            <div>
              <h3 className="text-base font-semibold text-slate-800 sm:text-lg">Inventario</h3>
              <p className="text-sm text-slate-500">
                Crea productos una vez y luego solo agrega unidades cuando lleguen.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={exportStock}>
              Exportar CSV
            </Button>
            {canManage ? (
              <Button type="button" onClick={(): void => setNewOpen(true)}>
                <Plus size={16} className="mr-1.5" />
                Nuevo producto
              </Button>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            variant={activeTab === 'products' ? 'primary' : 'secondary'}
            onClick={(): void => setActiveTab('products')}
          >
            Productos y stock
          </Button>
          <Button
            type="button"
            variant={activeTab === 'kardex' ? 'primary' : 'secondary'}
            onClick={(): void => setActiveTab('kardex')}
          >
            Movimientos (kardex)
          </Button>
        </div>

        {message ? (
          <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {message}
          </div>
        ) : null}

        {actionError ? (
          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {actionError}
          </div>
        ) : null}
      </Card>

      {activeTab === 'products' ? (
        <Card>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Input
              label="Buscar producto"
              placeholder="Nombre, SKU o código de barras"
              value={search}
              onChange={(event): void => setSearch(event.target.value)}
            />
            <Input
              label="Vendidos desde"
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(event): void => setDateFrom(event.target.value)}
            />
            <Input
              label="Vendidos hasta"
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(event): void => setDateTo(event.target.value)}
            />
            <div className="flex flex-wrap items-end gap-2">
              <Button type="button" variant="secondary" onClick={applyToday}>
                Hoy
              </Button>
              <Button type="button" variant="secondary" onClick={applyThisMonth}>
                Este mes
              </Button>
              <Button type="button" variant="ghost" onClick={clearDateRange}>
                Todo
              </Button>
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {dateFrom || dateTo
              ? 'Las columnas Vendidos y Total vendido corresponden al rango de fechas seleccionado.'
              : 'Las columnas Vendidos y Total vendido muestran el acumulado histórico.'}
          </p>

          {stockQuery.isLoading ? <Loading message="Cargando inventario..." /> : null}

          {!stockQuery.isLoading && (!stockQuery.data || stockQuery.data.length === 0) ? (
            <EmptyState
              title="Inventario vacío"
              description="Crea tu primer producto con nombre, precio y cantidad."
            />
          ) : null}

          {stockQuery.data && stockQuery.data.length > 0 ? (
            <Table
              className="mt-4"
              columns={[
                'Producto',
                { label: 'Bodega', className: 'hidden lg:table-cell' },
                'Precio venta',
                { label: 'Costo', className: 'hidden xl:table-cell' },
                'Stock',
                'Vendidos',
                'Total vendido',
                'Estado',
                'Acciones',
              ]}
            >
              {stockQuery.data.map((row) => (
                <tr key={`${row.product_id}-${row.warehouse_id}`}>
                  <td className="px-2.5 py-2 sm:px-3">
                    <p className="font-medium text-slate-800">{row.product_name}</p>
                    <p className="text-xs text-slate-500">SKU: {row.sku}</p>
                  </td>
                  <td className="hidden px-3 py-2 lg:table-cell">{row.warehouse_name}</td>
                  <td className="px-2.5 py-2 font-semibold sm:px-3">
                    {formatCurrencyCOP(row.sale_price_excl_tax)}
                  </td>
                  <td className="hidden px-3 py-2 xl:table-cell">{formatCurrencyCOP(row.cost_price)}</td>
                  <td className="px-2.5 py-2 sm:px-3">{formatNumber(row.current_stock, 3)}</td>
                  <td className="px-2.5 py-2 sm:px-3">{formatNumber(row.sold_quantity, 3)}</td>
                  <td className="px-2.5 py-2 font-semibold sm:px-3">{formatCurrencyCOP(row.sold_total)}</td>
                  <td className="px-2.5 py-2 sm:px-3">
                    <Badge variant={row.is_low_stock ? 'warning' : 'success'}>
                      {row.is_low_stock ? 'Bajo' : 'Normal'}
                    </Badge>
                  </td>
                  <td className="px-2.5 py-2 sm:px-3">
                    {canManage ? (
                      <div className="flex flex-nowrap items-center gap-1.5">
                        <Button
                          type="button"
                          variant="secondary"
                          className="px-2.5 py-1.5"
                          aria-label={`Agregar unidades a ${row.product_name}`}
                          title="Agregar unidades"
                          onClick={(): void => {
                            setAddRow(row)
                            setAddQuantity('1')
                            setAddError(null)
                            setMessage(null)
                          }}
                        >
                          <PackagePlus size={14} />
                          <span className="ml-1 hidden sm:inline">Agregar unidades</span>
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          className="px-2.5 py-1.5"
                          aria-label={`Editar ${row.product_name}`}
                          title="Editar producto"
                          onClick={(): void => openEdit(row)}
                        >
                          <Pencil size={14} />
                        </Button>
                        {isAdmin ? (
                          <Button
                            type="button"
                            variant="danger"
                            className="px-2.5 py-1.5"
                            aria-label={`Eliminar ${row.product_name}`}
                            title="Eliminar producto"
                            disabled={deleteMutation.isPending}
                            onClick={(): void => handleDelete(row)}
                          >
                            <Trash2 size={14} />
                          </Button>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">Solo lectura</span>
                    )}
                  </td>
                </tr>
              ))}
            </Table>
          ) : null}
        </Card>
      ) : (
        <Card>
          <div className="grid gap-3 md:grid-cols-3">
            <Input
              label="ID Producto"
              value={kardexProductId}
              onChange={(event): void => setKardexProductId(event.target.value)}
              placeholder="Ej. 1"
            />
            <Select
              label="Bodega"
              value={kardexWarehouseId}
              onChange={(event): void => setKardexWarehouseId(event.target.value)}
            >
              <option value="">Todas</option>
              {warehousesQuery.data?.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </Select>
            <Select
              label="Tipo movimiento"
              value={kardexMovementType}
              onChange={(event): void => setKardexMovementType(event.target.value)}
            >
              <option value="">Todos</option>
              <option value="PURCHASE">Compra</option>
              <option value="CUSTOMER_RETURN">Devolución cliente</option>
              <option value="ADJUSTMENT_IN">Entrada</option>
              <option value="SALE">Venta</option>
              <option value="SHRINKAGE">Merma</option>
              <option value="DAMAGE">Daño</option>
              <option value="ADJUSTMENT_OUT">Salida</option>
            </Select>
          </div>

          {kardexQuery.isLoading ? <Loading message="Cargando movimientos..." /> : null}

          {!kardexQuery.isLoading && (!kardexQuery.data || kardexQuery.data.length === 0) ? (
            <EmptyState title="Sin movimientos" description="Aún no hay entradas ni salidas registradas." />
          ) : null}

          {kardexQuery.data && kardexQuery.data.length > 0 ? (
            <Table
              className="mt-4"
              columns={[
                'Fecha',
                'Producto',
                'Bodega',
                'Tipo',
                'Dirección',
                'Cantidad',
                { label: 'Costo', className: 'hidden 2xl:table-cell' },
              ]}
            >
              {kardexQuery.data.map((movement) => (
                <tr key={movement.id}>
                  <td className="px-2.5 py-2 text-xs text-slate-500 sm:px-3">
                    {formatDateTime(movement.moved_at)}
                  </td>
                  <td className="px-2.5 py-2 sm:px-3">#{movement.product_id}</td>
                  <td className="px-2.5 py-2 sm:px-3">#{movement.warehouse_id}</td>
                  <td className="px-2.5 py-2 sm:px-3">{movement.movement_type}</td>
                  <td className="px-2.5 py-2 sm:px-3">{movement.direction}</td>
                  <td className="px-2.5 py-2 sm:px-3">{formatNumber(movement.quantity, 3)}</td>
                  <td className="hidden px-3 py-2 2xl:table-cell">
                    {movement.unit_cost ? formatCurrencyCOP(movement.unit_cost) : '-'}
                  </td>
                </tr>
              ))}
            </Table>
          ) : null}
        </Card>
      )}

      <Modal
        open={newOpen}
        onClose={(): void => setNewOpen(false)}
        title="Nuevo producto"
        description="El costo solo se pide una vez. Después solo agregas unidades."
        className="max-w-xl"
      >
        <form className="space-y-4" onSubmit={submitNewProduct}>
          <Input
            label="Nombre del producto *"
            value={newForm.name}
            onChange={(event): void => setNewForm((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="Ej. Café molido 500 g"
            required
          />

          <div className="grid gap-3 md:grid-cols-2">
            <Input
              label="Precio de venta *"
              type="number"
              min="0"
              step="0.01"
              value={newForm.sale_price_excl_tax}
              onChange={(event): void =>
                setNewForm((prev) => ({ ...prev, sale_price_excl_tax: event.target.value }))
              }
              required
            />
            <Input
              label="Cantidad inicial *"
              type="number"
              min="0.001"
              step="0.001"
              value={newForm.quantity}
              onChange={(event): void => setNewForm((prev) => ({ ...prev, quantity: event.target.value }))}
              required
            />
            <Input
              label="Costo unitario (solo una vez)"
              type="number"
              min="0"
              step="0.01"
              value={newForm.cost_price}
              onChange={(event): void => setNewForm((prev) => ({ ...prev, cost_price: event.target.value }))}
              placeholder="0"
              helperText="Se guarda y ya no se vuelve a pedir."
            />
            <Select
              label="IVA"
              value={newForm.vat_rate}
              onChange={(event): void => setNewForm((prev) => ({ ...prev, vat_rate: event.target.value }))}
            >
              <option value="0.19">19% General</option>
              <option value="0.05">5% Reducida</option>
              <option value="0">0% Exento</option>
            </Select>
            <Input
              label="SKU / código (opcional)"
              value={newForm.sku}
              onChange={(event): void => setNewForm((prev) => ({ ...prev, sku: event.target.value }))}
              placeholder="Se genera automático"
            />
          </div>

          {newError ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {newError}
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={(): void => setNewOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={createMutation.isPending}>
              <Plus size={16} className="mr-1" />
              Guardar en inventario
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={addRow !== null}
        onClose={(): void => setAddRow(null)}
        title="Agregar unidades"
        description="El costo ya está registrado; solo indica cuántas unidades llegaron."
        className="max-w-lg"
      >
        {addRow ? (
          <form className="space-y-4" onSubmit={submitAddUnits}>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="font-semibold text-slate-800">{addRow.product_name}</p>
              <p className="text-xs text-slate-500">SKU: {addRow.sku}</p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-slate-600">
                <p>
                  Costo registrado: <strong>{formatCurrencyCOP(addRow.cost_price)}</strong>
                </p>
                <p>
                  Stock actual: <strong>{formatNumber(addRow.current_stock, 3)}</strong>
                </p>
              </div>
            </div>

            <Input
              label="Unidades que llegaron *"
              type="number"
              min="0.001"
              step="0.001"
              value={addQuantity}
              onChange={(event): void => setAddQuantity(event.target.value)}
              required
            />

            {addError ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {addError}
              </div>
            ) : null}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={(): void => setAddRow(null)}>
                Cancelar
              </Button>
              <Button type="submit" loading={addMutation.isPending}>
                <PackagePlus size={16} className="mr-1" />
                Agregar al inventario
              </Button>
            </div>
          </form>
        ) : null}
      </Modal>

      <Modal
        open={editRow !== null}
        onClose={(): void => setEditRow(null)}
        title="Editar producto"
        description="Cambia el precio o el costo sin tocar el stock ni crear otro producto."
        className="max-w-xl"
      >
        {editRow ? (
          <form className="space-y-4" onSubmit={submitEdit}>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="font-semibold text-slate-800">{editRow.product_name}</p>
              <p className="text-xs text-slate-500">
                Stock actual: {formatNumber(editRow.current_stock, 3)} · SKU: {editRow.sku}
              </p>
            </div>

            <Input
              label="Nombre del producto *"
              value={editForm.name}
              onChange={(event): void => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
              required
            />

            <div className="grid gap-3 md:grid-cols-2">
              <Input
                label="Precio de venta *"
                type="number"
                min="0"
                step="0.01"
                value={editForm.sale_price_excl_tax}
                onChange={(event): void =>
                  setEditForm((prev) => ({ ...prev, sale_price_excl_tax: event.target.value }))
                }
                required
              />
              <Input
                label="Costo unitario *"
                type="number"
                min="0"
                step="0.01"
                value={editForm.cost_price}
                onChange={(event): void =>
                  setEditForm((prev) => ({ ...prev, cost_price: event.target.value }))
                }
                required
              />
              <Select
                label="IVA"
                value={editForm.vat_rate}
                onChange={(event): void => setEditForm((prev) => ({ ...prev, vat_rate: event.target.value }))}
              >
                <option value="0.19">19% General</option>
                <option value="0.05">5% Reducida</option>
                <option value="0">0% Exento</option>
              </Select>
              <Input
                label="SKU / código"
                value={editForm.sku}
                onChange={(event): void => setEditForm((prev) => ({ ...prev, sku: event.target.value }))}
              />
            </div>

            {editError ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {editError}
              </div>
            ) : null}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={(): void => setEditRow(null)}>
                Cancelar
              </Button>
              <Button type="submit" loading={editMutation.isPending}>
                <Pencil size={16} className="mr-1" />
                Guardar cambios
              </Button>
            </div>
          </form>
        ) : null}
      </Modal>
    </div>
  )
}

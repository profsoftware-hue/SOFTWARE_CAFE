import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Boxes, Eye, PackagePlus, Pencil, Plus, Power, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'

import { getApiErrorMessage } from '@/api/client'
import { listWarehouses } from '@/api/catalogs'
import { listCurrentStock, listKardex } from '@/api/inventory'
import {
  addProductStock,
  createQuickProduct,
  deleteProduct,
  patchProduct,
  replaceProductImage,
} from '@/api/products'
import { useAuth } from '@/auth/context'
import { AuthenticatedImage } from '@/components/AuthenticatedImage'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { Loading } from '@/components/ui/Loading'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { Table } from '@/components/ui/Table'
import { PriceBreakdown } from '@/components/PriceBreakdown'
import { downloadCsv } from '@/lib/csv'
import {
  formatCurrencyCOP,
  formatDateTime,
  formatDecimalInput,
  formatNumber,
  parseDecimal,
  toISODate,
} from '@/lib/format'
import { calculatePriceBreakdown } from '@/lib/pricing'
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
  const isAdmin = session?.roles.includes('ADMIN') ?? false
  // El administrador siempre puede crear, editar y ajustar productos.
  const canManage = isAdmin || hasPermission('inventory.manage')
  const [activeTab, setActiveTab] = useState<InventoryTab>('products')

  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const [newForm, setNewForm] = useState<NewProductForm>(() => emptyNewProduct())
  const [newImage, setNewImage] = useState<File | null>(null)
  const [newError, setNewError] = useState<string | null>(null)
  const [detailRow, setDetailRow] = useState<CurrentStockRow | null>(null)
  const [deleteRow, setDeleteRow] = useState<CurrentStockRow | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleteError, setDeleteError] = useState<string | null>(null)
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
  const [editImage, setEditImage] = useState<File | null>(null)
  const [editError, setEditError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const [kardexProductId, setKardexProductId] = useState('')
  const [kardexWarehouseId, setKardexWarehouseId] = useState('')
  const [kardexMovementType, setKardexMovementType] = useState('')

  const warehousesQuery = useQuery({ queryKey: ['warehouses'], queryFn: listWarehouses })

  const stockQuery = useQuery({
    queryKey: ['stock', search, dateFrom, dateTo, showInactive],
    queryFn: () =>
      listCurrentStock({
        search: search.trim() || undefined,
        include_inactive: showInactive || undefined,
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

  const newImagePreview = useMemo(
    () => (newImage ? URL.createObjectURL(newImage) : null),
    [newImage],
  )
  const editImagePreview = useMemo(
    () => (editImage ? URL.createObjectURL(editImage) : null),
    [editImage],
  )

  useEffect(() => {
    if (!newImagePreview) return
    return () => URL.revokeObjectURL(newImagePreview)
  }, [newImagePreview])

  useEffect(() => {
    if (!editImagePreview) return
    return () => URL.revokeObjectURL(editImagePreview)
  }, [editImagePreview])

  const validateImage = (file: File): string | null => {
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      return 'Solo se permiten imágenes JPG o PNG.'
    }
    if (file.size > 2 * 1024 * 1024) {
      return 'La imagen supera el límite de 2 MB.'
    }
    return null
  }

  const handleNewImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    if (!file) {
      setNewImage(null)
      return
    }
    const error = validateImage(file)
    if (error) {
      setNewImage(null)
      setNewError(error)
      event.target.value = ''
      return
    }
    setNewError(null)
    setNewImage(file)
  }

  const handleEditImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    if (!file) {
      setEditImage(null)
      return
    }
    const error = validateImage(file)
    if (error) {
      setEditImage(null)
      setEditError(error)
      event.target.value = ''
      return
    }
    setEditError(null)
    setEditImage(file)
  }

  const invalidateInventory = () => {
    void queryClient.invalidateQueries({ queryKey: ['stock'] })
    void queryClient.invalidateQueries({ queryKey: ['kardex'] })
    void queryClient.invalidateQueries({ queryKey: ['products'] })
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const createMutation = useMutation({
    mutationFn: async ({
      payload,
      image,
    }: {
      payload: Parameters<typeof createQuickProduct>[0]
      image: File | null
    }) => {
      const product = await createQuickProduct(payload)
      if (!image) {
        return { product, imageError: null }
      }
      try {
        const updated = await replaceProductImage(product.id, image)
        return { product: updated, imageError: null }
      } catch (unknownError) {
        return { product, imageError: getApiErrorMessage(unknownError) }
      }
    },
    onSuccess: ({ product, imageError }) => {
      invalidateInventory()
      setNewOpen(false)
      setNewForm(emptyNewProduct())
      setNewImage(null)
      setNewError(null)
      setMessage(
        imageError
          ? `Producto "${product.name}" creado, pero la imagen no se pudo subir: ${imageError}`
          : `Producto "${product.name}" creado y agregado al inventario.`,
      )
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
    mutationFn: ({ productId, force }: { productId: number; force: boolean }) =>
      deleteProduct(productId, force),
    onSuccess: (response) => {
      invalidateInventory()
      setDeleteRow(null)
      setDeleteConfirm('')
      setDeleteError(null)
      setMessage(response.message)
      setActionError(null)
    },
    onError: (unknownError) => {
      setMessage(null)
      setDeleteError(getApiErrorMessage(unknownError))
    },
  })

  const activeMutation = useMutation({
    mutationFn: ({ row, isActive }: { row: CurrentStockRow; isActive: boolean }) =>
      patchProduct(row.product_id, { is_active: isActive }),
    onSuccess: (product) => {
      invalidateInventory()
      setDetailRow(null)
      setDeleteRow(null)
      setDeleteConfirm('')
      setDeleteError(null)
      setMessage(
        `Producto "${product.name}" ${product.is_active ? 'activado' : 'desactivado'} correctamente.`,
      )
      setActionError(null)
    },
    onError: (unknownError) => {
      const errorMessage = getApiErrorMessage(unknownError)
      if (deleteRow) {
        setDeleteError(errorMessage)
      } else {
        setMessage(null)
        setActionError(errorMessage)
      }
    },
  })

  const editMutation = useMutation({
    mutationFn: async ({
      productId,
      payload,
      image,
    }: {
      productId: number
      payload: Parameters<typeof patchProduct>[1]
      image: File | null
    }) => {
      const product = await patchProduct(productId, payload)
      if (!image) {
        return { product, imageError: null }
      }
      try {
        const updated = await replaceProductImage(productId, image)
        return { product: updated, imageError: null }
      } catch (unknownError) {
        return { product, imageError: getApiErrorMessage(unknownError) }
      }
    },
    onSuccess: ({ product, imageError }) => {
      invalidateInventory()
      setEditRow(null)
      setEditImage(null)
      setEditError(null)
      setActionError(null)
      setMessage(
        imageError
          ? `Producto "${product.name}" actualizado, pero la imagen no se pudo subir: ${imageError}`
          : `Producto "${product.name}" actualizado correctamente.`,
      )
    },
    onError: (unknownError) => setEditError(getApiErrorMessage(unknownError)),
  })

  const handleDelete = (row: CurrentStockRow) => {
    setDeleteRow(row)
    setDeleteConfirm('')
    setDeleteError(null)
    setMessage(null)
    setActionError(null)
  }

  const openNewProduct = () => {
    setNewForm(emptyNewProduct())
    setNewImage(null)
    setNewError(null)
    setNewOpen(true)
  }

  const closeNewProduct = () => {
    setNewOpen(false)
    setNewImage(null)
    setNewError(null)
  }

  const openEdit = (row: CurrentStockRow) => {
    setEditRow(row)
    setEditForm({
      name: row.product_name,
      sale_price_excl_tax: formatNumber(row.sale_price_excl_tax, 2),
      cost_price: formatNumber(row.cost_price, 2),
      vat_rate: row.vat_rate,
      sku: row.sku,
    })
    setEditImage(null)
    setEditError(null)
    setMessage(null)
    setActionError(null)
  }

  const submitEdit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editRow) return
    setEditError(null)

    const name = editForm.name.trim()
    const price = parseDecimal(editForm.sale_price_excl_tax)
    const cost = parseDecimal(editForm.cost_price)

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
      image: editImage,
    })
  }

  const submitNewProduct = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setNewError(null)

    const name = newForm.name.trim()
    const price = parseDecimal(newForm.sale_price_excl_tax)
    const quantity = parseDecimal(newForm.quantity)

    if (!name || Number.isNaN(price) || price < 0 || Number.isNaN(quantity) || quantity <= 0) {
      setNewError('Completa nombre, precio y una cantidad mayor a cero.')
      return
    }

    createMutation.mutate({
      payload: {
        name,
        quantity,
        sale_price_excl_tax: price,
        cost_price: parseDecimal(newForm.cost_price),
        vat_rate: Number(newForm.vat_rate),
        sku: newForm.sku.trim() || undefined,
      },
      image: newImage,
    })
  }

  const submitAddUnits = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!addRow) return
    setAddError(null)

    const quantity = parseDecimal(addQuantity)
    if (quantity <= 0) {
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
        Number(row.current_stock),
        Number(row.sold_quantity),
        row.sold_total,
        Number(row.min_stock),
      ]),
    )
  }

  const detailPrice = detailRow
    ? calculatePriceBreakdown(Number(detailRow.sale_price_excl_tax), detailRow.vat_rate)
    : null

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
              <Button type="button" onClick={openNewProduct}>
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
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-500">
              {dateFrom || dateTo
                ? 'Las columnas Vendidos y Total vendido corresponden al rango de fechas seleccionado.'
                : 'Las columnas Vendidos y Total vendido muestran el acumulado histórico.'}
            </p>
            <label className="inline-flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(event): void => setShowInactive(event.target.checked)}
              />
              Mostrar inactivos
            </label>
          </div>

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
                'Stock',
                'Vendidos',
                'Total vendido',
                'Precio final',
                'Estado',
                'Acciones',
              ]}
            >
              {stockQuery.data.map((row) => {
                const price = calculatePriceBreakdown(Number(row.sale_price_excl_tax), row.vat_rate)

                return (
                <tr key={`${row.product_id}-${row.warehouse_id}`}>
                  <td className="px-2.5 py-2 sm:px-3">
                    <div className="flex items-center gap-2">
                      <AuthenticatedImage
                        path={row.image_path}
                        alt={row.product_name}
                        className="h-9 w-9 rounded-md border border-slate-200 object-cover"
                        fallbackClassName="h-9 w-9 rounded-md border border-slate-200 bg-slate-50 text-[9px] text-slate-400"
                      />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-800">{row.product_name}</p>
                        <p className="text-xs text-slate-500">SKU: {row.sku}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-2.5 py-2 sm:px-3">{formatNumber(row.current_stock, 3)}</td>
                  <td className="px-2.5 py-2 sm:px-3">{formatNumber(row.sold_quantity, 3)}</td>
                  <td className="px-2.5 py-2 font-semibold sm:px-3">{formatCurrencyCOP(row.sold_total)}</td>
                  <td className="px-2.5 py-2 sm:px-3">
                    <p className="font-semibold text-slate-800">{formatCurrencyCOP(price.total)}</p>
                    <p className="text-[11px] text-slate-500">Base {formatCurrencyCOP(price.base)}</p>
                  </td>
                  <td className="px-2.5 py-2 sm:px-3">
                    <Badge
                      variant={!row.is_active ? 'default' : row.is_low_stock ? 'warning' : 'success'}
                    >
                      {!row.is_active ? 'Inactivo' : row.is_low_stock ? 'Bajo' : 'Normal'}
                    </Badge>
                  </td>
                  <td className="px-2.5 py-2 sm:px-3">
                    <div className="flex flex-nowrap items-center gap-1.5">
                      <Button
                        type="button"
                        variant="ghost"
                        className="px-2.5 py-1.5"
                        aria-label={`Ver detalle de ${row.product_name}`}
                        title="Ver detalle"
                        onClick={(): void => setDetailRow(row)}
                      >
                        <Eye size={14} />
                      </Button>
                      {canManage ? (
                        <>
                          {row.is_active ? (
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
                              <span className="ml-1 hidden xl:inline">Agregar</span>
                            </Button>
                          ) : null}
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
                          <Button
                            type="button"
                            variant="secondary"
                            className="px-2.5 py-1.5"
                            aria-label={`${row.is_active ? 'Desactivar' : 'Activar'} ${row.product_name}`}
                            title={row.is_active ? 'Desactivar producto' : 'Activar producto'}
                            disabled={activeMutation.isPending}
                            onClick={(): void => activeMutation.mutate({ row, isActive: !row.is_active })}
                          >
                            <Power size={14} />
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
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
                )
              })}
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
        onClose={closeNewProduct}
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
              label="Precio antes de IVA *"
              type="text"
              inputMode="decimal"
              value={newForm.sale_price_excl_tax}
              onChange={(event): void =>
                setNewForm((prev) => ({
                  ...prev,
                  sale_price_excl_tax: formatDecimalInput(event.target.value, 2),
                }))
              }
              placeholder="Ej. 12.500,50"
              helperText="Usa coma para decimales."
              required
            />
            <Input
              label="Cantidad inicial *"
              type="text"
              inputMode="decimal"
              value={newForm.quantity}
              onChange={(event): void =>
                setNewForm((prev) => ({ ...prev, quantity: formatDecimalInput(event.target.value, 3) }))
              }
              placeholder="Ej. 1,5"
              helperText="Hasta 3 decimales."
              required
            />
            <Input
              label="Costo unitario (solo una vez)"
              type="text"
              inputMode="decimal"
              value={newForm.cost_price}
              onChange={(event): void =>
                setNewForm((prev) => ({ ...prev, cost_price: formatDecimalInput(event.target.value, 2) }))
              }
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
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 md:col-span-2">
              <p className="text-sm font-medium text-slate-700">
                Imagen del producto (JPG o PNG, máximo 2 MB)
              </p>
              <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={handleNewImageChange}
                  className="text-sm"
                />
                {newImagePreview ? (
                  <img
                    src={newImagePreview}
                    alt="Vista previa del producto"
                    className="h-16 w-16 rounded-lg border border-slate-200 object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white text-[10px] text-slate-400">
                    Sin imagen
                  </div>
                )}
              </div>
              <p className="mt-2 text-xs text-slate-500">
                La imagen se verá en el POS y en la ventana de detalle.
              </p>
            </div>
            <PriceBreakdown
              basePrice={parseDecimal(newForm.sale_price_excl_tax)}
              vatRate={newForm.vat_rate}
              className="md:col-span-2"
            />
          </div>

          {newError ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {newError}
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={closeNewProduct}>
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
              type="text"
              inputMode="decimal"
              value={addQuantity}
              onChange={(event): void => setAddQuantity(formatDecimalInput(event.target.value, 3))}
              placeholder="Ej. 1,5"
              helperText="Hasta 3 decimales."
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
                label="Precio antes de IVA *"
                type="text"
                inputMode="decimal"
                value={editForm.sale_price_excl_tax}
                onChange={(event): void =>
                  setEditForm((prev) => ({
                    ...prev,
                    sale_price_excl_tax: formatDecimalInput(event.target.value, 2),
                  }))
                }
                placeholder="Ej. 12.500,50"
                helperText="Usa coma para decimales."
                required
              />
              <Input
                label="Costo unitario *"
                type="text"
                inputMode="decimal"
                value={editForm.cost_price}
                onChange={(event): void =>
                  setEditForm((prev) => ({
                    ...prev,
                    cost_price: formatDecimalInput(event.target.value, 2),
                  }))
                }
                placeholder="0"
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
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 md:col-span-2">
                <p className="text-sm font-medium text-slate-700">
                  Imagen del producto (JPG o PNG, máximo 2 MB)
                </p>
                <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
                  {editImagePreview ? (
                    <img
                      src={editImagePreview}
                      alt="Vista previa del producto"
                      className="h-16 w-16 rounded-lg border border-slate-200 object-cover"
                    />
                  ) : (
                    <AuthenticatedImage
                      path={editRow.image_path}
                      alt={editRow.product_name}
                      className="h-16 w-16 rounded-lg border border-slate-200 object-cover"
                      fallbackClassName="h-16 w-16 rounded-lg border border-dashed border-slate-300 bg-white text-[10px] text-slate-400"
                    />
                  )}
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={handleEditImageChange}
                    className="text-sm"
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Si seleccionas una nueva imagen, reemplazará la actual.
                </p>
              </div>
              <PriceBreakdown
                basePrice={parseDecimal(editForm.sale_price_excl_tax)}
                vatRate={editForm.vat_rate}
                className="md:col-span-2"
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

      <Modal
        open={detailRow !== null}
        onClose={(): void => setDetailRow(null)}
        title="Detalle del producto"
        description="Información completa sin saturar la tabla principal."
        className="max-w-xl"
      >
        {detailRow ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <AuthenticatedImage
                path={detailRow.image_path}
                alt={detailRow.product_name}
                className="h-16 w-16 rounded-lg border border-slate-200 object-cover"
                fallbackClassName="h-16 w-16 rounded-lg border border-dashed border-slate-300 bg-slate-50 text-[10px] text-slate-400"
              />
              <div>
                <p className="text-lg font-semibold text-slate-800">{detailRow.product_name}</p>
                <p className="text-sm text-slate-500">
                  SKU: {detailRow.sku} {detailRow.barcode ? `· Cod: ${detailRow.barcode}` : ''}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <div>
                <p className="text-xs text-slate-500">Bodega</p>
                <p className="font-semibold text-slate-800">{detailRow.warehouse_name}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Estado</p>
                <Badge
                  variant={!detailRow.is_active ? 'default' : detailRow.is_low_stock ? 'warning' : 'success'}
                >
                  {!detailRow.is_active ? 'Inactivo' : detailRow.is_low_stock ? 'Stock bajo' : 'Normal'}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-slate-500">Precio antes de IVA</p>
                <p className="font-semibold text-slate-800">
                  {formatCurrencyCOP(detailRow.sale_price_excl_tax)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">
                  IVA ({formatNumber(Number(detailRow.vat_rate) * 100, 0)}%)
                </p>
                <p className="font-semibold text-slate-800">{formatCurrencyCOP(detailPrice?.vat ?? 0)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Precio total de venta</p>
                <p className="font-semibold text-slate-800">
                  {formatCurrencyCOP(detailPrice?.total ?? 0)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Costo</p>
                <p className="font-semibold text-slate-800">{formatCurrencyCOP(detailRow.cost_price)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Stock actual</p>
                <p className="text-lg font-bold text-slate-800">{formatNumber(detailRow.current_stock, 3)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Stock mínimo</p>
                <p className="font-semibold text-slate-800">{formatNumber(detailRow.min_stock, 3)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Vendidos</p>
                <p className="font-semibold text-slate-800">{formatNumber(detailRow.sold_quantity, 3)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Total vendido</p>
                <p className="font-semibold text-slate-800">{formatCurrencyCOP(detailRow.sold_total)}</p>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              {canManage ? (
                <>
                  {detailRow.is_active ? (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={(): void => {
                        setAddRow(detailRow)
                        setAddQuantity('1')
                        setDetailRow(null)
                      }}
                    >
                      <PackagePlus size={16} className="mr-1" />
                      Agregar unidades
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    onClick={(): void => {
                      openEdit(detailRow)
                      setDetailRow(null)
                    }}
                  >
                    <Pencil size={16} className="mr-1" />
                    Editar
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={activeMutation.isPending}
                    onClick={(): void =>
                      activeMutation.mutate({ row: detailRow, isActive: !detailRow.is_active })
                    }
                  >
                    <Power size={16} className="mr-1" />
                    {detailRow.is_active ? 'Desactivar' : 'Activar'}
                  </Button>
                  {isAdmin ? (
                    <Button
                      type="button"
                      variant="danger"
                      onClick={(): void => {
                        handleDelete(detailRow)
                        setDetailRow(null)
                      }}
                    >
                      <Trash2 size={16} className="mr-1" />
                      Eliminar
                    </Button>
                  ) : null}
                </>
              ) : null}
              <Button type="button" variant="ghost" onClick={(): void => setDetailRow(null)}>
                Cerrar
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={deleteRow !== null}
        onClose={(): void => {
          setDeleteRow(null)
          setDeleteConfirm('')
          setDeleteError(null)
        }}
        title="Eliminar producto"
        description="Puedes conservar el historial desactivándolo o borrarlo definitivamente."
        className="max-w-lg"
      >
        {deleteRow ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-semibold">{deleteRow.product_name}</p>
              <p className="mt-1">
                Si el producto tiene ventas, compras, ajustes o movimientos, primero puedes
                desactivarlo para que no vuelva a aparecer en el POS.
              </p>
            </div>

            {isAdmin ? (
              <>
                <p className="text-sm text-slate-600">
                  La eliminación definitiva borra también el historial de inventario y las ventas
                  asociadas. Úsala solo para productos de prueba o ventas registradas por error.
                </p>
                <Input
                  label='Escribe "ELIMINAR" para confirmar'
                  value={deleteConfirm}
                  onChange={(event): void => setDeleteConfirm(event.target.value)}
                  placeholder="ELIMINAR"
                />
              </>
            ) : (
              <p className="text-sm text-slate-600">
                Solo un administrador puede eliminar definitivamente un producto con historial.
              </p>
            )}

            {deleteError ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {deleteError}
              </div>
            ) : null}

            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={(): void => {
                  setDeleteRow(null)
                  setDeleteConfirm('')
                  setDeleteError(null)
                }}
              >
                Cancelar
              </Button>
              {deleteRow.is_active ? (
                <Button
                  type="button"
                  variant="secondary"
                  loading={activeMutation.isPending}
                  onClick={(): void => activeMutation.mutate({ row: deleteRow, isActive: false })}
                >
                  <Power size={16} className="mr-1" />
                  Desactivar
                </Button>
              ) : null}
              {isAdmin ? (
                <Button
                  type="button"
                  variant="danger"
                  loading={deleteMutation.isPending}
                  disabled={deleteConfirm.trim().toUpperCase() !== 'ELIMINAR'}
                  onClick={(): void =>
                    deleteMutation.mutate({ productId: deleteRow.product_id, force: true })
                  }
                >
                  <Trash2 size={16} className="mr-1" />
                  Eliminar definitivamente
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}

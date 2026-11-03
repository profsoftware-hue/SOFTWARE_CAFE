import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ImagePlus, Pencil, Plus, Search, Trash2, Zap } from 'lucide-react'
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'

import { getApiErrorMessage } from '@/api/client'
import { listCategories, listSuppliers, listWarehouses } from '@/api/catalogs'
import {
  createProduct,
  createQuickProduct,
  deleteProduct,
  listProducts,
  type ProductFormPayload,
  updateProduct,
} from '@/api/products'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { Loading } from '@/components/ui/Loading'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { Table } from '@/components/ui/Table'
import { downloadCsv } from '@/lib/csv'
import { formatCurrencyCOP, formatDateTime, formatNumber } from '@/lib/format'
import type { Product } from '@/types/api'

interface ProductFormState {
  sku: string
  barcode: string
  name: string
  description: string
  category_id: string
  supplier_id: string
  unit: string
  cost_price: string
  sale_price_excl_tax: string
  vat_rate: string
  min_stock: string
  is_active: boolean
  remove_image: boolean
}

const createEmptyFormState = (): ProductFormState => ({
  sku: '',
  barcode: '',
  name: '',
  description: '',
  category_id: '',
  supplier_id: '',
  unit: 'UND',
  cost_price: '0',
  sale_price_excl_tax: '0',
  vat_rate: '0.19',
  min_stock: '0',
  is_active: true,
  remove_image: false,
})

const createFormStateFromProduct = (product: Product): ProductFormState => ({
  sku: product.sku,
  barcode: product.barcode ?? '',
  name: product.name,
  description: product.description ?? '',
  category_id: product.category_id ? String(product.category_id) : '',
  supplier_id: product.supplier_id ? String(product.supplier_id) : '',
  unit: product.unit,
  cost_price: String(product.cost_price),
  sale_price_excl_tax: String(product.sale_price_excl_tax),
  vat_rate: String(product.vat_rate),
  min_stock: String(product.min_stock),
  is_active: product.is_active,
  remove_image: false,
})

const toPayload = (form: ProductFormState, imageFile: File | null): ProductFormPayload => ({
  sku: form.sku.trim(),
  barcode: form.barcode.trim() || undefined,
  name: form.name.trim(),
  description: form.description.trim() || undefined,
  category_id: form.category_id ? Number(form.category_id) : undefined,
  supplier_id: form.supplier_id ? Number(form.supplier_id) : undefined,
  unit: form.unit.trim() || 'UND',
  cost_price: form.cost_price,
  sale_price_excl_tax: form.sale_price_excl_tax,
  vat_rate: form.vat_rate,
  min_stock: form.min_stock,
  is_active: form.is_active,
  image: imageFile,
  remove_image: form.remove_image,
})

export const ProductsPage = () => {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [supplierFilter, setSupplierFilter] = useState('')

  const [openModal, setOpenModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [form, setForm] = useState<ProductFormState>(() => createEmptyFormState())
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const [quickOpen, setQuickOpen] = useState(false)
  const [quickError, setQuickError] = useState<string | null>(null)
  const [quickForm, setQuickForm] = useState({
    name: '',
    quantity: '1',
    sku: '',
    sale_price_excl_tax: '0',
    vat_rate: '0.19',
    warehouse_id: '',
  })

  const categoriesQuery = useQuery({ queryKey: ['categories'], queryFn: listCategories })
  const suppliersQuery = useQuery({ queryKey: ['suppliers'], queryFn: listSuppliers })
  const warehousesQuery = useQuery({ queryKey: ['warehouses'], queryFn: listWarehouses })

  const productsQuery = useQuery({
    queryKey: ['products', search, categoryFilter, supplierFilter],
    queryFn: () =>
      listProducts({
        search: search.trim() || undefined,
        category_id: categoryFilter ? Number(categoryFilter) : undefined,
        supplier_id: supplierFilter ? Number(supplierFilter) : undefined,
        limit: 500,
      }),
  })

  const upsertMutation = useMutation({
    mutationFn: async (payload: ProductFormPayload) => {
      if (editingProduct) {
        return updateProduct(editingProduct.id, payload)
      }
      return createProduct(payload)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['products'] })
      setOpenModal(false)
      setEditingProduct(null)
      setForm(createEmptyFormState())
      setImageFile(null)
      setFormError(null)
      setSuccessMessage('Producto guardado correctamente.')
    },
    onError: (unknownError) => {
      setFormError(getApiErrorMessage(unknownError))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (productId: number) => deleteProduct(productId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['products'] })
      setActionError(null)
      setSuccessMessage('Producto eliminado correctamente.')
    },
    onError: (unknownError) => {
      setSuccessMessage(null)
      setActionError(getApiErrorMessage(unknownError))
    },
  })

  const quickMutation = useMutation({
    mutationFn: createQuickProduct,
    onSuccess: (product) => {
      void queryClient.invalidateQueries({ queryKey: ['products'] })
      void queryClient.invalidateQueries({ queryKey: ['stock'] })
      void queryClient.invalidateQueries({ queryKey: ['kardex'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      setQuickOpen(false)
      setQuickError(null)
      setQuickForm({
        name: '',
        quantity: '1',
        sku: '',
        sale_price_excl_tax: '0',
        vat_rate: '0.19',
        warehouse_id: '',
      })
      setActionError(null)
      setSuccessMessage(`Producto "${product.name}" agregado al inventario con SKU ${product.sku}.`)
    },
    onError: (unknownError) => {
      setQuickError(getApiErrorMessage(unknownError))
    },
  })

  const handleQuickSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setQuickError(null)

    const quantity = Number(quickForm.quantity)
    if (!quickForm.name.trim() || Number.isNaN(quantity) || quantity <= 0) {
      setQuickError('Ingresa el nombre y una cantidad mayor a cero.')
      return
    }

    quickMutation.mutate({
      name: quickForm.name.trim(),
      quantity,
      sku: quickForm.sku.trim() || undefined,
      sale_price_excl_tax: Number(quickForm.sale_price_excl_tax) || 0,
      vat_rate: Number(quickForm.vat_rate),
      warehouse_id: quickForm.warehouse_id ? Number(quickForm.warehouse_id) : undefined,
    })
  }

  const handleDelete = (product: Product) => {
    const confirmed = window.confirm(
      `¿Eliminar el producto "${product.name}" (${product.sku})?\n\nEsta acción no se puede deshacer.`,
    )
    if (confirmed) {
      deleteMutation.mutate(product.id)
    }
  }

  const imagePreviewUrl = useMemo(() => {
    if (imageFile) {
      return URL.createObjectURL(imageFile)
    }
    return editingProduct?.image_url ?? null
  }, [editingProduct?.image_url, imageFile])

  const openCreateModal = () => {
    setEditingProduct(null)
    setForm(createEmptyFormState())
    setImageFile(null)
    setFormError(null)
    setSuccessMessage(null)
    setOpenModal(true)
  }

  const openEditModal = (product: Product) => {
    setEditingProduct(product)
    setForm(createFormStateFromProduct(product))
    setImageFile(null)
    setFormError(null)
    setSuccessMessage(null)
    setOpenModal(true)
  }

  useEffect(() => {
    if (!imageFile || !imagePreviewUrl) {
      return
    }
    return () => {
      URL.revokeObjectURL(imagePreviewUrl)
    }
  }, [imageFile, imagePreviewUrl])

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null
    setImageFile(nextFile)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)

    const payload = toPayload(form, imageFile)
    upsertMutation.mutate(payload)
  }

  const exportProducts = () => {
    if (!productsQuery.data || productsQuery.data.length === 0) return

    downloadCsv(
      'ccp_pereira_productos.csv',
      ['SKU', 'Código barras', 'Nombre', 'Costo', 'Precio sin IVA', 'IVA', 'Precio final', 'Activo'],
      productsQuery.data.map((product) => [
        product.sku,
        product.barcode,
        product.name,
        product.cost_price,
        product.sale_price_excl_tax,
        product.vat_rate,
        product.final_price_incl_tax,
        product.is_active,
      ]),
    )
  }

  return (
    <div className="space-y-5">
      <Card
        title="Gestión de productos"
        subtitle="Carga imágenes, define IVA por producto y controla catálogo"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" onClick={exportProducts}>
              Exportar CSV
            </Button>
            <Button type="button" variant="secondary" onClick={(): void => setQuickOpen(true)}>
              <Zap size={16} className="mr-1.5" />
              Producto rápido
            </Button>
            <Button type="button" onClick={openCreateModal}>
              <Plus size={16} className="mr-1.5" />
              Nuevo producto
            </Button>
          </div>
        }
      >
        <div className="grid gap-3 md:grid-cols-3">
          <Input
            label="Buscar"
            placeholder="SKU, código de barras o nombre"
            value={search}
            onChange={(event): void => setSearch(event.target.value)}
          />

          <Select
            label="Categoría"
            value={categoryFilter}
            onChange={(event): void => setCategoryFilter(event.target.value)}
          >
            <option value="">Todas</option>
            {categoriesQuery.data?.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>

          <Select
            label="Proveedor"
            value={supplierFilter}
            onChange={(event): void => setSupplierFilter(event.target.value)}
          >
            <option value="">Todos</option>
            {suppliersQuery.data?.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </Select>
        </div>

        {successMessage ? (
          <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {successMessage}
          </div>
        ) : null}

        {actionError ? (
          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {actionError}
          </div>
        ) : null}
      </Card>

      {productsQuery.isLoading ? <Loading message="Cargando productos..." /> : null}

      {!productsQuery.isLoading && (!productsQuery.data || productsQuery.data.length === 0) ? (
        <EmptyState title="No hay productos" description="Crea tu primer producto para empezar a vender." />
      ) : null}

      {productsQuery.data && productsQuery.data.length > 0 ? (
        <Card>
          <Table
            columns={[
              'Imagen',
              'SKU / Código',
              'Producto',
              { label: 'Costo', className: 'hidden lg:table-cell' },
              { label: 'Precio sin IVA', className: 'hidden xl:table-cell' },
              { label: 'IVA', className: 'hidden sm:table-cell' },
              'Precio final',
              { label: 'Actualizado', className: 'hidden 2xl:table-cell' },
              'Acciones',
            ]}
          >
            {productsQuery.data.map((product) => (
              <tr key={product.id}>
                <td className="px-2.5 py-2 sm:px-3">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="h-10 w-10 rounded-md border border-slate-200 object-cover sm:h-12 sm:w-12"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-xs text-slate-400 sm:h-12 sm:w-12">
                      <ImagePlus size={16} />
                    </div>
                  )}
                </td>
                <td className="px-2.5 py-2 sm:px-3">
                  <p className="font-semibold text-slate-800">{product.sku}</p>
                  <p className="text-xs text-slate-500">{product.barcode ?? 'Sin código'}</p>
                </td>
                <td className="px-2.5 py-2 sm:px-3">
                  <p className="font-medium text-slate-800">{product.name}</p>
                  <p className="line-clamp-1 text-xs text-slate-500">
                    {product.description ?? 'Sin descripción'}
                  </p>
                </td>
                <td className="hidden px-3 py-2 lg:table-cell">{formatCurrencyCOP(product.cost_price)}</td>
                <td className="hidden px-3 py-2 xl:table-cell">
                  {formatCurrencyCOP(product.sale_price_excl_tax)}
                </td>
                <td className="hidden px-3 py-2 sm:table-cell">
                  {formatNumber(Number(product.vat_rate) * 100, 0)}%
                </td>
                <td className="px-2.5 py-2 font-semibold sm:px-3">
                  {formatCurrencyCOP(product.final_price_incl_tax)}
                </td>
                <td className="hidden px-3 py-2 text-xs text-slate-500 2xl:table-cell">
                  {formatDateTime(product.updated_at)}
                </td>
                <td className="px-2.5 py-2 sm:px-3">
                  <div className="flex flex-nowrap gap-1.5">
                    <Button
                      type="button"
                      variant="secondary"
                      className="px-2.5 py-1.5"
                      onClick={(): void => openEditModal(product)}
                    >
                      <Pencil size={14} />
                      <span className="ml-1 hidden sm:inline">Editar</span>
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      className="px-2.5 py-1.5"
                      disabled={deleteMutation.isPending}
                      onClick={(): void => handleDelete(product)}
                    >
                      <Trash2 size={14} />
                      <span className="ml-1 hidden sm:inline">Eliminar</span>
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      ) : null}

      <Modal
        open={quickOpen}
        onClose={(): void => setQuickOpen(false)}
        title="Producto rápido"
        description="Solo necesitas el nombre y la cantidad. El código se genera automático si lo dejas vacío."
        className="max-w-xl"
      >
        <form className="space-y-4" onSubmit={handleQuickSubmit}>
          <Input
            label="Nombre del producto *"
            value={quickForm.name}
            onChange={(event): void => setQuickForm((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="Ej. Café molido 500 g"
            required
          />

          <div className="grid gap-3 md:grid-cols-2">
            <Input
              label="Cantidad inicial *"
              type="number"
              min="0.001"
              step="0.001"
              value={quickForm.quantity}
              onChange={(event): void => setQuickForm((prev) => ({ ...prev, quantity: event.target.value }))}
              required
            />
            <Select
              label="Bodega"
              value={quickForm.warehouse_id}
              onChange={(event): void => setQuickForm((prev) => ({ ...prev, warehouse_id: event.target.value }))}
            >
              <option value="">Bodega principal</option>
              {warehousesQuery.data?.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </Select>
            <Input
              label="SKU / código (opcional)"
              value={quickForm.sku}
              onChange={(event): void => setQuickForm((prev) => ({ ...prev, sku: event.target.value }))}
              placeholder="Se genera automático"
            />
            <Input
              label="Precio de venta (opcional)"
              type="number"
              min="0"
              step="0.01"
              value={quickForm.sale_price_excl_tax}
              onChange={(event): void =>
                setQuickForm((prev) => ({ ...prev, sale_price_excl_tax: event.target.value }))
              }
            />
            <Select
              label="IVA"
              value={quickForm.vat_rate}
              onChange={(event): void => setQuickForm((prev) => ({ ...prev, vat_rate: event.target.value }))}
            >
              <option value="0.19">19% General</option>
              <option value="0.05">5% Reducida</option>
              <option value="0">0% Exento</option>
            </Select>
          </div>

          {quickError ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {quickError}
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={(): void => setQuickOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={quickMutation.isPending}>
              <Zap size={16} className="mr-1" />
              Agregar al inventario
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={openModal}
        onClose={(): void => setOpenModal(false)}
        title={editingProduct ? 'Editar producto' : 'Crear producto'}
        description="Nombre e imagen son suficientes; el SKU se genera automático si lo dejas vacío."
      >
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              label="SKU (opcional)"
              value={form.sku}
              onChange={(event): void => setForm((prev) => ({ ...prev, sku: event.target.value }))}
              placeholder="Se genera automático"
            />
            <Input
              label="Código de barras"
              value={form.barcode}
              onChange={(event): void => setForm((prev) => ({ ...prev, barcode: event.target.value }))}
            />
            <Input
              label="Nombre"
              value={form.name}
              onChange={(event): void => setForm((prev) => ({ ...prev, name: event.target.value }))}
              required
            />
            <Input
              label="Unidad"
              value={form.unit}
              onChange={(event): void => setForm((prev) => ({ ...prev, unit: event.target.value }))}
            />
            <Select
              label="Categoría"
              value={form.category_id}
              onChange={(event): void => setForm((prev) => ({ ...prev, category_id: event.target.value }))}
            >
              <option value="">Sin categoría</option>
              {categoriesQuery.data?.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
            <Select
              label="Proveedor"
              value={form.supplier_id}
              onChange={(event): void => setForm((prev) => ({ ...prev, supplier_id: event.target.value }))}
            >
              <option value="">Sin proveedor</option>
              {suppliersQuery.data?.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </Select>
            <Input
              label="Costo"
              type="number"
              step="0.01"
              min="0"
              value={form.cost_price}
              onChange={(event): void => setForm((prev) => ({ ...prev, cost_price: event.target.value }))}
              required
            />
            <Input
              label="Precio venta sin IVA"
              type="number"
              step="0.01"
              min="0"
              value={form.sale_price_excl_tax}
              onChange={(event): void =>
                setForm((prev) => ({ ...prev, sale_price_excl_tax: event.target.value }))
              }
              required
            />
            <Select
              label="Tarifa IVA"
              value={form.vat_rate}
              onChange={(event): void => setForm((prev) => ({ ...prev, vat_rate: event.target.value }))}
            >
              <option value="0.19">19% General</option>
              <option value="0.05">5% Reducida</option>
              <option value="0">0% Exento</option>
            </Select>
            <Input
              label="Stock mínimo"
              type="number"
              step="0.001"
              min="0"
              value={form.min_stock}
              onChange={(event): void => setForm((prev) => ({ ...prev, min_stock: event.target.value }))}
              required
            />
          </div>

          <Input
            label="Descripción"
            value={form.description}
            onChange={(event): void => setForm((prev) => ({ ...prev, description: event.target.value }))}
          />

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-medium text-slate-700">Imagen del producto (JPG/PNG, máximo 2 MB)</p>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                type="file"
                accept="image/png,image/jpeg"
                onChange={handleImageChange}
                className="text-sm"
              />
              {editingProduct?.image_url ? (
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={form.remove_image}
                    onChange={(event): void =>
                      setForm((prev) => ({ ...prev, remove_image: event.target.checked }))
                    }
                  />
                  Remover imagen actual
                </label>
              ) : null}
            </div>
            {imagePreviewUrl ? (
              <img
                src={imagePreviewUrl}
                alt="Vista previa"
                className="mt-3 h-28 w-28 rounded-lg border border-slate-200 object-cover"
              />
            ) : null}
          </div>

          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(event): void => setForm((prev) => ({ ...prev, is_active: event.target.checked }))}
            />
            Producto activo
          </label>

          {formError ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {formError}
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={(): void => setOpenModal(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={upsertMutation.isPending}>
              <Search size={16} className="mr-1" />
              Guardar producto
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

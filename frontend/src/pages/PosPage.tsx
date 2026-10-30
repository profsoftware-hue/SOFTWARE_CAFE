import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'

import { getApiErrorMessage } from '@/api/client'
import { listCustomers, listWarehouses } from '@/api/catalogs'
import { createSale, getPosQuote, getSaleReceipt } from '@/api/inventory'
import { listProducts } from '@/api/products'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Table } from '@/components/ui/Table'
import { AuthenticatedImage } from '@/components/AuthenticatedImage'
import { ReceiptModal } from '@/components/ReceiptModal'
import { formatCurrencyCOP, formatNumber } from '@/lib/format'
import type { Product } from '@/types/api'

interface CartItem {
  product: Product
  quantity: number
  unitPriceExclTax: number
}

const toCartMapKey = (productId: number) => String(productId)

export const PosPage = () => {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'TRANSFER' | 'MIXED' | 'CREDIT'>('CASH')
  const [note, setNote] = useState('')
  const [cart, setCart] = useState<Record<string, CartItem>>({})
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [receiptSaleId, setReceiptSaleId] = useState<number | null>(null)

  const productsQuery = useQuery({
    queryKey: ['products', 'pos'],
    queryFn: () => listProducts({ is_active: true, limit: 500 }),
  })
  const warehousesQuery = useQuery({ queryKey: ['warehouses'], queryFn: listWarehouses })
  const customersQuery = useQuery({ queryKey: ['customers'], queryFn: listCustomers })

  const defaultWarehouse = warehousesQuery.data?.find((warehouse) => warehouse.is_default) ?? warehousesQuery.data?.[0]
  const selectedWarehouseId = warehouseId || (defaultWarehouse ? String(defaultWarehouse.id) : '')

  const cartItems = useMemo(() => Object.values(cart), [cart])

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return productsQuery.data ?? []

    return (productsQuery.data ?? []).filter((product) => {
      const values = [product.name, product.sku, product.barcode ?? '']
      return values.some((value) => value.toLowerCase().includes(term))
    })
  }, [productsQuery.data, search])

  const quoteMutation = useMutation({
    mutationFn: getPosQuote,
    onError: (unknownError) => setError(getApiErrorMessage(unknownError)),
  })

  const saleMutation = useMutation({
    mutationFn: createSale,
    onSuccess: (response) => {
      setMessage('Venta registrada correctamente.')
      setReceiptSaleId(response.id)
      setError(null)
      setCart({})
      setNote('')
      quoteMutation.reset()
      void queryClient.invalidateQueries({ queryKey: ['stock'] })
      void queryClient.invalidateQueries({ queryKey: ['kardex'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (unknownError) => {
      setMessage(null)
      setError(getApiErrorMessage(unknownError))
    },
  })

  const receiptQuery = useQuery({
    queryKey: ['sale-receipt', receiptSaleId],
    queryFn: () => getSaleReceipt(receiptSaleId as number),
    enabled: receiptSaleId !== null,
  })

  const addToCart = (product: Product) => {
    setMessage(null)
    setError(null)
    setCart((prev) => {
      const key = toCartMapKey(product.id)
      const current = prev[key]

      if (current) {
        return {
          ...prev,
          [key]: {
            ...current,
            quantity: current.quantity + 1,
          },
        }
      }

      return {
        ...prev,
        [key]: {
          product,
          quantity: 1,
          unitPriceExclTax: Number(product.sale_price_excl_tax),
        },
      }
    })
  }

  const updateQuantity = (productId: number, nextQuantity: number) => {
    setCart((prev) => {
      const key = toCartMapKey(productId)
      const current = prev[key]
      if (!current) return prev

      if (nextQuantity <= 0) {
        const { [key]: _, ...rest } = prev
        return rest
      }

      return {
        ...prev,
        [key]: {
          ...current,
          quantity: nextQuantity,
        },
      }
    })
  }

  const removeFromCart = (productId: number) => {
    setCart((prev) => {
      const key = toCartMapKey(productId)
      const { [key]: _, ...rest } = prev
      return rest
    })
  }

  const recalculate = () => {
    setError(null)
    if (cartItems.length === 0) {
      setError('Agrega al menos un producto al carrito.')
      return
    }

    quoteMutation.mutate({
      items: cartItems.map((item) => ({
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price_excl_tax: item.unitPriceExclTax,
      })),
    })
  }

  const checkout = () => {
    setError(null)
    setMessage(null)

    if (!selectedWarehouseId) {
      setError('Selecciona la bodega para la venta.')
      return
    }
    if (cartItems.length === 0) {
      setError('El carrito está vacío.')
      return
    }

    saleMutation.mutate({
      warehouse_id: Number(selectedWarehouseId),
      customer_id: customerId ? Number(customerId) : null,
      payment_method: paymentMethod,
      note: note.trim() || null,
      items: cartItems.map((item) => ({
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price_excl_tax: item.unitPriceExclTax,
      })),
      confirm: true,
    })
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
      <Card title="Punto de venta (POS)" subtitle="Busca productos por nombre, SKU o código de barras">
        <Input
          label="Buscar producto"
          value={search}
          onChange={(event): void => setSearch(event.target.value)}
          placeholder="Ej. Café, SKU-001, 770..."
        />

        <div className="mt-4 max-h-[60vh] space-y-2 overflow-auto pr-1 scrollbar-thin">
          {filteredProducts.length === 0 ? (
            <EmptyState
              title="No se encontraron productos"
              description="Cambia la búsqueda o crea productos en el módulo de catálogo."
            />
          ) : (
            filteredProducts.map((product) => (
              <article
                key={product.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3"
              >
                <div className="flex items-center gap-3">
                  <AuthenticatedImage
                    path={product.image_url}
                    alt={product.name}
                    className="h-14 w-14 rounded-lg border border-slate-200 object-cover"
                    fallbackClassName="h-14 w-14 rounded-lg border border-slate-200"
                  />
                  <div>
                    <p className="font-semibold text-slate-800">{product.name}</p>
                    <p className="text-xs text-slate-500">
                      SKU: {product.sku} {product.barcode ? `| Cod: ${product.barcode}` : ''}
                    </p>
                    <p className="text-sm text-slate-700">{formatCurrencyCOP(product.final_price_incl_tax)}</p>
                  </div>
                </div>
                <Button type="button" onClick={(): void => addToCart(product)}>
                  <Plus size={16} className="mr-1" />
                  Agregar
                </Button>
              </article>
            ))
          )}
        </div>
      </Card>

      <Card
        title="Carrito"
        subtitle="Calcula subtotal, IVA y total"
        actions={
          <Badge variant="default">
            <ShoppingCart size={14} className="mr-1" />
            <span className="whitespace-nowrap">{cartItems.length} ítems</span>
          </Badge>
        }
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Select
            label="Bodega"
            value={selectedWarehouseId}
            onChange={(event): void => setWarehouseId(event.target.value)}
            required
          >
            <option value="">Selecciona bodega</option>
            {warehousesQuery.data?.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.name}
              </option>
            ))}
          </Select>

          <Select
            label="Cliente (opcional)"
            value={customerId}
            onChange={(event): void => setCustomerId(event.target.value)}
          >
            <option value="">Consumidor final</option>
            {customersQuery.data?.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </Select>
          <Select
            label="Método pago"
            value={paymentMethod}
            onChange={(event): void =>
              setPaymentMethod(
                event.target.value as 'CASH' | 'CARD' | 'TRANSFER' | 'MIXED' | 'CREDIT',
              )
            }
          >
            <option value="CASH">Efectivo</option>
            <option value="CARD">Tarjeta</option>
            <option value="TRANSFER">Transferencia</option>
            <option value="MIXED">Mixto</option>
            <option value="CREDIT">Crédito</option>
          </Select>
          <Input label="Nota" value={note} onChange={(event): void => setNote(event.target.value)} />
        </div>

        {cartItems.length === 0 ? (
          <EmptyState title="Carrito vacío" description="Agrega productos desde el panel izquierdo." />
        ) : (
          <Table className="mt-4" columns={['Producto', 'Cantidad', 'Precio sin IVA', 'Acciones']}>
            {cartItems.map((item) => (
              <tr key={item.product.id}>
                <td className="px-3 py-2.5">
                  <p className="font-medium text-slate-800">{item.product.name}</p>
                  <p className="text-xs text-slate-500">{item.product.sku}</p>
                </td>
                <td className="px-3 py-2.5">
                  <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1">
                    <button
                      type="button"
                      className="rounded p-1 text-slate-600 hover:bg-slate-100"
                      onClick={(): void => updateQuantity(item.product.id, item.quantity - 1)}
                    >
                      <Minus size={14} />
                    </button>
                    <span className="min-w-8 text-center text-sm font-semibold">{formatNumber(item.quantity, 3)}</span>
                    <button
                      type="button"
                      className="rounded p-1 text-slate-600 hover:bg-slate-100"
                      onClick={(): void => updateQuantity(item.product.id, item.quantity + 1)}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </td>
                <td className="px-3 py-2.5">{formatCurrencyCOP(item.unitPriceExclTax)}</td>
                <td className="px-3 py-2.5">
                  <Button type="button" variant="danger" onClick={(): void => removeFromCart(item.product.id)}>
                    <Trash2 size={14} />
                  </Button>
                </td>
              </tr>
            ))}
          </Table>
        )}

        {message ? (
          <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
        ) : null}

        {quoteMutation.data ? (
          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-slate-700">
            <div className="flex items-center justify-between">
              <span>Subtotal</span>
              <strong>{formatCurrencyCOP(quoteMutation.data.subtotal)}</strong>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span>IVA</span>
              <strong>{formatCurrencyCOP(quoteMutation.data.tax_total)}</strong>
            </div>
            <div className="mt-1 flex items-center justify-between text-base">
              <span>Total</span>
              <strong>{formatCurrencyCOP(quoteMutation.data.total)}</strong>
            </div>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={recalculate} loading={quoteMutation.isPending}>
            Recalcular
          </Button>
          <Button type="button" onClick={checkout} loading={saleMutation.isPending}>
            Confirmar venta
          </Button>
        </div>
      </Card>

      <ReceiptModal
        open={receiptSaleId !== null}
        receipt={receiptQuery.data ?? null}
        loading={receiptQuery.isLoading}
        onClose={(): void => setReceiptSaleId(null)}
      />
    </div>
  )
}

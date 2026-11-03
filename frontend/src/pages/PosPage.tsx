import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { History, Minus, Plus, ShoppingCart, Trash2, UserPlus } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'

import { getApiErrorMessage } from '@/api/client'
import {
  createCustomer,
  listWarehouses,
  lookupCustomer,
  type CustomerCreatePayload,
} from '@/api/catalogs'
import { createSale, getSaleReceipt, listRecentSales } from '@/api/inventory'
import { listProducts } from '@/api/products'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { Table } from '@/components/ui/Table'
import { AuthenticatedImage } from '@/components/AuthenticatedImage'
import { ReceiptModal } from '@/components/ReceiptModal'
import { CUSTOMER_TYPE_OPTIONS, DOCUMENT_TYPE_OPTIONS, formatDocument } from '@/lib/customers'
import {
  formatCurrencyCOP,
  formatDateTime,
  formatNumber,
  formatThousands,
  parseThousands,
} from '@/lib/format'
import { PAYMENT_METHOD_LABELS, PAYMENT_METHOD_OPTIONS } from '@/lib/payments'
import type { Customer, CustomerType, DocumentType, PaymentMethod, Product } from '@/types/api'

interface CartItem {
  product: Product
  quantity: number
  unitPriceExclTax: number
}

type CustomerMode = 'FINAL' | 'CUSTOMER'

interface CustomerFormState {
  customer_type: CustomerType
  first_name: string
  last_name: string
  business_name: string
  document_type: DocumentType
  document_number: string
  email: string
  phone: string
  address: string
}

const emptyCustomerForm = (): CustomerFormState => ({
  customer_type: 'NATURAL',
  first_name: '',
  last_name: '',
  business_name: '',
  document_type: 'CC',
  document_number: '',
  email: '',
  phone: '',
  address: '',
})

const toCartMapKey = (productId: number) => String(productId)

export const PosPage = () => {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [customerMode, setCustomerMode] = useState<CustomerMode>('FINAL')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [lookupDocType, setLookupDocType] = useState<DocumentType>('CC')
  const [lookupDocNumber, setLookupDocNumber] = useState('')
  const [lookupMessage, setLookupMessage] = useState<string | null>(null)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [lookupNotFound, setLookupNotFound] = useState(false)
  const [invoiceRequested, setInvoiceRequested] = useState(false)
  const [customerModalOpen, setCustomerModalOpen] = useState(false)
  const [customerForm, setCustomerForm] = useState<CustomerFormState>(() => emptyCustomerForm())
  const [customerFormError, setCustomerFormError] = useState<string | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH')
  const [cashReceived, setCashReceived] = useState('')
  const [note, setNote] = useState('')
  const [cart, setCart] = useState<Record<string, CartItem>>({})
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [receiptSaleId, setReceiptSaleId] = useState<number | null>(null)
  const [recentOpen, setRecentOpen] = useState(false)

  const productsQuery = useQuery({
    queryKey: ['products', 'pos'],
    queryFn: () => listProducts({ is_active: true, limit: 500 }),
  })
  const warehousesQuery = useQuery({ queryKey: ['warehouses'], queryFn: listWarehouses })

  const defaultWarehouse = warehousesQuery.data?.find((warehouse) => warehouse.is_default) ?? warehousesQuery.data?.[0]
  const selectedWarehouseId = warehouseId || (defaultWarehouse ? String(defaultWarehouse.id) : '')

  const cartItems = useMemo(() => Object.values(cart), [cart])
  const cartTotals = useMemo(() => {
    let subtotal = 0
    let tax = 0
    for (const item of cartItems) {
      const lineSubtotal = Math.round(item.quantity * item.unitPriceExclTax * 100) / 100
      const lineTax = Math.round(lineSubtotal * Number(item.product.vat_rate) * 100) / 100
      subtotal += lineSubtotal
      tax += lineTax
    }
    return { subtotal, tax, total: subtotal + tax }
  }, [cartItems])
  const cashReceivedNumber = parseThousands(cashReceived)
  const changeDue = cashReceivedNumber - cartTotals.total

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return productsQuery.data ?? []

    return (productsQuery.data ?? []).filter((product) => {
      const values = [product.name, product.sku, product.barcode ?? '']
      return values.some((value) => value.toLowerCase().includes(term))
    })
  }, [productsQuery.data, search])

  const lookupMutation = useMutation({
    mutationFn: ({
      documentType,
      documentNumber,
    }: {
      documentType: DocumentType
      documentNumber: string
    }) => lookupCustomer(documentType, documentNumber),
    onSuccess: (customer) => {
      setCustomerMode('CUSTOMER')
      setSelectedCustomer(customer)
      setInvoiceRequested(true)
      setLookupMessage(
        `Cliente encontrado: ${customer.name} · ${formatDocument(customer.document_type, customer.document_number)}`,
      )
      setLookupError(null)
      setLookupNotFound(false)
      setError(null)
    },
    onError: (unknownError) => {
      setSelectedCustomer(null)
      setLookupMessage(null)
      if (isAxiosError(unknownError) && unknownError.response?.status === 404) {
        setLookupNotFound(true)
        setLookupError(null)
      } else {
        setLookupNotFound(false)
        setLookupError(getApiErrorMessage(unknownError))
      }
    },
  })

  const customerMutation = useMutation({
    mutationFn: createCustomer,
    onSuccess: (customer) => {
      void queryClient.invalidateQueries({ queryKey: ['report'] })
      setCustomerMode('CUSTOMER')
      setSelectedCustomer(customer)
      setInvoiceRequested(true)
      setCustomerModalOpen(false)
      setCustomerForm(emptyCustomerForm())
      setCustomerFormError(null)
      setLookupDocType(customer.document_type)
      setLookupDocNumber(customer.document_number ?? '')
      setLookupMessage(`Cliente creado: ${customer.name} · ${formatDocument(customer.document_type, customer.document_number)}`)
      setLookupError(null)
      setLookupNotFound(false)
      setMessage(`Cliente "${customer.name}" creado para facturación electrónica.`)
      setError(null)
    },
    onError: (unknownError) => setCustomerFormError(getApiErrorMessage(unknownError)),
  })

  const saleMutation = useMutation({
    mutationFn: createSale,
    onSuccess: (response) => {
      setMessage('Venta registrada correctamente.')
      setReceiptSaleId(response.id)
      setError(null)
      setCart({})
      setNote('')
      setCashReceived('')
      setCustomerMode('FINAL')
      setSelectedCustomer(null)
      setLookupDocNumber('')
      setLookupMessage(null)
      setLookupError(null)
      setLookupNotFound(false)
      setInvoiceRequested(false)
      void queryClient.invalidateQueries({ queryKey: ['stock'] })
      void queryClient.invalidateQueries({ queryKey: ['kardex'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      void queryClient.invalidateQueries({ queryKey: ['report'] })
      void queryClient.invalidateQueries({ queryKey: ['recent-sales'] })
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

  const recentSalesQuery = useQuery({
    queryKey: ['recent-sales'],
    queryFn: () => listRecentSales(30),
    enabled: recentOpen,
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

  const changeCustomerMode = (mode: CustomerMode) => {
    setCustomerMode(mode)
    setLookupMessage(null)
    setLookupError(null)
    setLookupNotFound(false)
    if (mode === 'FINAL') {
      setSelectedCustomer(null)
      setInvoiceRequested(false)
      setLookupDocNumber('')
    }
  }

  const searchCustomer = () => {
    setLookupMessage(null)
    setLookupError(null)
    setLookupNotFound(false)
    const documentNumber = lookupDocNumber.trim()
    if (!documentNumber) {
      setLookupError('Ingresa la cédula, NIT o número de documento.')
      return
    }
    lookupMutation.mutate({ documentType: lookupDocType, documentNumber })
  }

  const openCustomerModal = () => {
    setCustomerForm({
      ...emptyCustomerForm(),
      document_type: lookupDocType,
      document_number: lookupDocNumber.trim(),
    })
    setCustomerFormError(null)
    setCustomerModalOpen(true)
  }

  const changeCustomerType = (customerType: CustomerType) => {
    setCustomerForm((previous) => ({
      ...previous,
      customer_type: customerType,
      document_type: customerType === 'COMPANY' ? 'NIT' : 'CC',
      first_name: customerType === 'NATURAL' ? previous.first_name : '',
      last_name: customerType === 'NATURAL' ? previous.last_name : '',
      business_name: customerType === 'COMPANY' ? previous.business_name : '',
    }))
  }

  const saveCustomer = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setCustomerFormError(null)

    if (
      customerForm.customer_type === 'NATURAL' &&
      (!customerForm.first_name.trim() || !customerForm.last_name.trim())
    ) {
      setCustomerFormError('Ingresa nombres y apellidos.')
      return
    }
    if (customerForm.customer_type === 'COMPANY' && !customerForm.business_name.trim()) {
      setCustomerFormError('Ingresa la razón social.')
      return
    }
    if (
      !customerForm.document_number.trim() ||
      !customerForm.email.trim() ||
      !customerForm.phone.trim()
    ) {
      setCustomerFormError('Documento, correo y teléfono son obligatorios para facturación.')
      return
    }

    const payload: CustomerCreatePayload = {
      customer_type: customerForm.customer_type,
      first_name: customerForm.customer_type === 'NATURAL' ? customerForm.first_name.trim() : null,
      last_name: customerForm.customer_type === 'NATURAL' ? customerForm.last_name.trim() : null,
      business_name: customerForm.customer_type === 'COMPANY' ? customerForm.business_name.trim() : null,
      document_type: customerForm.document_type,
      document_number: customerForm.document_number.trim(),
      email: customerForm.email.trim(),
      phone: customerForm.phone.trim(),
      address: customerForm.address.trim() || null,
    }
    customerMutation.mutate(payload)
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
    if (customerMode === 'CUSTOMER' && !selectedCustomer) {
      setError('Digita la cédula o NIT y busca el cliente antes de confirmar.')
      return
    }
    if (invoiceRequested && !selectedCustomer) {
      setError('Selecciona un cliente identificado para la factura electrónica.')
      return
    }
    if (paymentMethod === 'CASH' && cashReceived.trim() && changeDue < 0) {
      setError('El efectivo recibido es menor al total de la venta.')
      return
    }

    saleMutation.mutate({
      warehouse_id: Number(selectedWarehouseId),
      customer_id: selectedCustomer?.id ?? null,
      payment_method: paymentMethod,
      invoice_requested: invoiceRequested,
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

        <div className="mt-3 grid max-h-[calc(100vh-230px)] gap-2 overflow-auto pr-1 scrollbar-thin sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          {filteredProducts.length === 0 ? (
            <EmptyState
              title="No se encontraron productos"
              description="Cambia la búsqueda o crea productos en el módulo de catálogo."
            />
          ) : (
            filteredProducts.map((product) => (
              <article
                key={product.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-2.5"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <AuthenticatedImage
                    path={product.image_url}
                    alt={product.name}
                    className="h-10 w-10 rounded-md border border-slate-200 object-cover"
                    fallbackClassName="h-10 w-10 rounded-md border border-slate-200"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">{product.name}</p>
                    <p className="truncate text-[11px] text-slate-500">
                      {product.sku}{product.barcode ? ` · ${product.barcode}` : ''}
                    </p>
                    <p className="text-xs font-medium text-slate-700">
                      {formatCurrencyCOP(product.final_price_incl_tax)}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  className="shrink-0 px-2.5 py-1.5"
                  onClick={(): void => addToCart(product)}
                >
                  <Plus size={14} className="sm:mr-1" />
                  <span className="hidden sm:inline">Agregar</span>
                </Button>
              </article>
            ))
          )}
        </div>
      </Card>

      <Card
        title="Carrito"
        subtitle="Calcula subtotal, IVA y total"
        className="xl:sticky xl:top-4 xl:self-start"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" onClick={(): void => setRecentOpen(true)}>
              <History size={16} className="mr-1" />
              Últimas facturas
            </Button>
            <Badge variant="default">
              <ShoppingCart size={14} className="mr-1" />
              <span className="whitespace-nowrap">{cartItems.length} ítems</span>
            </Badge>
          </div>
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
            label="Cliente"
            value={customerMode}
            onChange={(event): void => changeCustomerMode(event.target.value as CustomerMode)}
          >
            <option value="FINAL">Consumidor final</option>
            <option value="CUSTOMER">Cliente con cédula o NIT</option>
          </Select>
          <Select
            label="Método pago"
            value={paymentMethod}
            onChange={(event): void => setPaymentMethod(event.target.value as PaymentMethod)}
          >
            {PAYMENT_METHOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <Input label="Nota" value={note} onChange={(event): void => setNote(event.target.value)} />

          {paymentMethod === 'CASH' ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 md:col-span-2">
              <p className="text-sm font-semibold text-slate-800">Caja registradora</p>
              <p className="text-xs text-slate-500">Calcula cuánto debes devolver al recibir efectivo.</p>
              <div className="mt-2 grid gap-3 sm:grid-cols-3">
                <Input
                  label="Efectivo recibido"
                  type="text"
                  inputMode="numeric"
                  value={cashReceived}
                  onChange={(event): void => setCashReceived(formatThousands(event.target.value))}
                  placeholder="Ej. 50.000"
                />
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <p className="text-xs text-slate-500">Total a cobrar</p>
                  <p className="text-lg font-bold text-slate-800">{formatCurrencyCOP(cartTotals.total)}</p>
                </div>
                <div
                  className={`rounded-lg border px-3 py-2 ${
                    !cashReceived.trim()
                      ? 'border-slate-200 bg-white'
                      : changeDue < 0
                        ? 'border-rose-200 bg-rose-50'
                        : 'border-emerald-200 bg-white'
                  }`}
                >
                  <p className="text-xs text-slate-500">
                    {cashReceived.trim() && changeDue < 0 ? 'Falta por cubrir' : 'Devuelta'}
                  </p>
                  <p className={`text-lg font-bold ${changeDue < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                    {!cashReceived.trim()
                      ? '—'
                      : formatCurrencyCOP(Math.abs(changeDue))}
                  </p>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {[10000, 20000, 50000, 100000].map((value) => (
                  <Button
                    key={value}
                    type="button"
                    variant="ghost"
                    onClick={(): void => setCashReceived(formatThousands(value))}
                  >
                    {formatCurrencyCOP(value)}
                  </Button>
                ))}
                <Button type="button" variant="ghost" onClick={(): void => setCashReceived('')}>
                  Limpiar
                </Button>
              </div>
            </div>
          ) : null}

          {customerMode === 'CUSTOMER' ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 md:col-span-2">
            <p className="text-sm font-semibold text-slate-800">Buscar tercero existente</p>
            <p className="text-xs text-slate-500">Consulta por cédula, NIT, CE, TI o PPT.</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] sm:items-end">
              <Select
                label="Tipo de documento"
                value={lookupDocType}
                onChange={(event): void => setLookupDocType(event.target.value as DocumentType)}
              >
                {DOCUMENT_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <Input
                label="Número de documento"
                value={lookupDocNumber}
                onChange={(event): void => setLookupDocNumber(event.target.value)}
                placeholder="Ej. 1098765432 o 900123456-7"
              />
              <Button
                type="button"
                variant="secondary"
                loading={lookupMutation.isPending}
                onClick={searchCustomer}
              >
                Buscar
              </Button>
            </div>
            {lookupMessage ? (
              <p className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                {lookupMessage}
              </p>
            ) : null}
            {lookupNotFound ? (
              <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                <span className="text-xs text-amber-800">No existe un cliente con ese documento.</span>
                <Button type="button" variant="secondary" onClick={openCustomerModal}>
                  <UserPlus size={14} className="mr-1" />
                  Crear con estos datos
                </Button>
              </div>
            ) : null}
            {lookupError ? (
              <p className="mt-2 text-xs text-rose-600">{lookupError}</p>
            ) : null}
            </div>
          ) : null}

          {customerMode === 'CUSTOMER' ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 md:col-span-2">
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={invoiceRequested}
                onChange={(event): void => setInvoiceRequested(event.target.checked)}
              />
              <span>
                <span className="block font-semibold text-slate-800">Requiere factura electrónica</span>
                <span className="block text-xs text-slate-500">
                  Guarda nombres, documento, correo y teléfono del tercero.
                </span>
              </span>
            </label>

            {invoiceRequested ? (
              <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-2">
                <Button type="button" variant="secondary" onClick={openCustomerModal}>
                  <UserPlus size={16} className="mr-1" />
                  Nuevo cliente factura
                </Button>
                {selectedCustomer ? (
                  <span className="text-xs text-slate-600">
                    {formatDocument(selectedCustomer.document_type, selectedCustomer.document_number) || '-'} ·{' '}
                    {selectedCustomer.email ?? 'sin correo'} · {selectedCustomer.phone ?? 'sin teléfono'}
                  </span>
                ) : (
                  <span className="text-xs text-amber-700">
                    Selecciona el cliente o créalo para continuar.
                  </span>
                )}
              </div>
            ) : null}
            </div>
          ) : null}
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
                    <span className="min-w-8 text-center text-sm font-semibold">{formatNumber(item.quantity, 0)}</span>
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

        {cartItems.length > 0 ? (
          <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-slate-700">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Subtotal</p>
              <p className="font-semibold">{formatCurrencyCOP(cartTotals.subtotal)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-500">IVA</p>
              <p className="font-semibold">{formatCurrencyCOP(cartTotals.tax)}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Total</p>
              <p className="text-base font-bold text-slate-900">{formatCurrencyCOP(cartTotals.total)}</p>
            </div>
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap justify-end gap-2">
          <Button type="button" onClick={checkout} loading={saleMutation.isPending}>
            Confirmar venta
          </Button>
        </div>
      </Card>

      <Modal
        open={customerModalOpen}
        onClose={(): void => setCustomerModalOpen(false)}
        title="Cliente para factura electrónica"
        description="Datos del tercero que solicita la factura."
      >
        <form className="space-y-4" onSubmit={saveCustomer}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label="Tipo de persona"
              value={customerForm.customer_type}
              onChange={(event): void => changeCustomerType(event.target.value as CustomerType)}
            >
              {CUSTOMER_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>

            {customerForm.customer_type === 'NATURAL' ? (
              <>
                <Input
                  label="Nombres"
                  value={customerForm.first_name}
                  onChange={(event): void =>
                    setCustomerForm((previous) => ({ ...previous, first_name: event.target.value }))
                  }
                  required
                />
                <Input
                  label="Apellidos"
                  value={customerForm.last_name}
                  onChange={(event): void =>
                    setCustomerForm((previous) => ({ ...previous, last_name: event.target.value }))
                  }
                  required
                />
              </>
            ) : (
              <Input
                label="Razón social"
                value={customerForm.business_name}
                onChange={(event): void =>
                  setCustomerForm((previous) => ({ ...previous, business_name: event.target.value }))
                }
                required
              />
            )}

            <Select
              label="Tipo de documento"
              value={customerForm.document_type}
              onChange={(event): void =>
                setCustomerForm((previous) => ({
                  ...previous,
                  document_type: event.target.value as DocumentType,
                }))
              }
            >
              {DOCUMENT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Input
              label="Número de documento"
              value={customerForm.document_number}
              onChange={(event): void =>
                setCustomerForm((previous) => ({ ...previous, document_number: event.target.value }))
              }
              required
            />
            <Input
              label="Correo electrónico"
              type="email"
              value={customerForm.email}
              onChange={(event): void =>
                setCustomerForm((previous) => ({ ...previous, email: event.target.value }))
              }
              required
            />
            <Input
              label="Teléfono"
              value={customerForm.phone}
              onChange={(event): void =>
                setCustomerForm((previous) => ({ ...previous, phone: event.target.value }))
              }
              required
            />
            <Input
              label="Dirección (opcional)"
              value={customerForm.address}
              onChange={(event): void =>
                setCustomerForm((previous) => ({ ...previous, address: event.target.value }))
              }
            />
          </div>

          {customerFormError ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {customerFormError}
            </div>
          ) : null}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={(): void => setCustomerModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={customerMutation.isPending}>
              Guardar cliente
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={recentOpen}
        onClose={(): void => setRecentOpen(false)}
        title="Últimas facturas"
        description="Abre el recibo de una venta reciente para imprimirlo nuevamente."
        className="max-w-4xl"
      >
        {recentSalesQuery.isLoading ? (
          <p className="text-sm text-slate-500">Cargando facturas recientes...</p>
        ) : null}
        {!recentSalesQuery.isLoading &&
        (!recentSalesQuery.data || recentSalesQuery.data.length === 0) ? (
          <EmptyState title="Sin facturas" description="Aún no hay ventas confirmadas." />
        ) : null}
        {recentSalesQuery.data && recentSalesQuery.data.length > 0 ? (
          <Table columns={['Fecha', 'Factura', 'Cliente', 'Pago', 'Total', 'Factura electrónica', 'Acción']}>
            {recentSalesQuery.data.map((sale) => (
              <tr key={sale.id}>
                <td className="px-3 py-2.5 text-xs text-slate-500">{formatDateTime(sale.sold_at)}</td>
                <td className="px-3 py-2.5 font-medium text-slate-800">{sale.sale_number}</td>
                <td className="px-3 py-2.5">{sale.customer_name ?? 'Consumidor final'}</td>
                <td className="px-3 py-2.5">{PAYMENT_METHOD_LABELS[sale.payment_method] ?? sale.payment_method}</td>
                <td className="px-3 py-2.5 font-semibold">{formatCurrencyCOP(sale.total)}</td>
                <td className="px-3 py-2.5">
                  <Badge variant={sale.invoice_requested ? 'success' : 'default'}>
                    {sale.invoice_requested ? 'Sí' : 'No'}
                  </Badge>
                </td>
                <td className="px-3 py-2.5">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={(): void => {
                      setReceiptSaleId(sale.id)
                      setRecentOpen(false)
                    }}
                  >
                    Ver recibo
                  </Button>
                </td>
              </tr>
            ))}
          </Table>
        ) : null}
      </Modal>

      <ReceiptModal
        open={receiptSaleId !== null}
        receipt={receiptQuery.data ?? null}
        loading={receiptQuery.isLoading}
        onClose={(): void => setReceiptSaleId(null)}
      />
    </div>
  )
}

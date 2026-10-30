import { useMutation, useQuery } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import { getApiErrorMessage } from '@/api/client'
import { listSuppliers, listWarehouses } from '@/api/catalogs'
import { createPurchase } from '@/api/inventory'
import { listProducts } from '@/api/products'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'

interface PurchaseLine {
  product_id: string
  quantity: string
  unit_cost: string
  vat_rate: string
}

const newLine = (): PurchaseLine => ({
  product_id: '',
  quantity: '1',
  unit_cost: '0',
  vat_rate: '0.19',
})

export const PurchasesPage = () => {
  const [purchaseNumber, setPurchaseNumber] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [note, setNote] = useState('')
  const [confirm, setConfirm] = useState(true)
  const [items, setItems] = useState<PurchaseLine[]>([newLine()])
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const suppliersQuery = useQuery({ queryKey: ['suppliers'], queryFn: listSuppliers })
  const warehousesQuery = useQuery({ queryKey: ['warehouses'], queryFn: listWarehouses })
  const productsQuery = useQuery({
    queryKey: ['products', 'purchase-form'],
    queryFn: () => listProducts({ is_active: true, limit: 500 }),
  })

  const mutation = useMutation({
    mutationFn: createPurchase,
    onSuccess: () => {
      setMessage('Compra registrada correctamente.')
      setError(null)
      setPurchaseNumber('')
      setNote('')
      setItems([newLine()])
    },
    onError: (unknownError) => {
      setMessage(null)
      setError(getApiErrorMessage(unknownError))
    },
  })

  const updateLine = (index: number, next: Partial<PurchaseLine>) => {
    setItems((prev) => prev.map((line, lineIndex) => (lineIndex === index ? { ...line, ...next } : line)))
  }

  const removeLine = (index: number) => {
    setItems((prev) => (prev.length === 1 ? prev : prev.filter((_, lineIndex) => lineIndex !== index)))
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage(null)
    setError(null)

    if (!supplierId || !warehouseId) {
      setError('Selecciona proveedor y bodega.')
      return
    }

    const parsedItems = items
      .filter((line) => line.product_id)
      .map((line) => ({
        product_id: Number(line.product_id),
        quantity: Number(line.quantity),
        unit_cost: Number(line.unit_cost),
        vat_rate: Number(line.vat_rate),
      }))

    if (parsedItems.length === 0) {
      setError('Agrega al menos un producto.')
      return
    }

    mutation.mutate({
      purchase_number: purchaseNumber.trim() || null,
      supplier_id: Number(supplierId),
      warehouse_id: Number(warehouseId),
      note: note.trim() || null,
      items: parsedItems,
      confirm,
    })
  }

  return (
    <Card title="Entradas de mercancía" subtitle="Compras a proveedores y entradas a bodega">
      <form className="space-y-4" onSubmit={submit}>
        <div className="grid gap-3 md:grid-cols-2">
          <Input
            label="Número compra (opcional)"
            value={purchaseNumber}
            onChange={(event): void => setPurchaseNumber(event.target.value)}
            placeholder="Si lo dejas vacío se genera automático"
          />
          <Input label="Nota" value={note} onChange={(event): void => setNote(event.target.value)} />

          <Select
            label="Proveedor"
            value={supplierId}
            onChange={(event): void => setSupplierId(event.target.value)}
            required
          >
            <option value="">Selecciona proveedor</option>
            {suppliersQuery.data?.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </Select>

          <Select
            label="Bodega"
            value={warehouseId}
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
        </div>

        <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">Ítems de compra</h3>
            <Button type="button" variant="secondary" onClick={(): void => setItems((prev) => [...prev, newLine()])}>
              <Plus size={16} className="mr-1" />
              Agregar ítem
            </Button>
          </div>

          {items.map((line, index) => (
            <div key={`purchase-line-${index}`} className="grid gap-2 rounded-lg bg-white p-3 md:grid-cols-12">
              <div className="md:col-span-5">
                <Select
                  label="Producto"
                  value={line.product_id}
                  onChange={(event): void => updateLine(index, { product_id: event.target.value })}
                  required
                >
                  <option value="">Selecciona producto</option>
                  {productsQuery.data?.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} ({product.sku})
                    </option>
                  ))}
                </Select>
              </div>
              <div className="md:col-span-2">
                <Input
                  label="Cantidad"
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={line.quantity}
                  onChange={(event): void => updateLine(index, { quantity: event.target.value })}
                  required
                />
              </div>
              <div className="md:col-span-2">
                <Input
                  label="Costo"
                  type="number"
                  min="0"
                  step="0.01"
                  value={line.unit_cost}
                  onChange={(event): void => updateLine(index, { unit_cost: event.target.value })}
                  required
                />
              </div>
              <div className="md:col-span-2">
                <Select
                  label="IVA"
                  value={line.vat_rate}
                  onChange={(event): void => updateLine(index, { vat_rate: event.target.value })}
                >
                  <option value="0.19">19%</option>
                  <option value="0.05">5%</option>
                  <option value="0">0%</option>
                </Select>
              </div>
              <div className="md:col-span-1 md:pt-7">
                <Button type="button" variant="danger" onClick={(): void => removeLine(index)}>
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <label className="inline-flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={confirm} onChange={(event): void => setConfirm(event.target.checked)} />
          Confirmar entrada y aplicar inventario inmediatamente
        </label>

        {message ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={(): void => setItems([newLine()])}>
            Limpiar ítems
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            Registrar entrada
          </Button>
        </div>
      </form>
    </Card>
  )
}

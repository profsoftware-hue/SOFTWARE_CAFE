import { useMutation, useQuery } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import { getApiErrorMessage } from '@/api/client'
import { listWarehouses } from '@/api/catalogs'
import { createAdjustment } from '@/api/inventory'
import { listProducts } from '@/api/products'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'

interface AdjustmentLine {
  product_id: string
  quantity: string
  unit_cost: string
  note: string
}

const newLine = (): AdjustmentLine => ({
  product_id: '',
  quantity: '1',
  unit_cost: '0',
  note: '',
})

export const AdjustmentsPage = () => {
  const [adjustmentNumber, setAdjustmentNumber] = useState('')
  const [adjustmentType, setAdjustmentType] = useState('ADJUSTMENT_OUT')
  const [warehouseId, setWarehouseId] = useState('')
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [confirm, setConfirm] = useState(true)
  const [items, setItems] = useState<AdjustmentLine[]>([newLine()])
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const warehousesQuery = useQuery({ queryKey: ['warehouses'], queryFn: listWarehouses })
  const productsQuery = useQuery({
    queryKey: ['products', 'adjustment-form'],
    queryFn: () => listProducts({ is_active: true, limit: 500 }),
  })

  const mutation = useMutation({
    mutationFn: createAdjustment,
    onSuccess: () => {
      setMessage('Ajuste registrado correctamente.')
      setError(null)
      setAdjustmentNumber('')
      setReason('')
      setNote('')
      setItems([newLine()])
    },
    onError: (unknownError) => {
      setError(getApiErrorMessage(unknownError))
      setMessage(null)
    },
  })

  const updateLine = (index: number, next: Partial<AdjustmentLine>) => {
    setItems((prev) => prev.map((line, lineIndex) => (lineIndex === index ? { ...line, ...next } : line)))
  }

  const removeLine = (index: number) => {
    setItems((prev) => (prev.length === 1 ? prev : prev.filter((_, lineIndex) => lineIndex !== index)))
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setMessage(null)

    if (!warehouseId) {
      setError('Selecciona bodega.')
      return
    }

    if (!reason.trim()) {
      setError('Debes indicar motivo del ajuste.')
      return
    }

    const parsedItems = items
      .filter((line) => line.product_id)
      .map((line) => ({
        product_id: Number(line.product_id),
        quantity: Number(line.quantity),
        unit_cost: Number(line.unit_cost),
        note: line.note || null,
      }))

    if (parsedItems.length === 0) {
      setError('Agrega al menos un producto.')
      return
    }

    mutation.mutate({
      adjustment_number: adjustmentNumber.trim() || null,
      adjustment_type: adjustmentType as
        | 'CUSTOMER_RETURN'
        | 'ADJUSTMENT_IN'
        | 'SHRINKAGE'
        | 'DAMAGE'
        | 'ADJUSTMENT_OUT',
      warehouse_id: Number(warehouseId),
      reason: reason.trim(),
      note: note.trim() || null,
      items: parsedItems,
      confirm,
    })
  }

  return (
    <Card title="Salidas y ajustes" subtitle="Mermas, daños, devoluciones y ajustes positivos/negativos">
      <form className="space-y-4" onSubmit={submit}>
        <div className="grid gap-3 md:grid-cols-2">
          <Input
            label="Número ajuste (opcional)"
            value={adjustmentNumber}
            onChange={(event): void => setAdjustmentNumber(event.target.value)}
          />

          <Select
            label="Tipo de ajuste"
            value={adjustmentType}
            onChange={(event): void => setAdjustmentType(event.target.value)}
            required
          >
            <option value="CUSTOMER_RETURN">CUSTOMER_RETURN (entrada)</option>
            <option value="ADJUSTMENT_IN">ADJUSTMENT_IN (entrada)</option>
            <option value="SHRINKAGE">SHRINKAGE (salida)</option>
            <option value="DAMAGE">DAMAGE (salida)</option>
            <option value="ADJUSTMENT_OUT">ADJUSTMENT_OUT (salida)</option>
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

          <Input
            label="Motivo"
            value={reason}
            onChange={(event): void => setReason(event.target.value)}
            placeholder="Ej. merma por vencimiento"
            required
          />

          <Input label="Nota" value={note} onChange={(event): void => setNote(event.target.value)} />
        </div>

        <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">Ítems del ajuste</h3>
            <Button type="button" variant="secondary" onClick={(): void => setItems((prev) => [...prev, newLine()])}>
              <Plus size={16} className="mr-1" />
              Agregar ítem
            </Button>
          </div>

          {items.map((line, index) => (
            <div key={`adjustment-line-${index}`} className="grid gap-2 rounded-lg bg-white p-3 md:grid-cols-12">
              <div className="md:col-span-4">
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
                />
              </div>
              <div className="md:col-span-3">
                <Input
                  label="Nota ítem"
                  value={line.note}
                  onChange={(event): void => updateLine(index, { note: event.target.value })}
                />
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
          Confirmar y aplicar movimiento de inventario
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
            Registrar ajuste
          </Button>
        </div>
      </form>
    </Card>
  )
}

import { cn } from '@/lib/cn'
import { formatCurrencyCOP, formatNumber } from '@/lib/format'
import { calculatePriceBreakdown } from '@/lib/pricing'

interface PriceBreakdownProps {
  basePrice: number
  vatRate: number | string
  className?: string
}

export const PriceBreakdown = ({ basePrice, vatRate, className }: PriceBreakdownProps) => {
  const breakdown = calculatePriceBreakdown(basePrice, vatRate)

  return (
    <div
      className={cn(
        'grid gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-slate-700 sm:grid-cols-3',
        className,
      )}
    >
      <div>
        <p className="text-[11px] uppercase tracking-wide text-slate-500">Antes de IVA</p>
        <p className="font-semibold">{formatCurrencyCOP(breakdown.base)}</p>
      </div>
      <div>
        <p className="text-[11px] uppercase tracking-wide text-slate-500">
          IVA ({formatNumber(breakdown.vatRate * 100, 0)}%)
        </p>
        <p className="font-semibold">{formatCurrencyCOP(breakdown.vat)}</p>
      </div>
      <div className="sm:text-right">
        <p className="text-[11px] uppercase tracking-wide text-slate-500">Precio total de venta</p>
        <p className="text-base font-bold text-slate-900">{formatCurrencyCOP(breakdown.total)}</p>
      </div>
    </div>
  )
}

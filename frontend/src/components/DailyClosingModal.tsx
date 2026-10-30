import { Printer, X } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { formatCurrencyCOP, formatNumber } from '@/lib/format'
import type { DailyClosing } from '@/types/api'

interface DailyClosingModalProps {
  open: boolean
  data: DailyClosing | null
  loading?: boolean
  onClose: () => void
}

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')

const formatClosingDate = (isoDate: string): string => {
  const date = new Date(`${isoDate}T12:00:00`)
  if (Number.isNaN(date.getTime())) return isoDate
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'long' }).format(date)
}

const formatRangeLabel = (dateFrom: string, dateTo: string): string => {
  if (dateFrom === dateTo) return formatClosingDate(dateFrom)
  return `${formatClosingDate(dateFrom)} al ${formatClosingDate(dateTo)}`
}

export const DailyClosingModal = ({ open, data, loading = false, onClose }: DailyClosingModalProps) => {
  if (!open) return null

  const printClosing = () => {
    if (!data) return

    const rows = data.items
      .map(
        (item) => `
          <tr>
            <td class="qty">${formatNumber(item.quantity, 3)}</td>
            <td class="desc">${escapeHtml(item.product_name)}${item.sku ? `<div class="small">${escapeHtml(item.sku)}</div>` : ''}</td>
            <td class="money">${formatCurrencyCOP(item.total)}</td>
          </tr>
        `,
      )
      .join('')

    const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>Cierre ${escapeHtml(data.date_from)} - ${escapeHtml(data.date_to)}</title>
<style>
  @page { size: 76mm auto; margin: 2mm 6.5mm; }
  html, body { margin: 0; padding: 0; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 10px; color: #111; width: 63mm; margin: 0 auto; }
  .header { text-align: center; margin-bottom: 6px; }
  .company { font-size: 13px; font-weight: bold; }
  .title { margin: 6px 0 3px; text-align: center; font-weight: bold; font-size: 11px; border-top: 1px dashed #555; border-bottom: 1px dashed #555; padding: 3px 0; }
  .data { margin: 5px 0; font-size: 9.5px; line-height: 1.4; }
  .data div { display: flex; justify-content: space-between; gap: 4px; }
  table { width: 100%; border-collapse: collapse; margin-top: 3px; table-layout: fixed; }
  th { font-size: 8.5px; text-transform: uppercase; border-bottom: 1px solid #333; padding: 2px 1px; text-align: left; }
  td { padding: 2px 1px; vertical-align: top; border-bottom: 1px dotted #bbb; font-size: 9.5px; }
  .qty { width: 10mm; text-align: center; }
  .desc { width: auto; overflow-wrap: break-word; }
  .money { width: 16mm; text-align: right; white-space: nowrap; }
  .small { font-size: 8.5px; color: #555; }
  .totals { margin-top: 5px; font-size: 10px; }
  .totals div { display: flex; justify-content: space-between; padding: 1px 0; }
  .totals .total { font-size: 13px; font-weight: bold; border-top: 1px solid #333; margin-top: 2px; padding-top: 3px; }
  .footer { margin-top: 8px; text-align: center; font-size: 8.5px; color: #333; border-top: 1px dashed #555; padding-top: 5px; }
</style>
</head>
<body>
  <div class="header">
    <div class="company">${escapeHtml(data.company_name)}</div>
  </div>

  <div class="title">CIERRE DEL DÍA</div>

  <div class="data">
    <div><span>Período</span><strong>${escapeHtml(formatRangeLabel(data.date_from, data.date_to))}</strong></div>
    <div><span>Tickets</span><span>${data.tickets}</span></div>
  </div>

  <table>
    <thead>
      <tr><th class="qty">Cant</th><th class="desc">Producto</th><th class="money">Total</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="totals">
    <div><span>Subtotal</span><span>${formatCurrencyCOP(data.subtotal)}</span></div>
    <div><span>IVA</span><span>${formatCurrencyCOP(data.tax_total)}</span></div>
    <div class="total"><span>TOTAL VENDIDO</span><span>${formatCurrencyCOP(data.total)}</span></div>
  </div>

  <div class="footer">
    Resumen generado por CCP Pereira<br/>
    Inventario y Ventas
  </div>
</body>
</html>`

    const printWindow = window.open('', '_blank', 'width=420,height=720')
    if (!printWindow) {
      window.alert('El navegador bloqueó la ventana de impresión. Permite ventanas emergentes e intenta de nuevo.')
      return
    }
    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
    printWindow.onload = () => printWindow.print()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-3">
      <section className="max-h-[92vh] w-full max-w-md overflow-auto rounded-xl bg-white p-4 shadow-xl">
        <header className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-slate-800">Cierre del día</h3>
            <p className="text-xs text-slate-500">Resumen de todo lo vendido.</p>
          </div>
          <button
            type="button"
            className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>

        {loading ? <p className="text-sm text-slate-500">Cargando cierre...</p> : null}

        {data ? (
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="text-center">
              <p className="text-sm font-bold text-slate-900">{data.company_name}</p>
            </div>

            <p className="my-2 border-y border-dashed border-slate-300 py-1 text-center text-xs font-bold uppercase tracking-wide text-slate-700">
              Cierre del día
            </p>

            <div className="space-y-0.5 text-[11px] text-slate-600">
              <div className="flex justify-between gap-2">
                <span>Período</span>
                <strong className="text-right text-slate-800">
                  {formatRangeLabel(data.date_from, data.date_to)}
                </strong>
              </div>
              <div className="flex justify-between gap-2">
                <span>Tickets</span>
                <span>{data.tickets}</span>
              </div>
            </div>

            {data.items.length === 0 ? (
              <p className="mt-3 rounded-lg bg-slate-50 p-3 text-center text-xs text-slate-500">
                No hay ventas registradas para esta fecha.
              </p>
            ) : (
              <table className="mt-2 w-full border-collapse text-[10px]">
                <thead>
                  <tr className="border-b border-slate-300 text-[9px] uppercase text-slate-500">
                    <th className="py-1 text-center">Cant</th>
                    <th className="py-1 text-left">Producto</th>
                    <th className="py-1 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item, index) => (
                    <tr key={`${item.sku ?? item.product_name}-${index}`} className="border-b border-dotted border-slate-200">
                      <td className="py-1 text-center">{formatNumber(item.quantity, 3)}</td>
                      <td className="py-1">
                        <p className="text-slate-800">{item.product_name}</p>
                        {item.sku ? <p className="text-[9px] text-slate-400">{item.sku}</p> : null}
                      </td>
                      <td className="py-1 text-right whitespace-nowrap">{formatCurrencyCOP(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div className="mt-2 space-y-0.5 text-[11px] text-slate-700">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatCurrencyCOP(data.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>IVA</span>
                <span>{formatCurrencyCOP(data.tax_total)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-300 pt-1 text-sm font-bold text-slate-900">
                <span>Total vendido</span>
                <span>{formatCurrencyCOP(data.total)}</span>
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-3 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
          <Button type="button" onClick={printClosing} disabled={!data || loading}>
            <Printer size={16} className="mr-1.5" />
            Imprimir cierre
          </Button>
        </div>
      </section>
    </div>
  )
}
